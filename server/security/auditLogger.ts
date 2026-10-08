import type { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { query } from '../db.js';

/**
 * Redacts sensitive fields from objects before logging
 */
export function redactSensitiveData(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;

  const SENSITIVE_KEYS = new Set([
    'password',
    'password_hash',
    'currentpassword',
    'newpassword',
    'token',
    'refreshtoken',
    'secret',
    'api_secret',
    'authorization',
  ]);

  if (Array.isArray(obj)) {
    return obj.map(redactSensitiveData);
  }

  const clean: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      clean[key] = '[REDACTED]';
    } else if (typeof val === 'object' && val !== null) {
      clean[key] = redactSensitiveData(val);
    } else {
      clean[key] = val;
    }
  }
  return clean;
}

/**
 * Middleware: Structured JSON Logging & Request Tracing (Section 14.1 & 14.2)
 */
export function auditLoggerMiddleware(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();

  // Correlation ID: preserve incoming X-Request-ID or generate new UUID
  const requestId = (req.headers['x-request-id'] as string) || crypto.randomUUID();
  res.setHeader('X-Request-ID', requestId);
  (req as any).requestId = requestId;

  // Intercept response finish to log complete structured telemetry
  res.on('finish', () => {
    const durationMs = Date.now() - startTime;
    const clientIp = (req as any).clientIp || req.socket.remoteAddress || 'unknown';
    const socketIp = (req as any).socketIp || req.socket.remoteAddress || 'unknown';
    const userId = (req as any).user?.id || null;

    const logEntry = {
      timestamp: new Date().toISOString(),
      request_id: requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration_ms: durationMs,
      client_ip: clientIp,
      socket_ip: socketIp,
      user_id: userId,
      user_agent: req.headers['user-agent'] || 'unknown',
    };

    // Output structured JSON in production; clean console in dev
    if (process.env.NODE_ENV === 'production') {
      console.log(JSON.stringify(logEntry));
    } else if (res.statusCode >= 400) {
      console.warn(`[HTTP ${res.statusCode}] ${req.method} ${req.path} (${durationMs}ms) IP: ${clientIp}`);
    }
  });

  next();
}

/**
 * Helper to record high-priority security audit events to database
 */
export async function logSecurityEvent(
  eventType: string,
  ip: string,
  details: Record<string, any>,
  userId?: string | null
): Promise<void> {
  try {
    const cleanDetails = redactSensitiveData(details);
    await query(
      `INSERT INTO activity_logs (user_id, event_type, ip_address, metadata)
       VALUES ($1, $2, $3, $4)`,
      [userId || null, eventType, ip, JSON.stringify(cleanDetails)]
    );
  } catch (err) {
    console.error('[SECURITY AUDIT] Failed to persist security event:', err);
  }
}
