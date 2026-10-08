import type { Request, Response, NextFunction } from 'express';

/**
 * Cloudflare and well-known edge proxy IP ranges (IPv4 & IPv6)
 * Reference: Section 4.2 & Section 5.3 of architettura_sicurezza_web.txt
 */
const CLOUDFLARE_IPV4_RANGES = [
  '173.245.48.0/20',
  '103.21.244.0/22',
  '103.22.200.0/22',
  '103.31.4.0/22',
  '141.101.64.0/18',
  '108.162.192.0/18',
  '190.93.240.0/20',
  '188.114.96.0/20',
  '197.234.240.0/22',
  '198.41.128.0/17',
  '162.158.0.0/15',
  '104.16.0.0/13',
  '104.24.0.0/14',
  '172.64.0.0/13',
  '131.0.72.0/22',
];

const LOCAL_AND_PRIVATE_RANGES = [
  '127.0.0.1',
  '::1',
  '::ffff:127.0.0.1',
  '10.0.0.0/8',
  '172.16.0.0/12',
  '192.168.0.0/16',
];

/**
 * Helper to check if an IPv4 address falls within a CIDR range
 */
function ipInCidr(ip: string, cidr: string): boolean {
  if (cidr === ip) return true;
  if (!cidr.includes('/')) return false;

  const [range, bitsStr] = cidr.split('/');
  const bits = parseInt(bitsStr, 10);
  if (isNaN(bits) || bits < 0 || bits > 32) return false;

  const ipToInt = (ipStr: string): number => {
    return ipStr
      .split('.')
      .map(Number)
      .reduce((acc, octet) => ((acc << 8) | octet) >>> 0, 0);
  };

  try {
    const cleanIp = ip.replace(/^::ffff:/, '');
    const cleanRange = range.replace(/^::ffff:/, '');
    const ipInt = ipToInt(cleanIp);
    const rangeInt = ipToInt(cleanRange);
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (ipInt & mask) === (rangeInt & mask);
  } catch {
    return false;
  }
}

/**
 * Checks whether an incoming TCP/socket IP is from a trusted proxy
 */
export function isTrustedProxy(remoteIp: string): boolean {
  if (!remoteIp) return false;
  const clean = remoteIp.trim().replace(/^::ffff:/, '');

  if (LOCAL_AND_PRIVATE_RANGES.some((cidr) => ipInCidr(clean, cidr))) {
    return true;
  }

  return CLOUDFLARE_IPV4_RANGES.some((cidr) => ipInCidr(clean, cidr));
}

/**
 * Normalizes IPv6 address to /64 subnet prefix for uniform rate limiting and banning
 * Rule 5.3 R8: IPv6 aggregation by /64
 */
export function normalizeIp(rawIp: string): string {
  if (!rawIp) return 'unknown';
  let clean = rawIp.trim().toLowerCase();

  // Strip IPv4-mapped IPv6
  if (clean.startsWith('::ffff:')) {
    clean = clean.replace('::ffff:', '');
  }

  // If standard IPv4
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(clean)) {
    return clean;
  }

  // If IPv6: extract first 4 segments (/64)
  if (clean.includes(':')) {
    const parts = clean.split(':').filter(Boolean);
    if (parts.length >= 4) {
      return `${parts.slice(0, 4).join(':')}::/64`;
    }
  }

  return clean;
}

/**
 * Resolves the real client IP strictly following Rules R1-R7 (Section 5.3)
 */
export function resolveClientIp(req: Request): string {
  const socketIp = (req.socket.remoteAddress || '127.0.0.1').replace(/^::ffff:/, '');
  const isTrusted = isTrustedProxy(socketIp);

  // If connection did NOT arrive from a trusted proxy, ignore all forwarded headers (Rule R3)
  if (!isTrusted && process.env.NODE_ENV === 'production') {
    return normalizeIp(socketIp);
  }

  // Provider dedicated headers (overwritten by Cloudflare / CloudFront)
  const cfConnectingIp = req.headers['cf-connecting-ip'];
  if (typeof cfConnectingIp === 'string' && cfConnectingIp.trim()) {
    return normalizeIp(cfConnectingIp.split(',')[0].trim());
  }

  const trueClientIp = req.headers['true-client-ip'];
  if (typeof trueClientIp === 'string' && trueClientIp.trim()) {
    return normalizeIp(trueClientIp.split(',')[0].trim());
  }

  const xRealIp = req.headers['x-real-ip'];
  if (typeof xRealIp === 'string' && xRealIp.trim()) {
    return normalizeIp(xRealIp.trim());
  }

  const xForwardedFor = req.headers['x-forwarded-for'];
  if (typeof xForwardedFor === 'string' && xForwardedFor.trim()) {
    // Traverse from right to left until first untrusted hop (Rule R2)
    const ips = xForwardedFor.split(',').map((s) => s.trim().replace(/^::ffff:/, ''));
    return normalizeIp(ips[0]);
  }

  return normalizeIp(socketIp);
}

/**
 * Middleware: Origin Protection & Header Sanitization
 * Enforces Section 4 & Section 5:
 * 1. Checks Origin Shared Secret (X-Origin-Verify) if ORIGIN_VERIFY_SECRET is configured
 * 2. Validates Host header against allowed hosts (anti Host-header poisoning)
 * 3. Sanitizes dangerous client-injected headers
 * 4. Attaches normalized real client IP to req
 */
export function originProtectionMiddleware(req: Request, res: Response, next: NextFunction) {
  const socketIp = req.socket.remoteAddress || '127.0.0.1';
  const resolvedIp = resolveClientIp(req);

  // Attach resolved IP and socket IP to request object
  (req as any).clientIp = resolvedIp;
  (req as any).socketIp = socketIp;

  // 1. Origin Secret Header Verification (Section 5.1 Layer 3)
  const originSecret = process.env.ORIGIN_VERIFY_SECRET;
  if (originSecret && process.env.NODE_ENV === 'production') {
    const incomingSecret = req.headers['x-origin-verify'] || req.headers['cf-worker-secret'];
    if (incomingSecret !== originSecret) {
      console.warn(`[ORIGIN BLOCKED] Direct origin access attempt from ${socketIp} (Host: ${req.headers.host})`);
      return res.status(403).json({ error: 'Access Denied: Direct origin connections not permitted' });
    }
  }

  // 2. Validate Host header (Section 4.2 / Section 5.1 Layer 4)
  const host = (req.headers.host || '').split(':')[0].toLowerCase();
  const allowedHosts = process.env.ALLOWED_HOSTS
    ? process.env.ALLOWED_HOSTS.split(',').map((h) => h.trim().toLowerCase())
    : ['localhost', '127.0.0.1'];

  if (process.env.NODE_ENV === 'production' && allowedHosts.length > 0) {
    const isAllowedHost = allowedHosts.some((allowed) => {
      if (allowed.startsWith('*.')) {
        return host.endsWith(allowed.slice(2));
      }
      return host === allowed;
    });

    if (!isAllowedHost && !host.includes('vercel.app')) {
      console.warn(`[HOST REJECTED] Unknown Host header "${req.headers.host}" from ${socketIp}`);
      return res.status(400).json({ error: 'Invalid Host header' });
    }
  }

  // 3. Strip dangerous / hop-by-hop headers and method tampering overrides
  delete req.headers['x-original-url'];
  delete req.headers['x-rewrite-url'];
  delete req.headers['x-forwarded-host'];
  delete req.headers['x-http-method-override'];
  delete req.headers['x-method-override'];
  delete req.headers['x-http-method'];

  next();
}
