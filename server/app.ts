import express from 'express';
import cors from 'cors';
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

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Client-Info', 'Apikey'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

const apiRouter = express.Router();

// Healthcheck
apiRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString(), database: 'Neon PostgreSQL' });
});

// Mount sub-routers on apiRouter
apiRouter.use('/auth', authRouter);
apiRouter.use('/applications', applicationsRouter);
apiRouter.use('/licenses', licensesRouter);
apiRouter.use('/hwid', hwidRouter);
apiRouter.use('/logs', logsRouter);
apiRouter.use('/users', usersRouter);
apiRouter.use('/versions', versionsRouter);
apiRouter.use('/stats', statsRouter);
apiRouter.use('/v1', clientRouter);

// Public shortcuts
apiRouter.post('/validate-license', handleValidateLicense);
apiRouter.all('/latest-version', handleLatestVersion);

// Root route
apiRouter.get('/', (_req, res) => {
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

// Supabase Functions Backward Compatibility Routes
app.post('/functions/v1/validate-license', handleValidateLicense);
app.all('/functions/v1/latest-version', handleLatestVersion);
app.use('/functions/v1/reset-hwid', hwidRouter);
app.use('/functions/v1/admin-licenses', licensesRouter);

// Mount API router on /api and root fallback
app.use('/api', apiRouter);
app.use('/', apiRouter);

// Global error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

export default app;
