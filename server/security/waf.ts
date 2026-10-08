import type { Request, Response, NextFunction } from 'express';
import { query } from '../db.js';

// In-memory set of banned IPs for ultra-fast perimeter blocking
const bannedIpsCache = new Set<string>();
let cacheLastLoaded = 0;
const CACHE_TTL_MS = 60 * 1000; // 1 minute refresh

/**
 * Loads banned IPs from PostgreSQL into memory cache
 */
export async function syncBannedIpsCache(): Promise<void> {
  try {
    const res = await query('SELECT ip_address FROM banned_ips');
    bannedIpsCache.clear();
    for (const row of res.rows) {
      if (row.ip_address) {
        bannedIpsCache.add(row.ip_address.trim().toLowerCase());
      }
    }
    cacheLastLoaded = Date.now();
  } catch (err) {
    console.error('[WAF] Failed to sync banned IPs cache:', err);
  }
}

/**
 * Adds an IP to both database and in-memory ban cache (Automated SOAR)
 */
export async function autoBanIp(ip: string, reason: string): Promise<void> {
  const cleanIp = ip.trim().toLowerCase();

  // Safeguard: In local dev/test mode, do not ban 127.0.0.1/::1 to allow continuous testing
  if ((cleanIp === '127.0.0.1' || cleanIp === '::1') && process.env.NODE_ENV !== 'production') {
    console.warn(`[WAF HONEYPOT TRIGGERED (DEV)] ${cleanIp}: ${reason}`);
    return;
  }

  bannedIpsCache.add(cleanIp);
  try {
    await query(
      `INSERT INTO banned_ips (ip_address, reason)
       VALUES ($1, $2)
       ON CONFLICT (ip_address) DO UPDATE SET reason = EXCLUDED.reason, created_at = now()`,
      [cleanIp, `[AUTO-BAN WAF] ${reason}`]
    );
    await query(
      `INSERT INTO activity_logs (event_type, ip_address, metadata)
       VALUES ('waf_auto_ban', $1, $2)`,
      [cleanIp, JSON.stringify({ reason, timestamp: new Date().toISOString() })]
    );
    console.warn(`[WAF AUTO-BAN] IP ${cleanIp} banned: ${reason}`);
  } catch (err) {
    console.error(`[WAF] Error saving auto-ban for ${cleanIp}:`, err);
  }
}

// Honeypot paths: immediate ban trigger (Section 8.3 & 8.4)
const HONEYPOT_PATHS = [
  /^\/\.git/i,
  /^\/\.env/i,
  /^\/\.svn/i,
  /^\/\.htaccess/i,
  /^\/\.aws/i,
  /^\/wp-admin/i,
  /^\/wp-login/i,
  /^\/wp-content/i,
  /^\/xmlrpc\.php/i,
  /^\/phpmyadmin/i,
  /^\/pma/i,
  /^\/actuator/i,
  /^\/server-status/i,
  /^\/debug/i,
  /^\/console/i,
  /^\/phpinfo/i,
  /\.(bak|old|orig|swp|sql|zip|tar|gz|rar|7z)$/i,
];

