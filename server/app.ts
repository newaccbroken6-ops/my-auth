import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import authRouter from './routes/auth.js';
import applicationsRouter from './routes/applications.js';
import licensesRouter from './routes/licenses.js';
import hwidRouter from './routes/hwid.js';
import logsRouter from './routes/logs.js';
import usersRouter from './routes/users.js';
import versionsRouter from './routes/versions.js';
import clientRouter, { handleValidateLicense, handleLatestVersion } from './routes/client.js';
import statsRouter from './routes/stats.js';

dotenv.config();

const app = express();

// Ensure upload folders exist
const uploadsDir = path.join(process.cwd(), 'uploads');
const avatarsDir = path.join(uploadsDir, 'avatars');
if (!fs.existsSync(avatarsDir)) {
  fs.mkdirSync(avatarsDir, { recursive: true });
}

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Client-Info', 'Apikey'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static upload files
app.use('/uploads', express.static(uploadsDir));

// Healthcheck
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString(), database: 'Neon PostgreSQL' });
});

// Mount API routes
app.use('/api/auth', authRouter);
app.use('/api/applications', applicationsRouter);
app.use('/api/licenses', licensesRouter);
app.use('/api/hwid', hwidRouter);
app.use('/api/logs', logsRouter);
app.use('/api/users', usersRouter);
app.use('/api/versions', versionsRouter);
app.use('/api/stats', statsRouter);
app.use('/api/v1', clientRouter);

// Public root API shortcuts for C++ client compatibility
app.post('/api/validate-license', handleValidateLicense);
app.all('/api/latest-version', handleLatestVersion);

// Supabase Functions Backward Compatibility Routes
app.post('/functions/v1/validate-license', handleValidateLicense);
app.all('/functions/v1/latest-version', handleLatestVersion);
app.use('/functions/v1/reset-hwid', hwidRouter);
app.use('/functions/v1/admin-licenses', licensesRouter);

// Root route
app.get('/api', (_req, res) => {
  res.json({
    name: 'SUPER NOVA KEYS API',
    version: '2.0.0',
    database: 'Neon PostgreSQL',
    endpoints: {
      auth: '/api/auth',
      applications: '/api/applications',
      licenses: '/api/licenses',
      hwid: '/api/hwid',
      logs: '/api/logs',
      users: '/api/users',
      versions: '/api/versions',
      stats: '/api/stats',
      client_validate: '/api/v1/validate-license',
      client_update: '/api/v1/latest-version',
    }
  });
});

// Global error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

export default app;
