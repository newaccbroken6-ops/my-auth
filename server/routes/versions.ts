import { Router, Response } from 'express';
import { query } from '../db.js';
import { authenticateToken, AuthRequest } from '../auth.js';

const router = Router();

// GET /api/versions
router.get('/', async (req, res: Response) => {
  try {
    const { app_id } = req.query;
    let sql = 'SELECT * FROM app_versions';
    const params: any[] = [];

    if (app_id) {
      sql += ' WHERE app_id = $1';
      params.push(app_id);
    }
    sql += ' ORDER BY created_at DESC';

    const result = await query(sql, params);
    return res.json(result.rows);
  } catch (err: any) {
    console.error('Fetch versions error:', err);
    return res.status(500).json({ error: err.message || 'Failed to fetch versions' });
  }
});

// POST /api/versions
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { app_id, version, download_url, changelog, is_latest = true, force_update = false } = req.body;
    const user = req.user!;

    if (!app_id || !version || !download_url) {
      return res.status(400).json({ error: 'app_id, version, and download_url are required' });
    }

    const appRes = await query('SELECT owner_id FROM applications WHERE id = $1', [app_id]);
    if (appRes.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }

    if (appRes.rows[0].owner_id !== user.id && user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized to manage versions for this app' });
    }

    if (is_latest) {
      await query('UPDATE app_versions SET is_latest = false WHERE app_id = $1', [app_id]);
    }

    const insertRes = await query(
      `INSERT INTO app_versions (app_id, version, download_url, changelog, is_latest, force_update)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [app_id, version.trim(), download_url.trim(), changelog ? changelog.trim() : null, Boolean(is_latest), Boolean(force_update)]
    );

    return res.status(201).json(insertRes.rows[0]);
  } catch (err: any) {
    console.error('Create version error:', err);
    return res.status(500).json({ error: err.message || 'Failed to create version' });
  }
});

// PUT /api/versions/:id
router.put('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { version, download_url, changelog, is_latest, force_update } = req.body;
    const user = req.user!;

    const vRes = await query(
      `SELECT v.*, a.owner_id 
       FROM app_versions v 
       JOIN applications a ON v.app_id = a.id 
       WHERE v.id = $1`,
      [id]
    );

    if (vRes.rows.length === 0) {
      return res.status(404).json({ error: 'Version not found' });
    }

    const currentV = vRes.rows[0];
    if (currentV.owner_id !== user.id && user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (is_latest) {
      await query('UPDATE app_versions SET is_latest = false WHERE app_id = $1', [currentV.app_id]);
    }

    const updates: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (version !== undefined) {
      updates.push(`version = $${idx++}`);
      params.push(version.trim());
    }
    if (download_url !== undefined) {
      updates.push(`download_url = $${idx++}`);
      params.push(download_url.trim());
    }
    if (changelog !== undefined) {
      updates.push(`changelog = $${idx++}`);
      params.push(changelog ? changelog.trim() : null);
    }
    if (is_latest !== undefined) {
      updates.push(`is_latest = $${idx++}`);
      params.push(Boolean(is_latest));
    }
    if (force_update !== undefined) {
      updates.push(`force_update = $${idx++}`);
      params.push(Boolean(force_update));
    }

    if (updates.length === 0) {
      return res.json(currentV);
    }

    params.push(id);
    const updateRes = await query(
      `UPDATE app_versions SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      params
    );

    return res.json(updateRes.rows[0]);
  } catch (err: any) {
    console.error('Update version error:', err);
    return res.status(500).json({ error: err.message || 'Failed to update version' });
  }
});

// DELETE /api/versions/:id
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user!;

    const vRes = await query(
      `SELECT v.*, a.owner_id 
       FROM app_versions v 
       JOIN applications a ON v.app_id = a.id 
       WHERE v.id = $1`,
      [id]
    );

    if (vRes.rows.length === 0) {
      return res.status(404).json({ error: 'Version not found' });
    }

    if (vRes.rows[0].owner_id !== user.id && user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await query('DELETE FROM app_versions WHERE id = $1', [id]);
    return res.json({ success: true, message: 'Version deleted' });
  } catch (err: any) {
    console.error('Delete version error:', err);
    return res.status(500).json({ error: err.message || 'Failed to delete version' });
  }
});

export default router;