// SQL Injection patterns
const SQLI_PATTERNS = [
  /(\b(union(\s+all)?)\s+select\b)/i,
  /(\bselect\b.+\bfrom\b.+\binformation_schema\b)/i,
  /(\b(sleep|benchmark)\s*\(\s*\d+\s*\))/i,
  /(\bor\b\s+['"\d\w]+\s*=\s*['"\d\w]+(\s*--|\s*#|\s*\/\*))/i,
  /(\bexec(ute)?\s*\(.+\))/i,
  /(;\s*drop\s+table\b)/i,
  /(;\s*delete\s+from\b)/i,
  /(;\s*insert\s+into\b)/i,
  /(;\s*update\s+.+\bset\b)/i,
  /(['"]\s*or\s*1\s*=\s*1)/i,
  /(\/\*!\d+.*\bselect\b)/i,
];

// Cross-Site Scripting (XSS) patterns
const XSS_PATTERNS = [
  /<script\b[^>]*>([\s\S]*?)<\/script>/i,
  /javascript\s*:/i,
  /vbscript\s*:/i,
  /data\s*:\s*text\/html/i,
  /<iframe\b[^>]*>/i,
  /onload\s*=\s*['"][^'"]*['"]/i,
  /onerror\s*=\s*['"][^'"]*['"]/i,
  /onclick\s*=\s*['"][^'"]*['"]/i,
  /onmouseover\s*=\s*['"][^'"]*['"]/i,
  /<svg\b[^>]*\bon\w+\s*=/i,
  /<img\b[^>]*\bonerror\s*=/i,
  /expression\s*\(.+?\)/i,
];

// Path Traversal / LFI patterns
const PATH_TRAVERSAL_PATTERNS = [
  /(\.\.[\/\\])/,
  /(%2e%2e[\/\\])/i,
  /(\.\.%2f)/i,
  /(%2e%2e%2f)/i,
  /(file|php|data|zip|phar):\/\//i,
  /\/etc\/(passwd|shadow|hosts)/i,
  /c:\\windows\\system32/i,
];

// Command Injection / RCE patterns
const RCE_PATTERNS = [
  /(\|\s*(cat|ls|id|whoami|uname|nc|bash|sh|powershell|cmd)\b)/i,
  /(;\s*(cat|ls|id|whoami|uname|nc|bash|sh|powershell|cmd)\b)/i,
  /(`.*(id|whoami|cat|bash|uname).*`)/i,
  /(\$\((id|whoami|cat|bash|uname)\))/i,
];

// SSRF Metadata destinations
const SSRF_PATTERNS = [
  /169\.254\.169\.254/,
  /fd00:ec2::254/i,
  /metadata\.google\.internal/i,
  /100\.100\.100\.200/,
];

// Allowed HTTP methods (Section 8.3)
const ALLOWED_METHODS = new Set(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']);

/**
 * Recursively inspects values in objects and strings for attack signatures
 */
function inspectValue(val: any, patterns: RegExp[]): { matched: boolean; pattern?: string; sample?: string } {
  if (val === null || val === undefined) return { matched: false };

  if (typeof val === 'string') {
    // Null byte check
    if (val.includes('\0') || val.includes('%00')) {
      return { matched: true, pattern: 'NullByte', sample: '\\0' };
    }

    for (const pat of patterns) {
      if (pat.test(val)) {
        return { matched: true, pattern: pat.toString(), sample: val.slice(0, 100) };
      }
    }
    return { matched: false };
  }

  if (typeof val === 'object') {
    for (const key of Object.keys(val)) {
      // Also inspect keys
      const keyCheck = inspectValue(key, patterns);
      if (keyCheck.matched) return keyCheck;

      const valCheck = inspectValue(val[key], patterns);
      if (valCheck.matched) return valCheck;
    }
  }

  return { matched: false };
}

/**
 * WAF Middleware: Inspection and Anomaly Detection
 */
export async function wafMiddleware(req: Request, res: Response, next: NextFunction) {
  const ip = (req as any).clientIp || req.socket.remoteAddress || '127.0.0.1';
  const cleanIp = ip.toLowerCase();

  // Refresh banned IPs cache if expired
  if (Date.now() - cacheLastLoaded > CACHE_TTL_MS) {
    syncBannedIpsCache().catch(() => {});
  }

  // 1. Check if IP is currently banned
  if (bannedIpsCache.has(cleanIp)) {
    return res.status(403).json({
      error: 'Access Forbidden: IP address is banned on this perimeter.',
    });
  }

  // 2. HTTP Method Check (Allowlist)
  if (!ALLOWED_METHODS.has(req.method.toUpperCase())) {
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  // 3. URI and Query Length Constraints
  const fullUrl = req.originalUrl || req.url;
  if (fullUrl.length > 4096) {
    return res.status(414).json({ error: 'URI Too Long' });
  }

  // 4. Honeypot check on request path
  const reqPath = req.path.toLowerCase();
  for (const honeypot of HONEYPOT_PATHS) {
    if (honeypot.test(reqPath)) {
      await autoBanIp(cleanIp, `Probing honeypot path: ${reqPath}`);
      return res.status(404).json({ error: 'Not found' });
    }
  }

  // 5. Inspect Query, Body, and Headers for Attack Vectors
  const allPatterns = [
    ...SQLI_PATTERNS,
    ...XSS_PATTERNS,
    ...PATH_TRAVERSAL_PATTERNS,
    ...RCE_PATTERNS,
    ...SSRF_PATTERNS,
  ];

  // Inspect Query Parameters
  const queryCheck = inspectValue(req.query, allPatterns);
  if (queryCheck.matched) {
    console.warn(`[WAF BLOCK - QUERY] IP: ${cleanIp} Pattern: ${queryCheck.pattern} Sample: ${queryCheck.sample}`);
    return res.status(403).json({ error: 'WAF: Request blocked by security policy' });
  }

  // Inspect Request Body (for JSON / form data)
  if (req.body && typeof req.body === 'object') {
    const bodyCheck = inspectValue(req.body, allPatterns);
    if (bodyCheck.matched) {
      console.warn(`[WAF BLOCK - BODY] IP: ${cleanIp} Pattern: ${bodyCheck.pattern} Sample: ${bodyCheck.sample}`);
      return res.status(403).json({ error: 'WAF: Request blocked by security policy' });
    }
  }

  // Inspect URL string itself
  const urlCheck = inspectValue(fullUrl, allPatterns);
  if (urlCheck.matched) {
    console.warn(`[WAF BLOCK - URL] IP: ${cleanIp} Pattern: ${urlCheck.pattern}`);
    return res.status(403).json({ error: 'WAF: Request blocked by security policy' });
  }

  next();
}
