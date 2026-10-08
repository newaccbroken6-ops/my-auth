import type { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  timestamps: number[];
}

interface RateLimiterOptions {
  windowMs: number;
  max: number;
  message?: string;
  keyGenerator?: (req: Request) => string;
  skip?: (req: Request) => boolean;
}

/**
 * Creates an in-memory sliding window rate limiter
 */
export function createRateLimiter(options: RateLimiterOptions) {
  const store = new Map<string, RateLimitRecord>();
  const {
    windowMs,
    max,
    message = 'Too many requests, please try again later.',
    keyGenerator = (req: Request) => (req as any).clientIp || req.socket.remoteAddress || 'unknown',
    skip = () => false,
  } = options;

  // Cleanup old keys every 5 minutes to avoid memory leaks
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of store.entries()) {
      record.timestamps = record.timestamps.filter((ts) => now - ts < windowMs);
      if (record.timestamps.length === 0) {
        store.delete(key);
      }
    }
  }, 5 * 60 * 1000).unref();

  return (req: Request, res: Response, next: NextFunction) => {
    if (skip(req)) return next();

    const key = keyGenerator(req);
    const now = Date.now();

    const record = store.get(key) || { timestamps: [] };
    // Filter timestamps within current sliding window
    record.timestamps = record.timestamps.filter((ts) => now - ts < windowMs);

    const count = record.timestamps.length;
    const remaining = Math.max(0, max - count - 1);
    const oldestTimestamp = record.timestamps[0] || now;
    const resetTimeSec = Math.ceil((oldestTimestamp + windowMs - now) / 1000);

    // Set standard IETF RateLimit headers
    res.setHeader('RateLimit-Limit', max);
    res.setHeader('RateLimit-Remaining', remaining);
    res.setHeader('RateLimit-Reset', resetTimeSec > 0 ? resetTimeSec : 1);

    if (count >= max) {
      res.setHeader('Retry-After', resetTimeSec > 0 ? resetTimeSec : 1);
      return res.status(429).json({
        error: message,
        retryAfter: resetTimeSec > 0 ? resetTimeSec : 1,
      });
    }

    record.timestamps.push(now);
    store.set(key, record);
    next();
  };
}

/**
 * Public routes limiter (120 req / minute per IP)
 */
export const publicRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 120,
  message: 'Public request limit exceeded. Please wait a moment.',
});

/**
 * General API limiter (300 req / minute per IP or authenticated user)
 */
export const apiRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 300,
  keyGenerator: (req) => {
    const user = (req as any).user;
    if (user?.id) return `user:${user.id}`;
    return `ip:${(req as any).clientIp || req.socket.remoteAddress || 'unknown'}`;
  },
});

/**
 * Sensitive Auth limiter (login, register, password change)
 * 10 attempts per 15 minutes per IP (Section 10.3)
 */
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many authentication attempts. Please try again in 15 minutes.',
  keyGenerator: (req) => {
    const ip = (req as any).clientIp || req.socket.remoteAddress || 'unknown';
    const email = req.body?.email ? String(req.body.email).toLowerCase().trim() : '';
    return email ? `auth:${email}:${ip}` : `auth:ip:${ip}`;
  },
});

/**
 * Client License Validation Limiter (10 req / minute per IP)
 */
export const clientValidationLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 15,
  message: 'License validation rate limit exceeded. Please wait a moment.',
  keyGenerator: (req) => {
    const ip = (req as any).clientIp || req.socket.remoteAddress || 'unknown';
    const licenseKey = req.body?.license_key ? String(req.body.license_key).trim() : '';
    return licenseKey ? `val:${licenseKey}:${ip}` : `val:ip:${ip}`;
  },
});

/**
 * Admin API limiter (30 req / minute per user)
 */
export const adminRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  message: 'Admin action rate limit reached. Slow down.',
  keyGenerator: (req) => {
    const user = (req as any).user;
    return `admin:${user?.id || (req as any).clientIp || req.socket.remoteAddress}`;
  },
});
