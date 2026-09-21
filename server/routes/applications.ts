import { Router, Response } from 'express';
import crypto from 'crypto';
import { query } from '../db.js';
import { authenticateToken, AuthRequest } from '../auth.js';

const router = Router();

// GET /api/applications
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    let sql: string;
    let params: any[] = [];

    if (user.role === 'admin') {
      sql = `
        SELECT a.*, p.username as owner_username, p.email as owner_email 
        FROM applications a 
        LEFT JOIN profiles p ON a.owner_id = p.id 
        ORDER BY a.created_at DESC
      `;
    } else {
      sql = `
        SELECT a.*, p.username as owner_username, p.email as owner_email 
        FROM applications a 
        LEFT JOIN profiles p ON a.owner_id = p.id 
        WHERE a.owner_id = $1 
        ORDER BY a.created_at DESC
      `;
      params = [user.id];
    }

    const result = await query(sql, params);
    return res.json(result.rows);
  } catch (err: any) {
    console.error('Fetch apps error:', err);
    return res.status(500).json({ error: err.message || 'Failed to fetch applications' });
  }
});

// POST /api/applications
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, version } = req.body;
    const user = req.user!;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Application name is required' });
    }

    const apiSecret = crypto.randomBytes(32).toString('hex');
    const appVersion = version?.trim() || '1.0.0';

    const insertRes = await query(
      `INSERT INTO applications (owner_id, name, description, version, api_secret, is_active)
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING *`,
      [user.id, name.trim(), description?.trim() || null, appVersion, apiSecret]
    );

    const createdApp = insertRes.rows[0];

    // Log activity
    await query(
      `INSERT INTO activity_logs (app_id, user_id, event_type, metadata)
       VALUES ($1, $2, 'app_created', $3)`,
      [createdApp.id, user.id, JSON.stringify({ name: createdApp.name, version: createdApp.version })]
    );

    return res.status(201).json(createdApp);
  } catch (err: any) {
    console.error('Create app error:', err);
    return res.status(500).json({ error: err.message || 'Failed to create application' });
  }
});

// PUT /api/applications/:id
router.put('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, version, is_active } = req.body;
    const user = req.user!;

    // Check ownership
    const checkRes = await query('SELECT * FROM applications WHERE id = $1', [id]);
    if (checkRes.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const app = checkRes.rows[0];
    if (app.owner_id !== user.id && user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized to modify this application' });
    }

    const updates: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (name !== undefined) {
      updates.push(`name = $${idx++}`);
      params.push(name.trim());
    }
    if (description !== undefined) {
      updates.push(`description = $${idx++}`);
      params.push(description ? description.trim() : null);
    }
    if (version !== undefined) {
      updates.push(`version = $${idx++}`);
      params.push(version.trim());
    }
    if (is_active !== undefined) {
      updates.push(`is_active = $${idx++}`);
      params.push(Boolean(is_active));
    }

    if (updates.length === 0) {
      return res.json(app);
    }

    params.push(id);
    const sql = `UPDATE applications SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`;
    const updateRes = await query(sql, params);

    return res.json(updateRes.rows[0]);
  } catch (err: any) {
    console.error('Update app error:', err);
    return res.status(500).json({ error: err.message || 'Failed to update application' });
  }
});

// DELETE /api/applications/:id
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user!;

    const checkRes = await query('SELECT * FROM applications WHERE id = $1', [id]);
    if (checkRes.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const app = checkRes.rows[0];
    if (app.owner_id !== user.id && user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized to delete this application' });
    }

    await query('DELETE FROM applications WHERE id = $1', [id]);
    return res.json({ success: true, message: 'Application deleted' });
  } catch (err: any) {
    console.error('Delete app error:', err);
    return res.status(500).json({ error: err.message || 'Failed to delete application' });
  }
});

// POST /api/applications/:id/reset-secret
router.post('/:id/reset-secret', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user!;

    const checkRes = await query('SELECT * FROM applications WHERE id = $1', [id]);
    if (checkRes.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const app = checkRes.rows[0];
    if (app.owner_id !== user.id && user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const newSecret = crypto.randomBytes(32).toString('hex');
    const updateRes = await query(
      'UPDATE applications SET api_secret = $1 WHERE id = $2 RETURNING *',
      [newSecret, id]
    );

    return res.json(updateRes.rows[0]);
  } catch (err: any) {
    console.error('Reset secret error:', err);
    return res.status(500).json({ error: err.message || 'Failed to reset API secret' });
  }
});

export default router;
