import type { Request, Response, NextFunction } from 'express';

/**
 * Modern HTTP Security Headers & Information Exposure Mitigation
 * Reference: Section 12.7 & Section 18.3 of architettura_sicurezza_web.txt
 */
export function securityHeadersMiddleware(req: Request, res: Response, next: NextFunction) {
  // 1. Remove Fingerprinting Headers
  res.removeHeader('X-Powered-By');
  res.removeHeader('Server');

  // 2. Fundamental Security Headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()'
  );
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');

  // 3. Strict Transport Security (HSTS)
  // Sent on HTTPS connections and in production; preload enabled per Section 7.1 & 12.7
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https' || process.env.NODE_ENV === 'production';
  if (isHttps) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  // 4. Content Security Policy (CSP)
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' https:",
    "object-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ].join('; ');

  res.setHeader('Content-Security-Policy', cspDirectives);

  // 5. Anti-Cache Headers on API and Authenticated Endpoints (Section 12.7)
  if (req.path.startsWith('/api') || req.path.startsWith('/functions')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }

  next();
}
