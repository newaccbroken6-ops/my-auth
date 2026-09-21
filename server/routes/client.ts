import { Router, Request, Response } from 'express';
import { query } from '../db.js';

const router = Router();

const RATE_LIMIT_WINDOW_SECONDS = 60;
const RATE_LIMIT_MAX_REQUESTS = 10;

// POST /validate-license (also handles /api/v1/validate-license)
export async function handleValidateLicense(req: Request, res: Response) {
  try {
    const { license_key, hwid, app_id } = req.body;
    const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

    if (!license_key || !app_id) {
      return res.status(400).json({ valid: false, message: 'Missing license_key or app_id' });
    }

    // Rate limiting by IP
    const windowStart = new Date(
      Math.floor(Date.now() / (RATE_LIMIT_WINDOW_SECONDS * 1000)) * RATE_LIMIT_WINDOW_SECONDS * 1000
    ).toISOString();

    const rlRes = await query(
      `SELECT id, request_count FROM rate_limit_log 
       WHERE identifier = $1 AND endpoint = 'validate' AND window_start = $2`,
      [ip, windowStart]
    );

    if (rlRes.rows.length > 0) {
      const rl = rlRes.rows[0];
      if (rl.request_count >= RATE_LIMIT_MAX_REQUESTS) {
        await query(
          `INSERT INTO activity_logs (app_id, event_type, ip_address, hwid, metadata)
           VALUES ($1, 'rate_limited', $2, $3, $4)`,
          [app_id, ip, hwid || null, JSON.stringify({ license_key })]
        );
        return res.status(429).json({ valid: false, message: 'Rate limit exceeded. Try again later.' });
      }
      await query('UPDATE rate_limit_log SET request_count = request_count + 1 WHERE id = $1', [rl.id]);
    } else {
      await query(
        `INSERT INTO rate_limit_log (identifier, endpoint, window_start, request_count)
         VALUES ($1, 'validate', $2, 1)`,
        [ip, windowStart]
      );
    }

    // Fetch license
    const licRes = await query(
      `SELECT id, status, license_type, expires_at, app_id 
       FROM licenses 
       WHERE license_key = $1 AND app_id = $2`,
      [license_key, app_id]
    );

    if (licRes.rows.length === 0) {
      await query(
        `INSERT INTO activity_logs (app_id, event_type, ip_address, hwid, metadata)
         VALUES ($1, 'invalid_key', $2, $3, $4)`,
        [app_id, ip, hwid || null, JSON.stringify({ license_key })]
      );
      return res.status(200).json({ valid: false, message: 'Invalid license key' });
    }

    const license = licRes.rows[0];

    // Check expiry
    if (license.license_type !== 'lifetime' && license.expires_at) {
      if (new Date(license.expires_at) < new Date()) {
        await query("UPDATE licenses SET status = 'expired' WHERE id = $1", [license.id]);
        await query(
          `INSERT INTO activity_logs (license_id, app_id, event_type, ip_address, hwid)
           VALUES ($1, $2, 'expired', $3, $4)`,
          [license.id, app_id, ip, hwid || null]
        );
        return res.status(200).json({ valid: false, message: 'License has expired' });
      }
    }

    if (license.status !== 'active') {
      await query(
        `INSERT INTO activity_logs (license_id, app_id, event_type, ip_address, hwid)
         VALUES ($1, $2, $3, $4, $5)`,
        [license.id, app_id, `status_${license.status}`, ip, hwid || null]
      );
      return res.status(200).json({ valid: false, message: `License is ${license.status}` });
    }

    // HWID binding
    if (hwid) {
      const bindingRes = await query('SELECT id, hwid FROM hwid_bindings WHERE license_id = $1', [license.id]);
      if (bindingRes.rows.length > 0) {
        const binding = bindingRes.rows[0];
        if (binding.hwid && binding.hwid !== hwid) {
          await query(
            `INSERT INTO activity_logs (license_id, app_id, event_type, ip_address, hwid, metadata)
             VALUES ($1, $2, 'hwid_mismatch', $3, $4, $5)`,
            [license.id, app_id, ip, hwid, JSON.stringify({ bound_hwid: binding.hwid })]
          );
          return res.status(200).json({
            valid: false,
            message: 'HWID mismatch. License is bound to a different device.',
          });
        } else if (!binding.hwid) {
          await query('UPDATE hwid_bindings SET hwid = $1 WHERE id = $2', [hwid, binding.id]);
        }
      } else {
        await query('INSERT INTO hwid_bindings (license_id, hwid) VALUES ($1, $2)', [license.id, hwid]);
      }
    }

    await query(
      `INSERT INTO activity_logs (license_id, app_id, event_type, ip_address, hwid, metadata)
       VALUES ($1, $2, 'validate_success', $3, $4, $5)`,
      [license.id, app_id, ip, hwid || null, JSON.stringify({ license_type: license.license_type })]
    );

    return res.status(200).json({
      valid: true,
      message: 'License is valid',
      license_type: license.license_type,
      expires_at: license.expires_at,
    });
  } catch (err: any) {
    console.error('Validate license error:', err);
    return res.status(500).json({ valid: false, message: 'Internal error', error: err.message });
  }
}

// GET or POST /latest-version
export async function handleLatestVersion(req: Request, res: Response) {
  try {
    const appId = req.query.app_id || req.body.app_id;

    if (!appId) {
      return res.status(400).json({ error: 'Missing app_id' });
    }

    const versionRes = await query(
      `SELECT version, download_url, changelog, force_update, created_at 
       FROM app_versions 
       WHERE app_id = $1 AND is_latest = true 
       LIMIT 1`,
      [appId]
    );

    if (versionRes.rows.length === 0) {
      return res.status(404).json({ error: 'No latest version found for this app' });
    }

    const version = versionRes.rows[0];
    return res.status(200).json({
      version: version.version,
      download_url: version.download_url,
      changelog: version.changelog || '',
      force_update: version.force_update,
      released_at: version.created_at,
    });
  } catch (err: any) {
    console.error('Latest version error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}

router.post('/validate-license', handleValidateLicense);
router.all('/latest-version', handleLatestVersion);

export default router;
