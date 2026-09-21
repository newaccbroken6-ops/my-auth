import { Router, Response } from 'express';
import { query } from '../db.js';
import { authenticateToken, requireAdmin, AuthRequest } from '../auth.js';

const router = Router();

// GET /api/users (Admin only)
router.get('/', authenticateToken, requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT id, email, username, role, is_banned, ban_reason, avatar_url, created_at, updated_at 
       FROM profiles 
       ORDER BY created_at DESC`
    );
    return res.json(result.rows);
  } catch (err: any) {
    console.error('Fetch users error:', err);
    return res.status(500).json({ error: err.message || 'Failed to fetch users' });
  }
});

// PUT /api/users/:id/role (Admin only)
router.put('/:id/role', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!role || !['user', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Valid role (user or admin) is required' });
    }

    const result = await query(
      `UPDATE profiles 
       SET role = $1, updated_at = now() 
       WHERE id = $2 
       RETURNING id, email, username, role, is_banned, ban_reason, avatar_url, created_at`,
      [role, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json(result.rows[0]);
  } catch (err: any) {
    console.error('Update user role error:', err);
    return res.status(500).json({ error: err.message || 'Failed to update user role' });
  }
});

// POST /api/users/:id/ban (Admin only)
router.post('/:id/ban', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { banned = true, ban_reason } = req.body;
    const adminUser = req.user!;

    const result = await query(
      `UPDATE profiles 
       SET is_banned = $1, ban_reason = $2, updated_at = now() 
       WHERE id = $3 
       RETURNING id, email, username, role, is_banned, ban_reason, avatar_url, created_at`,
      [Boolean(banned), banned ? (ban_reason || null) : null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    await query(
      `INSERT INTO activity_logs (user_id, event_type, metadata)
       VALUES ($1, $2, $3)`,
      [adminUser.id, banned ? 'user_banned' : 'user_unbanned', JSON.stringify({ target_user_id: id, reason: ban_reason })]
    );

    return res.json({ success: true, user: result.rows[0] });
  } catch (err: any) {
    console.error('Ban user error:', err);
    return res.status(500).json({ error: err.message || 'Failed to update user ban status' });
  }
});

// Compatibility endpoint for /ban-user
router.post('/ban-user', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { user_id, ban_reason, banned } = req.body;
    const adminUser = req.user!;

    if (!user_id) {
      return res.status(400).json({ error: 'Missing user_id' });
    }

    const isBanned = banned !== undefined ? Boolean(banned) : true;
    const result = await query(
      `UPDATE profiles 
       SET is_banned = $1, ban_reason = $2, updated_at = now() 
       WHERE id = $3 
       RETURNING id, email, username, role, is_banned, ban_reason, avatar_url, created_at`,
      [isBanned, isBanned ? (ban_reason || null) : null, user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    await query(
      `INSERT INTO activity_logs (user_id, event_type, metadata)
       VALUES ($1, $2, $3)`,
      [adminUser.id, isBanned ? 'user_banned' : 'user_unbanned', JSON.stringify({ target_user_id: user_id, reason: ban_reason })]
    );

    return res.json({ success: true, user: result.rows[0] });
  } catch (err: any) {
    console.error('Ban user compat error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

export default router;
