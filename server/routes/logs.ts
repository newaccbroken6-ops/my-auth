import { Router, Response } from 'express';
import { query } from '../db.js';
import { authenticateToken, AuthRequest } from '../auth.js';

const router = Router();

// GET /api/logs
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const { page = '0', limit = '50', event_type, search } = req.query;

    const pageNum = Math.max(parseInt(String(page), 10) || 0, 0);
    const limitNum = Math.min(Math.max(parseInt(String(limit), 10) || 50, 1), 200);
    const offset = pageNum * limitNum;

    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (user.role !== 'admin') {
      conditions.push(`(l.user_id = $${idx} OR a.owner_id = $${idx})`);
      params.push(user.id);
      idx++;
    }

    if (event_type && event_type !== 'all') {
      conditions.push(`l.event_type = $${idx++}`);
      params.push(event_type);
    }

    if (search) {
      conditions.push(`(l.ip_address ILIKE $${idx} OR l.hwid ILIKE $${idx} OR l.event_type ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `
      SELECT l.*, a.name as app_name, u.username, u.email as user_email
      FROM activity_logs l
      LEFT JOIN applications a ON l.app_id = a.id
      LEFT JOIN profiles u ON l.user_id = u.id
      ${whereClause}
      ORDER BY l.created_at DESC
      LIMIT $${idx++} OFFSET $${idx++}
    `;
    params.push(limitNum, offset);

    const result = await query(sql, params);
    return res.json(result.rows);
  } catch (err: any) {
    console.error('Fetch logs error:', err);
    return res.status(500).json({ error: err.message || 'Failed to fetch logs' });
  }
});

// DELETE /api/logs/clear
router.delete('/clear', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    if (user.role === 'admin') {
      await query('DELETE FROM activity_logs');
    } else {
      await query(
        `DELETE FROM activity_logs 
         WHERE user_id = $1 
            OR app_id IN (SELECT id FROM applications WHERE owner_id = $1)`,
        [user.id]
      );
    }
    return res.json({ success: true, message: 'Logs cleared successfully' });
  } catch (err: any) {
    console.error('Clear logs error:', err);
    return res.status(500).json({ error: err.message || 'Failed to clear logs' });
  }
});

export default router;
