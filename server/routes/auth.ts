import { Router } from 'express';
import type { Response } from 'express';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import { query } from '../db.js';
import { authenticateToken, generateToken } from '../auth.js';
import type { AuthRequest } from '../auth.js';
import {
  isAccountLocked,
  recordFailedLogin,
  recordSuccessfulLogin,
  revokeAllUserSessions,
} from '../security/authHardening.js';
import { authRateLimiter } from '../security/rateLimiter.js';

const router = Router();

const storage = multer.memoryStorage();

const ALLOWED_IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

function isValidImageMagicBytes(buf: Buffer): boolean {
  if (!buf || buf.length < 8) return false;
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true;
  // PNG: 89 50 4E 47
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return true;
  // GIF: 47 49 46 38
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return true;
  // WEBP: RIFF....WEBP (52 49 46 46 .... 57 45 42 50)
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) return true;
  return false;
}

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_IMAGE_MIMES.has(file.mimetype.toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, WEBP, and GIF images are allowed'));
    }
  },
});

// POST /api/auth/register
router.post('/register', authRateLimiter, async (req, res: Response) => {
  try {
    const { email, password, username } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      return res.status(400).json({ error: 'Password must contain at least one uppercase letter and one number' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = username?.trim() || cleanEmail.split('@')[0];

    // Check if email already exists
    const existing = await query('SELECT id FROM profiles WHERE email = $1', [cleanEmail]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Email is already registered' });
    }

    // Check count of profiles to assign role: first user becomes admin, others user
    const totalProfiles = await query('SELECT count(*)::int as total FROM profiles');
    const role = (totalProfiles.rows[0]?.total ?? 0) === 0 ? 'admin' : 'user';

    const hashedPassword = await bcrypt.hash(password, 10);

    const insertRes = await query(
      `INSERT INTO profiles (email, password_hash, username, role, token_version)
       VALUES ($1, $2, $3, $4, 1)
       RETURNING id, email, username, role, is_banned, ban_reason, avatar_url, token_version, created_at`,
      [cleanEmail, hashedPassword, cleanUsername, role]
    );

    const user = insertRes.rows[0];
    const token = generateToken(user);

    // Log activity
    await query(
      `INSERT INTO activity_logs (user_id, event_type, metadata)
       VALUES ($1, 'user_registered', $2)`,
      [user.id, JSON.stringify({ email: cleanEmail, role })]
    );

    return res.status(201).json({ token, user });
  } catch (err: any) {
    console.error('Register error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// POST /api/auth/login
router.post('/login', authRateLimiter, async (req, res: Response) => {
  try {
    const { email, password } = req.body;
    const clientIp = (req as any).clientIp || req.socket.remoteAddress || '127.0.0.1';

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const cleanEmail = email.trim().toLowerCase();

    // 1. Check account lockout (Brute-force / Credential Stuffing defense - Section 10 & 12)
    const lockStatus = await isAccountLocked(cleanEmail);
    if (lockStatus.locked) {
      return res.status(429).json({
        error: `Account is temporarily locked due to multiple failed login attempts. Please try again in ${lockStatus.remainingMinutes} minutes.`,
      });
    }

    const result = await query(
      `SELECT id, email, password_hash, username, role, is_banned, ban_reason, avatar_url, token_version, created_at 
       FROM profiles WHERE email = $1`,
      [cleanEmail]
    );

    // Uniform comparison to prevent timing-based user enumeration (Section 12.4)
    if (result.rows.length === 0) {
      // Dummy compare to avoid timing discrepancies
      await bcrypt.compare(password, '$2a$10$abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNO1234567890');
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];

    if (user.is_banned) {
      return res.status(403).json({
        error: `Your account has been banned.${user.ban_reason ? ` Reason: ${user.ban_reason}` : ''}`,
      });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      const wasLocked = await recordFailedLogin(cleanEmail, clientIp);
      if (wasLocked) {
        return res.status(429).json({
          error: 'Account locked due to too many failed attempts. Try again in 15 minutes.',
        });
      }
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Success: reset failures and record login telemetry
    await recordSuccessfulLogin(user.id, clientIp);

    const { password_hash, ...safeUser } = user;
    const token = generateToken(safeUser);

    return res.json({ token, user: safeUser });
  } catch (err: any) {
    console.error('Login error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// GET /api/auth/me
router.get('/me', authenticateToken, async (req: AuthRequest, res: Response) => {
  return res.json({ user: req.user });
});

// PUT /api/auth/profile
router.put('/profile', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { username, avatar_url } = req.body;
    const userId = req.user!.id;

    const updates: string[] = ['updated_at = now()'];
    const params: any[] = [];
    let paramIndex = 1;

    if (username !== undefined) {
      updates.push(`username = $${paramIndex++}`);
      params.push(username ? username.trim() : null);
    }

    if (avatar_url !== undefined) {
      updates.push(`avatar_url = $${paramIndex++}`);
      params.push(avatar_url || null);
    }

    params.push(userId);
    const sql = `
      UPDATE profiles 
      SET ${updates.join(', ')} 
      WHERE id = $${paramIndex}
      RETURNING id, email, username, role, is_banned, ban_reason, avatar_url, created_at
    `;

    const result = await query(sql, params);
    return res.json({ user: result.rows[0] });
  } catch (err: any) {
    console.error('Update profile error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// POST /api/auth/avatar
router.post('/avatar', authenticateToken, upload.single('avatar'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded' });
    }

    if (!isValidImageMagicBytes(req.file.buffer)) {
      return res.status(400).json({ error: 'Invalid image format: File header does not match valid image signature' });
    }

    const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    const result = await query(
      `UPDATE profiles 
       SET avatar_url = $1, updated_at = now() 
       WHERE id = $2 
       RETURNING id, email, username, role, is_banned, ban_reason, avatar_url`,
      [base64Image, req.user!.id]
    );

    return res.json({
      publicUrl: base64Image,
      user: result.rows[0],
    });
  } catch (err: any) {
    console.error('Avatar upload error:', err);
    return res.status(500).json({ error: err.message || 'Error uploading avatar' });
  }
});

// POST /api/auth/change-password
router.post('/change-password', authenticateToken, authRateLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters long' });
    }

    const userRes = await query('SELECT password_hash FROM profiles WHERE id = $1', [req.user!.id]);
    const isMatch = await bcrypt.compare(currentPassword, userRes.rows[0].password_hash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Incorrect current password' });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await query('UPDATE profiles SET password_hash = $1, updated_at = now() WHERE id = $2', [newHash, req.user!.id]);

    // Invalidate all existing sessions/tokens across all devices (Section 12.2)
    await revokeAllUserSessions(req.user!.id);

    return res.json({ success: true, message: 'Password updated successfully. Other sessions revoked.' });
  } catch (err: any) {
    console.error('Change password error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// POST /api/auth/logout-all (Revoke all active sessions - Section 12.2)
router.post('/logout-all', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    await revokeAllUserSessions(req.user!.id);
    return res.json({ success: true, message: 'All active sessions have been revoked successfully.' });
  } catch (err: any) {
    console.error('Logout all error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
