import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { query } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'supernova_auth_jwt_secret_key_2026_super_secure!';

export interface AuthUser {
  id: string;
  email: string;
  role: 'user' | 'admin';
  username?: string | null;
  avatar_url?: string | null;
  is_banned?: boolean;
  token_version?: number;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

export function generateToken(user: AuthUser): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      token_version: user.token_version || 1,
    },
    JWT_SECRET,
    { expiresIn: '15m' }
  );
}

export async function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: string;
      email: string;
      role: 'user' | 'admin';
      token_version?: number;
    };
    
    // Fetch fresh user record
    const result = await query(
      'SELECT id, email, username, role, is_banned, ban_reason, avatar_url, token_version FROM profiles WHERE id = $1',
      [decoded.id]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    if (user.is_banned) {
      return res.status(403).json({ error: 'Account is banned', ban_reason: user.ban_reason });
    }

    // Verify token version (revocation check - Section 11.6)
    const currentVersion = user.token_version || 1;
    const tokenVersion = decoded.token_version || 1;
    if (tokenVersion !== currentVersion) {
      return res.status(401).json({ error: 'Session has been revoked. Please log in again.' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export async function optionalAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: string;
      email: string;
      role: 'user' | 'admin';
      token_version?: number;
    };
    const result = await query(
      'SELECT id, email, username, role, is_banned, ban_reason, avatar_url, token_version FROM profiles WHERE id = $1',
      [decoded.id]
    );

    if (result.rows.length > 0 && !result.rows[0].is_banned) {
      const user = result.rows[0];
      const currentVersion = user.token_version || 1;
      const tokenVersion = decoded.token_version || 1;
      if (tokenVersion === currentVersion) {
        req.user = user;
      }
    }
  } catch {
    // Ignore invalid token in optionalAuth
  }

  next();
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
  }
  next();
}
