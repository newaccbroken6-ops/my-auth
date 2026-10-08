import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import { originProtectionMiddleware } from './security/originProtection.js';
import { securityHeadersMiddleware } from './security/securityHeaders.js';
import { auditLoggerMiddleware } from './security/auditLogger.js';
import { wafMiddleware, syncBannedIpsCache } from './security/waf.js';
import { csrfProtectionMiddleware } from './security/authHardening.js';
import { apiRateLimiter, publicRateLimiter } from './security/rateLimiter.js';

import authRouter from './routes/auth.js';
import applicationsRouter from './routes/applications.js';
import licensesRouter from './routes/licenses.js';
import hwidRouter from './routes/hwid.js';
import logsRouter from './routes/logs.js';
import usersRouter from './routes/users.js';
import versionsRouter from './routes/versions.js';
import clientRouter, { handleValidateLicense, handleLatestVersion } from './routes/client.js';
import statsRouter from './routes/stats.js';
import bannedIpsRouter from './routes/banned-ips.js';

dotenv.config();

const app = express();

// Disable Express fingerprint
app.disable('x-powered-by');

// 1. Origin Protection & Header Sanitization (Section 4 & 5)
app.use(originProtectionMiddleware);

// 2. HTTP Security Headers & Information Exposure Mitigation (Section 12.7 & 18.3)
app.use(securityHeadersMiddleware);

// 3. Structured Logging & Correlation Tracing (Section 14)
app.use(auditLoggerMiddleware);

// 4. Request Body Parsers (Strict limits per Section 4.2: 2MB for standard JSON)
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// 5. Web Application Firewall (WAF) & Anomaly Filter (Section 8)
app.use(wafMiddleware);

// 6. CORS Hardening
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim().toLowerCase())
  : [
    'https://my-auth-kohl.vercel.app',
    'https://supernova-keys.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:3001',
  ];

app.use(
  cors({
    origin: (requestOrigin, callback) => {
      // Allow non-browser requests (e.g. mobile apps, C++ clients, curl) with no origin
      if (!requestOrigin) return callback(null, true);
      const cleanOrigin = requestOrigin.toLowerCase();
      const isAllowed = allowedOrigins.includes(cleanOrigin);
      if (isAllowed) {
        return callback(null, true);
      }
      return callback(new Error('CORS: Not allowed by policy'));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Client-Info', 'Apikey', 'X-Request-ID'],
    credentials: true,
    maxAge: 86400,
  })
);

// 7. CSRF Protection for state-changing browser requests (Section 12.3)
app.use(csrfProtectionMiddleware);

// 8. API Router with Rate Limiting (Section 10)
const apiRouter = express.Router();

// General API Rate Limiting
apiRouter.use(apiRateLimiter);

// Healthcheck (Minimal public healthcheck - Section 13.6)
apiRouter.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    time: new Date().toISOString(),
  });
});

// Mount modular sub-routers
apiRouter.use('/auth', authRouter);
apiRouter.use('/applications', applicationsRouter);
apiRouter.use('/licenses', licensesRouter);
apiRouter.use('/hwid', hwidRouter);
apiRouter.use('/logs', logsRouter);
apiRouter.use('/users', usersRouter);
apiRouter.use('/versions', versionsRouter);
apiRouter.use('/stats', statsRouter);
apiRouter.use('/banned-ips', bannedIpsRouter);
apiRouter.use('/v1', clientRouter);

// Public shortcuts
apiRouter.post('/validate-license', handleValidateLicense);
apiRouter.all('/latest-version', handleLatestVersion);

// Root informational endpoint (with public limiter)
apiRouter.get('/', publicRateLimiter, (_req, res) => {
  res.json({
    name: 'SUPER NOVA KEYS API',
    version: '2.0.0',
    security: 'Zero Trust / Defense-in-Depth',
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
    },
  });
});

// Backward compatibility routes
app.post('/functions/v1/validate-license', handleValidateLicense);
app.all('/functions/v1/latest-version', handleLatestVersion);
app.use('/functions/v1/reset-hwid', hwidRouter);
app.use('/functions/v1/admin-licenses', licensesRouter);

// Mount API router
app.use('/api', apiRouter);
app.use('/', apiRouter);

// Global Error Handler (RFC 9457 Problem Details style, no stack leakage in prod)
app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  let status = typeof err.status === 'number' ? err.status : 500;
  if (err.message && err.message.toLowerCase().includes('cors')) {
    status = 403;
  } else if (err.name === 'MulterError' || (err.message && err.message.toLowerCase().includes('allowed'))) {
    status = 400;
  }
  const requestId = (req as any).requestId || 'unknown';

  if (status >= 500) {
    console.error(`[SERVER ERROR] [${requestId}]`, err);
  }

  const isProduction = process.env.NODE_ENV === 'production';
  const message =
    isProduction && status >= 500
      ? 'Internal server error occurred. Please contact administrator with your Request ID.'
      : err.message || 'An error occurred';

  res.status(status).json({
    type: 'about:blank',
    title: status >= 500 ? 'Internal Server Error' : 'Client Error',
    status,
    detail: message,
    requestId,
  });
});

export default app;
