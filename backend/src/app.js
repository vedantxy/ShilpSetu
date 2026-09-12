'use strict';

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const { env } = require('./config/env');
const router = require('./routes/index');
const errorHandler = require('./middleware/errorHandler');
const notFoundHandler = require('./middleware/notFoundHandler');
const requestId = require('./middleware/requestId');
const requestLogger = require('./middleware/requestLogger');
const sanitizeInput = require('./middleware/sanitizeInput');
const { generalLimiter } = require('./middleware/rateLimiter');
const logger = require('./utils/logger');

/**
 * Creates and configures the Express application.
 * Exported as a factory so it can be imported by tests without starting the server.
 */
function createApp() {
  const app = express();

  // ─── Trust proxy (for load balancers, rate limiting, and IP extraction) ────
  app.set('trust proxy', 1);

  // ─── Request ID (Tracing) ──────────────────────────────────────────────────
  app.use(requestId);

  // ─── Security headers (Helmet) ─────────────────────────────────────────────
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
          connectSrc: ["'self'", env.SUPABASE_URL, 'https://exp.host'],
        },
      },
      crossOriginEmbedderPolicy: false,
      hsts: env.isProduction ? { maxAge: 31536000, includeSubDomains: true } : false,
    })
  );

  // ─── CORS ─────────────────────────────────────────────────────────────────
  app.use(
    cors({
      origin: [env.FRONTEND_URL, 'http://localhost:3000', 'http://localhost:5173'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
      exposedHeaders: ['X-Request-Id'],
    })
  );

  // ─── Body parsers (strict limits) ─────────────────────────────────────────
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));

  // ─── Input Sanitization (NoSQL/SQL injection & XSS defense) ───────────────
  app.use(sanitizeInput);

  // ─── HTTP logging ─────────────────────────────────────────────────────────
  if (env.isDevelopment) {
    app.use(morgan('dev'));
  }

  // ─── Request logger (structured logging with credential redaction) ────────
  app.use(requestLogger);

  // ─── Global rate limiter ──────────────────────────────────────────────────
  app.use(generalLimiter);

  // ─── Health check (no auth required) ─────────────────────────────────────
  const healthHandler = async (_req, res) => {
    const { supabaseAdmin } = require('./config/supabase');
    let dbStatus = 'connected';

    try {
      const { error } = await supabaseAdmin.from('profiles').select('id', { head: true, count: 'exact' }).limit(1);
      if (error && error.code !== 'PGRST116') {
        dbStatus = 'degraded';
      }
    } catch {
      dbStatus = 'disconnected';
    }

    res.status(200).json({
      success: true,
      status: dbStatus === 'connected' ? 'healthy' : 'degraded',
      service: 'ShilpSetu API',
      version: '1.0.0',
      environment: env.NODE_ENV,
      uptimeSeconds: parseFloat(process.uptime().toFixed(2)),
      timestamp: new Date().toISOString(),
      dependencies: {
        database: dbStatus,
        storage: env.STORAGE_PROVIDER,
        ai: env.CATALOG_PROVIDER !== 'none' ? 'configured' : 'fallback',
        voice: env.VOICE_PROVIDER !== 'none' ? 'configured' : 'fallback',
      },
    });
  };

  app.get('/health', healthHandler);
  app.get('/api/health', healthHandler);
  app.get('/api/v1/health', healthHandler);
  app.get('/v1/health', healthHandler);

  // ─── Static Files for Local Storage Provider ─────────────────────────────
  app.use('/uploads', express.static(env.STORAGE_LOCAL_DIR));

  // ─── Initialize Domain Event Subscribers ──────────────────────────────────
  const { initializeNotificationSubscriber } = require('./events/subscribers/notificationSubscriber');
  initializeNotificationSubscriber();

  // ─── API Documentation (Swagger UI) ─────────────────────────────────────
  try {
    const swaggerUi = require('swagger-ui-express');
    const swaggerDocument = require('../docs/swagger.json');
    app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
    app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
  } catch (swaggerErr) {
    logger.warn(`Swagger UI initialization skipped: ${swaggerErr.message}`);
  }

  // ─── API Routes (Versioning support: /api, /api/v1, /v1) ─────────────────
  app.use('/api/v1', router);
  app.use('/api', router);
  app.use('/v1', router);


  // ─── 404 handler ─────────────────────────────────────────────────────────
  app.use(notFoundHandler);

  // ─── Global error handler ─────────────────────────────────────────────────
  app.use(errorHandler);

  logger.info('Express app configured with security hardening & observability');

  return app;
}

module.exports = createApp;
