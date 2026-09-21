import { Router, Response } from 'express';
import { query } from '../db.js';
import { authenticateToken, AuthRequest } from '../auth.js';

const router = Router();
const RESET_COOLDOWN_DAYS = 30;

// GET /api/hwid/:licenseId
router.get('/:licenseId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { licenseId } = req.params;
    const result = await query('SELECT * FROM hwid_bindings WHERE license_id = $1', [licenseId]);
    return res.json(result.rows[0] || null);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch HWID binding' });
  }
});

// POST /api/hwid/reset
router.post('/reset', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { license_id } = req.body;
    const user = req.user!;

    if (!license_id) {
      return res.status(400).json({ success: false, message: 'Missing license_id' });
    }

    // Check license and owner
    const licRes = await query(
      `SELECT l.id, l.owner_id, l.app_id, a.owner_id as app_owner_id
       FROM licenses l
       JOIN applications a ON l.app_id = a.id
       WHERE l.id = $1`,
      [license_id]
    );

    if (licRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'License not found' });
    }

    const license = licRes.rows[0];
    const isAdmin = user.role === 'admin';

    if (license.owner_id !== user.id && license.app_owner_id !== user.id && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Not authorized for this license' });
    }

    // Get binding
    const bindingRes = await query('SELECT * FROM hwid_bindings WHERE license_id = $1', [license_id]);
    if (bindingRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'No HWID binding found for this license' });
    }

    const binding = bindingRes.rows[0];

    // Check cooldown for non-admin
    if (!isAdmin && binding.last_reset_at) {
      const lastReset = new Date(binding.last_reset_at);
      const cooldownEnd = new Date(lastReset.getTime() + RESET_COOLDOWN_DAYS * 24 * 60 * 60 * 1000);
      if (new Date() < cooldownEnd) {
        const daysLeft = Math.ceil((cooldownEnd.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
        return res.status(429).json({
          success: false,
          message: `HWID reset cooldown active. ${daysLeft} day(s) remaining.`,
        });
      }
    }

    const updatedResetCount = (binding.reset_count || 0) + 1;
    await query(
      `UPDATE hwid_bindings 
       SET hwid = NULL, last_reset_at = now(), reset_count = $1 
       WHERE id = $2`,
      [updatedResetCount, binding.id]
    );

    await query(
      `INSERT INTO activity_logs (license_id, user_id, app_id, event_type, metadata)
       VALUES ($1, $2, $3, 'hwid_reset', $4)`,
      [license_id, user.id, license.app_id, JSON.stringify({ reset_count: updatedResetCount, admin: isAdmin })]
    );

    return res.json({ success: true, message: 'HWID has been reset successfully.' });
  } catch (err: any) {
    console.error('HWID reset error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

export default router;
