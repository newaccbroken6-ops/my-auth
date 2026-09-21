import { Router, Request, Response } from 'express';
import { query } from '../db.js';
import { authenticateToken, AuthRequest } from '../auth.js';

const router = Router();
const serverStartTime = Date.now();

// GET /api/stats/dashboard
router.get('/dashboard', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const isAdmin = user.role === 'admin';

    const filterClause = isAdmin ? '' : `WHERE owner_id = '${user.id}'`;
    const appFilterClause = isAdmin ? '' : `WHERE owner_id = '${user.id}'`;
    const logFilterClause = isAdmin ? '' : `WHERE user_id = '${user.id}' OR app_id IN (SELECT id FROM applications WHERE owner_id = '${user.id}')`;

    const [
      totalLicRes,
      activeLicRes,
      expiredLicRes,
      bannedLicRes,
      suspendedLicRes,
      totalAppsRes,
      totalLogsRes,
      recentLogsRes,
    ] = await Promise.all([
      query(`SELECT count(*)::int as count FROM licenses ${filterClause}`),
      query(`SELECT count(*)::int as count FROM licenses ${filterClause ? `${filterClause} AND` : 'WHERE'} status = 'active'`),
      query(`SELECT count(*)::int as count FROM licenses ${filterClause ? `${filterClause} AND` : 'WHERE'} status = 'expired'`),
      query(`SELECT count(*)::int as count FROM licenses ${filterClause ? `${filterClause} AND` : 'WHERE'} status = 'banned'`),
      query(`SELECT count(*)::int as count FROM licenses ${filterClause ? `${filterClause} AND` : 'WHERE'} status = 'suspended'`),
      query(`SELECT count(*)::int as count FROM applications ${appFilterClause}`),
      query(`SELECT count(*)::int as count FROM activity_logs ${logFilterClause}`),
      query(`
        SELECT created_at 
        FROM activity_logs 
        ${logFilterClause}
        ORDER BY created_at DESC 
        LIMIT 200
      `),
    ]);

    const totalLicenses = totalLicRes.rows[0]?.count ?? 0;
    const activeLicenses = activeLicRes.rows[0]?.count ?? 0;
    const expiredLicenses = expiredLicRes.rows[0]?.count ?? 0;
    const bannedLicenses = bannedLicRes.rows[0]?.count ?? 0;
    const suspendedLicenses = suspendedLicRes.rows[0]?.count ?? 0;
    const totalApps = totalAppsRes.rows[0]?.count ?? 0;
    const totalLogs = totalLogsRes.rows[0]?.count ?? 0;

    // Group logs by day (last 7 days)
    const days: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days[d.toISOString().slice(0, 10)] = 0;
    }
    (recentLogsRes.rows || []).forEach((log: any) => {
      const day = new Date(log.created_at).toISOString().slice(0, 10);
      if (day in days) days[day]++;
    });

    return res.json({
      totalLicenses,
      activeLicenses,
      expiredLicenses,
      bannedLicenses,
      suspendedLicenses,
      totalApps,
      totalLogs,
      recentLogs: Object.entries(days).map(([date, count]) => ({
        date: date.slice(5),
        count,
      })),
      statusBreakdown: [
        { name: 'Active', value: activeLicenses, color: '#06b6d4' },
        { name: 'Expired', value: expiredLicenses, color: '#6b7280' },
        { name: 'Banned', value: bannedLicenses, color: '#ef4444' },
        { name: 'Suspended', value: suspendedLicenses, color: '#f59e0b' },
      ].filter(s => s.value > 0),
    });
  } catch (err: any) {
    console.error('Dashboard stats error:', err);
    return res.status(500).json({ error: err.message || 'Failed to fetch dashboard stats' });
  }
});

