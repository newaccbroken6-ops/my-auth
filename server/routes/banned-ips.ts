import { Router } from 'express';
import type { Response } from 'express';
import { query } from '../db.js';
import { authenticateToken } from '../auth.js';
import type { AuthRequest } from '../auth.js';
import { syncBannedIpsCache } from '../security/waf.js';
import { adminRateLimiter } from '../security/rateLimiter.js';

const router = Router();

router.use(authenticateToken, adminRateLimiter);

// GET /api/banned-ips
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized: Admin access required' });
    }

    const result = await query(`
      SELECT b.*, p.username as created_by_username, p.email as created_by_email
      FROM banned_ips b
      LEFT JOIN profiles p ON b.created_by = p.id
      ORDER BY b.created_at DESC
    `);
    return res.json(result.rows);
  } catch (err: any) {
    console.error('Fetch banned IPs error:', err);
    return res.status(500).json({ error: err.message || 'Failed to fetch banned IPs' });
  }
});

// POST /api/banned-ips (Ban / Kick IP)
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { ip_address, reason } = req.body;
    const user = req.user!;

    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized: Admin access required' });
    }

    if (!ip_address || typeof ip_address !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid ip_address' });
    }

    const cleanIp = ip_address.trim();
    const cleanReason = reason ? String(reason).trim() : 'Banned by Admin';

    // Insert or update banned_ips
    const insRes = await query(
      `INSERT INTO banned_ips (ip_address, reason, created_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (ip_address) DO UPDATE SET reason = EXCLUDED.reason, created_at = now()
       RETURNING *`,
      [cleanIp, cleanReason, user.id]
    );

    // Log kick/ban event in activity logs
    await query(
      `INSERT INTO activity_logs (user_id, event_type, ip_address, metadata)
       VALUES ($1, 'ip_kicked_banned', $2, $3)`,
      [user.id, cleanIp, JSON.stringify({ reason: cleanReason, banned_by: user.id })]
    );

    // Sync in-memory perimeter cache
    await syncBannedIpsCache();

    return res.status(201).json({
      success: true,
      message: `IP ${cleanIp} has been kicked and banned successfully.`,
      bannedIp: insRes.rows[0],
    });
  } catch (err: any) {
    console.error('Ban IP error:', err);
    return res.status(500).json({ error: err.message || 'Failed to ban IP address' });
  }
});

// DELETE /api/banned-ips/:id (Unban IP by ID)
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user!;

    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized: Admin access required' });
    }

    const delRes = await query('DELETE FROM banned_ips WHERE id = $1 RETURNING *', [id]);
    if (delRes.rows.length === 0) {
      return res.status(404).json({ error: 'Banned IP record not found' });
    }

    const unbanned = delRes.rows[0];
    await query(
      `INSERT INTO activity_logs (user_id, event_type, ip_address, metadata)
       VALUES ($1, 'ip_unbanned', $2, $3)`,
      [user.id, unbanned.ip_address, JSON.stringify({ unbanned_by: user.id })]
    );

    await syncBannedIpsCache();

    return res.json({ success: true, message: `IP ${unbanned.ip_address} has been unbanned.` });
  } catch (err: any) {
    console.error('Unban IP error:', err);
    return res.status(500).json({ error: err.message || 'Failed to unban IP address' });
  }
});

// DELETE /api/banned-ips/ip/:ip (Unban IP by IP string)
router.delete('/ip/:ip', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { ip } = req.params;
    const user = req.user!;

    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized: Admin access required' });
    }

    const delRes = await query('DELETE FROM banned_ips WHERE ip_address = $1 RETURNING *', [ip.trim()]);
    if (delRes.rows.length === 0) {
      return res.status(404).json({ error: 'Banned IP record not found' });
    }

    await syncBannedIpsCache();

    return res.json({ success: true, message: `IP ${ip} has been unbanned.` });
  } catch (err: any) {
    console.error('Unban IP string error:', err);
    return res.status(500).json({ error: err.message || 'Failed to unban IP address' });
  }
});

export default router;
