import { Router, Response } from 'express';
import { query } from '../db.js';
import { authenticateToken, AuthRequest } from '../auth.js';

const router = Router();

function generateLicenseKey(customName?: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  
  if (customName) {
    return customName
      .toUpperCase()
      .replace(/[^A-Z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 50);
  }
  
  const randomSegment = Array.from({ length: 8 }, () => 
    chars[Math.floor(Math.random() * chars.length)]
  ).join('');
  
  return `SUPER-NOVA-${randomSegment}`;
}

function calculateExpiresAt(type: string): string | null {
  if (type === 'lifetime') return null;
  const d = new Date();
  if (type === 'daily') d.setDate(d.getDate() + 1);
  else if (type === 'monthly') d.setMonth(d.getMonth() + 1);
  return d.toISOString();
}

// GET /api/licenses
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const { app_id, status, search, limit = '200' } = req.query;

    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (user.role !== 'admin') {
      conditions.push(`(l.owner_id = $${idx} OR a.owner_id = $${idx})`);
      params.push(user.id);
      idx++;
    }

    if (app_id) {
      conditions.push(`l.app_id = $${idx++}`);
      params.push(app_id);
    }

    if (status && status !== 'all') {
      conditions.push(`l.status = $${idx++}`);
      params.push(status);
    }

    if (search) {
      conditions.push(`(l.license_key ILIKE $${idx} OR l.note ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `
      SELECT l.*, a.name as app_name, hb.hwid, hb.last_reset_at, hb.reset_count
      FROM licenses l
      LEFT JOIN applications a ON l.app_id = a.id
      LEFT JOIN hwid_bindings hb ON l.id = hb.license_id
      ${whereClause}
      ORDER BY l.created_at DESC
      LIMIT $${idx}
    `;
    params.push(parseInt(String(limit), 10) || 200);

    const result = await query(sql, params);
    return res.json(result.rows);
  } catch (err: any) {
    console.error('Get licenses error:', err);
    return res.status(500).json({ error: err.message || 'Failed to fetch licenses' });
  }
});

// POST /api/licenses/bulk (or generate)
router.post('/bulk', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { app_id, license_type = 'monthly', count = 1, note, custom_name } = req.body;
    const user = req.user!;

    if (!app_id) {
      return res.status(400).json({ error: 'Missing app_id' });
    }

    // Verify app ownership
    const appRes = await query('SELECT id, owner_id, name FROM applications WHERE id = $1', [app_id]);
    if (appRes.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const app = appRes.rows[0];
    if (app.owner_id !== user.id && user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized for this application' });
    }

    const appNameSegment = app.name
      .toUpperCase()
      .replace(/[^A-Z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 20);

    const generateCount = Math.min(Math.max(parseInt(String(count), 10) || 1, 1), 100);
    const createdLicenses: any[] = [];

    for (let i = 0; i < generateCount; i++) {
      let keyName: string | undefined;
      if (custom_name) {
        const customSegment = custom_name
          .toUpperCase()
          .replace(/[^A-Z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .substring(0, 20);

        if (generateCount > 1) {
          keyName = `${appNameSegment}-${customSegment}-${i + 1}`;
        } else {
          keyName = `${appNameSegment}-${customSegment}`;
        }
      }

      const licenseKey = generateLicenseKey(keyName);
      const expiresAt = calculateExpiresAt(license_type);

      const insRes = await query(
        `INSERT INTO licenses (app_id, owner_id, license_key, status, license_type, expires_at, note)
         VALUES ($1, $2, $3, 'active', $4, $5, $6)
         RETURNING *`,
        [app_id, user.id, licenseKey, license_type, expiresAt, note ? note.trim() : null]
      );

      createdLicenses.push(insRes.rows[0]);
    }

    // Log activity
    await query(
      `INSERT INTO activity_logs (app_id, user_id, event_type, metadata)
       VALUES ($1, $2, 'bulk_generate', $3)`,
      [app_id, user.id, JSON.stringify({ count: generateCount, license_type })]
    );

    return res.status(201).json({
      success: true,
      licenses: createdLicenses,
      count: createdLicenses.length,
    });
  } catch (err: any) {
    console.error('Bulk generate error:', err);
    return res.status(500).json({ error: err.message || 'Failed to generate licenses' });
  }
});

// Single create license alias
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  req.body.count = 1;
  try {
    const { app_id, license_type = 'monthly', note, custom_name } = req.body;
    const user = req.user!;

    if (!app_id) {
      return res.status(400).json({ error: 'Missing app_id' });
    }

    const appRes = await query('SELECT id, owner_id, name FROM applications WHERE id = $1', [app_id]);
    if (appRes.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const app = appRes.rows[0];
    if (app.owner_id !== user.id && user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    let keyName: string | undefined;
    if (custom_name) {
      const appNameSegment = app.name.toUpperCase().replace(/[^A-Z0-9\s-]/g, '').replace(/\s+/g, '-').substring(0, 20);
      const customSegment = custom_name.toUpperCase().replace(/[^A-Z0-9\s-]/g, '').replace(/\s+/g, '-').substring(0, 20);
      keyName = `${appNameSegment}-${customSegment}`;
    }

    const licenseKey = generateLicenseKey(keyName);
    const expiresAt = calculateExpiresAt(license_type);

    const insRes = await query(
      `INSERT INTO licenses (app_id, owner_id, license_key, status, license_type, expires_at, note)
       VALUES ($1, $2, $3, 'active', $4, $5, $6)
       RETURNING *`,
      [app_id, user.id, licenseKey, license_type, expiresAt, note ? note.trim() : null]
    );

    return res.status(201).json(insRes.rows[0]);
  } catch (err: any) {
    console.error('Create license error:', err);
    return res.status(500).json({ error: err.message || 'Failed to create license' });
  }
});

// PUT /api/licenses/:id
router.put('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, note, expires_at } = req.body;
    const user = req.user!;

    const checkRes = await query(
      `SELECT l.*, a.owner_id as app_owner_id 
       FROM licenses l 
       JOIN applications a ON l.app_id = a.id 
       WHERE l.id = $1`,
      [id]
    );

    if (checkRes.rows.length === 0) {
      return res.status(404).json({ error: 'License not found' });
    }

    const lic = checkRes.rows[0];
    if (lic.owner_id !== user.id && lic.app_owner_id !== user.id && user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const updates: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (status !== undefined) {
      updates.push(`status = $${idx++}`);
      params.push(status);
    }
    if (note !== undefined) {
      updates.push(`note = $${idx++}`);
      params.push(note ? note.trim() : null);
    }
    if (expires_at !== undefined) {
      updates.push(`expires_at = $${idx++}`);
      params.push(expires_at);
    }

    if (updates.length === 0) {
      return res.json(lic);
    }

    params.push(id);
    const updateRes = await query(
      `UPDATE licenses SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      params
    );

    if (status && status !== lic.status) {
      await query(
        `INSERT INTO activity_logs (license_id, user_id, app_id, event_type, metadata)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, user.id, lic.app_id, `license_${status}`, JSON.stringify({ previous_status: lic.status })]
      );
    }

    return res.json(updateRes.rows[0]);
  } catch (err: any) {
    console.error('Update license error:', err);
    return res.status(500).json({ error: err.message || 'Failed to update license' });
  }
});

// DELETE /api/licenses/:id
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user!;

    const checkRes = await query(
      `SELECT l.*, a.owner_id as app_owner_id 
       FROM licenses l 
       JOIN applications a ON l.app_id = a.id 
       WHERE l.id = $1`,
      [id]
    );

    if (checkRes.rows.length === 0) {
      return res.status(404).json({ error: 'License not found' });
    }

    const lic = checkRes.rows[0];
    if (lic.owner_id !== user.id && lic.app_owner_id !== user.id && user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await query('DELETE FROM licenses WHERE id = $1', [id]);
    return res.json({ success: true, message: 'License deleted' });
  } catch (err: any) {
    console.error('Delete license error:', err);
    return res.status(500).json({ error: err.message || 'Failed to delete license' });
  }
});

// POST /api/licenses/bulk-delete
router.post('/bulk-delete', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { ids, all, app_id } = req.body;
    const user = req.user!;

    if (all) {
      if (user.role === 'admin') {
        if (app_id) {
          await query('DELETE FROM licenses WHERE app_id = $1', [app_id]);
        } else {
          await query('DELETE FROM licenses');
        }
      } else {
        await query(
          `DELETE FROM licenses 
           WHERE app_id IN (SELECT id FROM applications WHERE owner_id = $1)`,
          [user.id]
        );
      }
      return res.json({ success: true, message: 'All selected licenses deleted' });
    }

    if (Array.isArray(ids) && ids.length > 0) {
      if (user.role === 'admin') {
        await query('DELETE FROM licenses WHERE id = ANY($1::uuid[])', [ids]);
      } else {
        await query(
          `DELETE FROM licenses 
           WHERE id = ANY($1::uuid[]) 
           AND app_id IN (SELECT id FROM applications WHERE owner_id = $2)`,
          [ids, user.id]
        );
      }
      return res.json({ success: true, message: `${ids.length} licenses deleted` });
    }

    return res.status(400).json({ error: 'No IDs or all flag provided' });
  } catch (err: any) {
    console.error('Bulk delete error:', err);
    return res.status(500).json({ error: err.message || 'Failed to bulk delete licenses' });
  }
});

export default router;
