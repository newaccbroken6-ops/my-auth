import { Request, Response, NextFunction } from 'express';
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
    },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

export async function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; email: string; role: 'user' | 'admin' };
    
    // Fetch fresh user record
    const result = await query(
      'SELECT id, email, username, role, is_banned, ban_reason, avatar_url FROM profiles WHERE id = $1',
      [decoded.id]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    if (user.is_banned) {
      return res.status(403).json({ error: 'Account is banned', ban_reason: user.ban_reason });
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
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; email: string; role: 'user' | 'admin' };
    const result = await query(
      'SELECT id, email, username, role, is_banned, ban_reason, avatar_url FROM profiles WHERE id = $1',
      [decoded.id]
    );

    if (result.rows.length > 0 && !result.rows[0].is_banned) {
      req.user = result.rows[0];
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
