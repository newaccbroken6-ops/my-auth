import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import { query } from '../db.js';
import { authenticateToken, generateToken, AuthRequest } from '../auth.js';

const router = Router();

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only images are allowed'));
    }
  },
});

// POST /api/auth/register
router.post('/register', async (req, res: Response) => {
  try {
    const { email, password, username } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (password.length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters long' });
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
      `INSERT INTO profiles (email, password_hash, username, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, username, role, is_banned, ban_reason, avatar_url, created_at`,
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
router.post('/login', async (req, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const result = await query(
      `SELECT id, email, password_hash, username, role, is_banned, ban_reason, avatar_url, created_at 
       FROM profiles WHERE email = $1`,
      [cleanEmail]
    );

    if (result.rows.length === 0) {
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
      return res.status(401).json({ error: 'Invalid email or password' });
    }

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
router.post('/change-password', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required' });
    }

    const userRes = await query('SELECT password_hash FROM profiles WHERE id = $1', [req.user!.id]);
    const isMatch = await bcrypt.compare(currentPassword, userRes.rows[0].password_hash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Incorrect current password' });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await query('UPDATE profiles SET password_hash = $1, updated_at = now() WHERE id = $2', [newHash, req.user!.id]);

    return res.json({ success: true, message: 'Password updated successfully' });
  } catch (err: any) {
    console.error('Change password error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

export default router;
