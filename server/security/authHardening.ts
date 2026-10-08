import type { Request, Response, NextFunction } from 'express';
import { query } from '../db.js';
import { logSecurityEvent } from './auditLogger.js';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;

/**
 * Checks if an account is currently locked due to brute force / credential stuffing
 */
export async function isAccountLocked(email: string): Promise<{ locked: boolean; remainingMinutes?: number }> {
  const cleanEmail = email.trim().toLowerCase();
  const res = await query(
    `SELECT locked_until FROM profiles WHERE email = $1`,
    [cleanEmail]
  );

  if (res.rows.length === 0) return { locked: false };

  const lockedUntil = res.rows[0].locked_until;
  if (!lockedUntil) return { locked: false };

  const lockTime = new Date(lockedUntil).getTime();
  const now = Date.now();

  if (lockTime > now) {
    const remainingMinutes = Math.ceil((lockTime - now) / (60 * 1000));
    return { locked: true, remainingMinutes };
  }

  // Lock expired: reset lockout
  await query(
    `UPDATE profiles SET failed_login_attempts = 0, locked_until = NULL WHERE email = $1`,
    [cleanEmail]
  );
  return { locked: false };
}

/**
 * Records a failed login attempt and locks account if threshold exceeded
 */
export async function recordFailedLogin(email: string, ip: string): Promise<boolean> {
  const cleanEmail = email.trim().toLowerCase();

  const userRes = await query(
    `SELECT id, failed_login_attempts FROM profiles WHERE email = $1`,
    [cleanEmail]
  );

  if (userRes.rows.length === 0) {
    await logSecurityEvent('auth_failed_unknown_user', ip, { email: cleanEmail });
    return false;
  }

  const user = userRes.rows[0];
  const newCount = (user.failed_login_attempts || 0) + 1;

  if (newCount >= MAX_FAILED_ATTEMPTS) {
    const lockUntil = new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000);
    await query(
      `UPDATE profiles 
       SET failed_login_attempts = $1, locked_until = $2 
       WHERE id = $3`,
      [newCount, lockUntil.toISOString(), user.id]
    );

    await logSecurityEvent('account_locked', ip, {
      user_id: user.id,
      email: cleanEmail,
      attempts: newCount,
      lockout_minutes: LOCKOUT_DURATION_MINUTES,
    }, user.id);

    console.warn(`[SECURITY] Account ${cleanEmail} LOCKED for ${LOCKOUT_DURATION_MINUTES} minutes due to ${newCount} failed attempts from IP ${ip}`);
    return true; // Locked
  } else {
    await query(
      `UPDATE profiles SET failed_login_attempts = $1 WHERE id = $2`,
      [newCount, user.id]
    );

    await logSecurityEvent('auth_failed', ip, {
      user_id: user.id,
      email: cleanEmail,
      attempts: newCount,
    }, user.id);

    return false;
  }
}

/**
 * Resets failed login attempts on successful authentication
 */
export async function recordSuccessfulLogin(userId: string, ip: string): Promise<void> {
  await query(
    `UPDATE profiles 
     SET failed_login_attempts = 0, 
         locked_until = NULL,
         last_login_at = now(),
         last_login_ip = $1
     WHERE id = $2`,
    [ip, userId]
  );

  await logSecurityEvent('auth_success', ip, { user_id: userId }, userId);
}

/**
 * Increments token_version to immediately revoke all existing JWTs for this user
 */
export async function revokeAllUserSessions(userId: string): Promise<void> {
  await query(
    `UPDATE profiles 
     SET token_version = COALESCE(token_version, 1) + 1,
         updated_at = now()
     WHERE id = $1`,
    [userId]
  );
}

/**
 * CSRF Protection Middleware for State-Changing Requests (Section 12.3)
 */
export function csrfProtectionMiddleware(req: Request, res: Response, next: NextFunction) {
  // Safe HTTP methods do not change server state
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method.toUpperCase())) {
    return next();
  }

  // Exempt public validation endpoint which is machine-to-machine (C++ client DLL)
  if (req.path.startsWith('/api/v1/validate-license') || req.path.startsWith('/validate-license')) {
    return next();
  }

  const origin = req.headers.origin;
  const referer = req.headers.referer;
  const secFetchSite = req.headers['sec-fetch-site'];

  // Check Fetch metadata: reject cross-site forged state-changing requests
  if (secFetchSite === 'cross-site') {
    console.warn(`[CSRF BLOCKED] Cross-site request rejected on ${req.method} ${req.path}`);
    return res.status(403).json({ error: 'CSRF Validation Failed: Cross-site requests prohibited' });
  }

  // Allowed origins
  const configuredOrigins = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : [];
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:3001',
    'https://supernova-keys.vercel.app',
    'https://my-auth-kohl.vercel.app',
    ...configuredOrigins,
  ].map((o) => o.trim().toLowerCase());

  if (origin) {
    const cleanOrigin = origin.trim().toLowerCase();
    const isAllowed = allowedOrigins.includes(cleanOrigin);
    if (!isAllowed) {
      console.warn(`[CSRF BLOCKED] Origin ${origin} not in allowlist on ${req.method} ${req.path}`);
      return res.status(403).json({ error: 'CSRF Validation Failed: Origin not permitted' });
    }
  }

  next();
}