// GET /api/stats/monitor
router.get('/monitor', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const isAdmin = user.role === 'admin';

    const appSql = isAdmin
      ? `SELECT a.id, a.name, a.owner_id, a.is_active, p.username as owner_username, p.email as owner_email
         FROM applications a
         LEFT JOIN profiles p ON a.owner_id = p.id
         ORDER BY a.name`
      : `SELECT a.id, a.name, a.owner_id, a.is_active, p.username as owner_username, p.email as owner_email
         FROM applications a
         LEFT JOIN profiles p ON a.owner_id = p.id
         WHERE a.owner_id = $1
         ORDER BY a.name`;

    const appParams = isAdmin ? [] : [user.id];
    const appsRes = await query(appSql, appParams);

    const appsWithActivity = await Promise.all(
      appsRes.rows.map(async (app: any) => {
        const [
          totalLic,
          activeLic,
          todayLogs,
          weekLogs,
          lastLog,
          uniqueIPs,
          uniqueHWIDs,
        ] = await Promise.all([
          query('SELECT count(*)::int as count FROM licenses WHERE app_id = $1', [app.id]),
          query("SELECT count(*)::int as count FROM licenses WHERE app_id = $1 AND status = 'active'", [app.id]),
          query("SELECT count(*)::int as count FROM activity_logs WHERE app_id = $1 AND created_at >= now() - interval '24 hours'", [app.id]),
          query("SELECT count(*)::int as count FROM activity_logs WHERE app_id = $1 AND created_at >= now() - interval '7 days'", [app.id]),
          query('SELECT created_at FROM activity_logs WHERE app_id = $1 ORDER BY created_at DESC LIMIT 1', [app.id]),
          query("SELECT count(DISTINCT ip_address)::int as count FROM activity_logs WHERE app_id = $1 AND ip_address IS NOT NULL AND created_at >= now() - interval '24 hours'", [app.id]),
          query("SELECT count(DISTINCT hwid)::int as count FROM activity_logs WHERE app_id = $1 AND hwid IS NOT NULL AND created_at >= now() - interval '24 hours'", [app.id]),
        ]);

        return {
          app_id: app.id,
          app_name: app.name,
          owner: app.owner_username || app.owner_email || 'Unknown',
          total_licenses: totalLic.rows[0]?.count ?? 0,
          active_licenses: activeLic.rows[0]?.count ?? 0,
          api_calls_today: todayLogs.rows[0]?.count ?? 0,
          api_calls_week: weekLogs.rows[0]?.count ?? 0,
          last_activity: lastLog.rows[0]?.created_at || null,
          is_active: app.is_active,
          unique_ips: uniqueIPs.rows[0]?.count ?? 0,
          unique_hwids: uniqueHWIDs.rows[0]?.count ?? 0,
        };
      })
    );

    // Live Activity (last 50 logs)
    const logSql = isAdmin
      ? `SELECT l.id, l.app_id, l.event_type, l.ip_address, l.hwid, l.created_at, a.name as app_name
         FROM activity_logs l
         LEFT JOIN applications a ON l.app_id = a.id
         ORDER BY l.created_at DESC
         LIMIT 50`
      : `SELECT l.id, l.app_id, l.event_type, l.ip_address, l.hwid, l.created_at, a.name as app_name
         FROM activity_logs l
         LEFT JOIN applications a ON l.app_id = a.id
         WHERE l.user_id = $1 OR a.owner_id = $1
         ORDER BY l.created_at DESC
         LIMIT 50`;

    const liveLogsRes = await query(logSql, isAdmin ? [] : [user.id]);

    const liveActivity = liveLogsRes.rows.map((log: any) => ({
      id: log.id,
      app_name: log.app_name || 'Unknown',
      event_type: log.event_type,
      ip_address: log.ip_address,
      hwid: log.hwid,
      created_at: log.created_at,
    }));

    return res.json({
      apps: appsWithActivity,
      liveActivity,
    });
  } catch (err: any) {
    console.error('Monitor stats error:', err);
    return res.status(500).json({ error: err.message || 'Failed to fetch monitor stats' });
  }
});

// GET /api/stats/system
router.get('/system', authenticateToken, async (_req: AuthRequest, res: Response) => {
  try {
    const startQuery = Date.now();
    
    // Get table row counts
    const [
      usersCount,
      licCount,
      appCount,
      logsCount,
      hwidCount,
      versionsCount,
      recentLogs,
      recentUsers,
      recentLicenses,
      recentApps,
    ] = await Promise.all([
      query('SELECT count(*)::int as count FROM profiles'),
      query('SELECT count(*)::int as count FROM licenses'),
      query('SELECT count(*)::int as count FROM applications'),
      query('SELECT count(*)::int as count FROM activity_logs'),
      query('SELECT count(*)::int as count FROM hwid_bindings'),
      query('SELECT count(*)::int as count FROM app_versions'),
      query("SELECT created_at FROM activity_logs WHERE created_at >= now() - interval '24 hours' ORDER BY created_at DESC"),
      query("SELECT count(*)::int as count FROM profiles WHERE created_at >= now() - interval '7 days'"),
      query("SELECT count(*)::int as count FROM licenses WHERE created_at >= now() - interval '7 days'"),
      query("SELECT count(*)::int as count FROM applications WHERE created_at >= now() - interval '7 days'"),
    ]);

    const avgQueryTime = Date.now() - startQuery;

    // Calculate hourly activity for last 24h
    const hourlyActivity: Record<string, number> = {};
    for (let i = 23; i >= 0; i--) {
      const hour = new Date(Date.now() - i * 60 * 60 * 1000).getHours();
      hourlyActivity[hour.toString().padStart(2, '0')] = 0;
    }
    (recentLogs.rows || []).forEach((log: any) => {
      const hour = new Date(log.created_at).getHours().toString().padStart(2, '0');
      if (hour in hourlyActivity) hourlyActivity[hour]++;
    });

    const totalUsers = usersCount.rows[0]?.count ?? 0;
    const totalLicenses = licCount.rows[0]?.count ?? 0;
    const totalApps = appCount.rows[0]?.count ?? 0;
    const totalLogs = logsCount.rows[0]?.count ?? 0;
    const totalHwid = hwidCount.rows[0]?.count ?? 0;
    const totalVersions = versionsCount.rows[0]?.count ?? 0;

    const avgRowSize = {
      profiles: 500,
      licenses: 400,
      applications: 600,
      activity_logs: 300,
      hwid_bindings: 200,
      app_versions: 450,
    };

    const tables = [
      { name: 'profiles', rows: totalUsers, size: `${((totalUsers * avgRowSize.profiles) / 1024).toFixed(2)} KB` },
      { name: 'licenses', rows: totalLicenses, size: `${((totalLicenses * avgRowSize.licenses) / 1024).toFixed(2)} KB` },
      { name: 'applications', rows: totalApps, size: `${((totalApps * avgRowSize.applications) / 1024).toFixed(2)} KB` },
      { name: 'activity_logs', rows: totalLogs, size: `${((totalLogs * avgRowSize.activity_logs) / 1024).toFixed(2)} KB` },
      { name: 'hwid_bindings', rows: totalHwid, size: `${((totalHwid * avgRowSize.hwid_bindings) / 1024).toFixed(2)} KB` },
      { name: 'app_versions', rows: totalVersions, size: `${((totalVersions * avgRowSize.app_versions) / 1024).toFixed(2)} KB` },
    ];

    const totalBytesUsed = tables.reduce((sum, t) => sum + t.rows * (avgRowSize[t.name as keyof typeof avgRowSize] || 300), 0);
    const totalBytesLimit = 500 * 1024 * 1024; // 500 MB quota
    const remainingBytes = Math.max(0, totalBytesLimit - totalBytesUsed);
    const usagePercentage = (totalBytesUsed / totalBytesLimit) * 100;

    const uptimeMs = Date.now() - serverStartTime;
    const hours = Math.floor(uptimeMs / (1000 * 60 * 60));
    const minutes = Math.floor((uptimeMs % (1000 * 60 * 60)) / (1000 * 60));
    const uptimeStr = `${hours}h ${minutes}m`;

    return res.json({
      database: {
        totalRows: totalUsers + totalLicenses + totalApps + totalLogs + totalHwid + totalVersions,
        totalSize: `${(totalBytesUsed / 1024).toFixed(2)} KB`,
        usedBytes: totalBytesUsed,
        totalBytes: totalBytesLimit,
        remainingBytes,
        usagePercentage,
        tables,
      },
      performance: {
        avgQueryTime,
        requestsToday: recentLogs.rows.length,
        uptime: uptimeStr,
      },
      usage: {
        activeUsers: totalUsers,
        totalUsers,
        apiCallsToday: recentLogs.rows.length,
        apiCallsWeek: totalLogs,
      },
      growth: {
        usersThisWeek: recentUsers.rows[0]?.count ?? 0,
        licensesThisWeek: recentLicenses.rows[0]?.count ?? 0,
        appsThisWeek: recentApps.rows[0]?.count ?? 0,
      },
      recentActivity: Object.entries(hourlyActivity).map(([hour, count]) => ({
        hour: `${hour}:00`,
        count,
      })),
    });
  } catch (err: any) {
    console.error('System stats error:', err);
    return res.status(500).json({ error: err.message || 'Failed to fetch system stats' });
  }
});

// GET /api/stats/ping-db (for Terminal page DB latency test)
router.get('/ping-db', async (_req: Request, res: Response) => {
  const start = Date.now();
  try {
    await query('SELECT 1 as ping');
    const ping = Date.now() - start;
    return res.json({ status: 'connected', ping });
  } catch (err: any) {
    return res.status(500).json({ status: 'disconnected', error: err.message });
  }
});

// GET /api/stats/ping-api (for Terminal page API latency test)
router.get('/ping-api', (_req: Request, res: Response) => {
  return res.json({ status: 'connected', ping: 1 });
});

export default router;
