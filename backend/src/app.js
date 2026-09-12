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
  app.get('/health', (_req, res) => {
    res.status(200).json({
      success: true,
      status: 'healthy',
      service: 'ShilpSetu API',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      environment: env.NODE_ENV,
    });
  });

  // ─── Static Files for Local Storage Provider ─────────────────────────────
  app.use('/uploads', express.static(env.STORAGE_LOCAL_DIR));

  // ─── Initialize Domain Event Subscribers ──────────────────────────────────
  const { initializeNotificationSubscriber } = require('./events/subscribers/notificationSubscriber');
  initializeNotificationSubscriber();

  // ─── API Routes ───────────────────────────────────────────────────────────
  app.use('/api', router);

  // ─── 404 handler ─────────────────────────────────────────────────────────
  app.use(notFoundHandler);

  // ─── Global error handler ─────────────────────────────────────────────────
  app.use(errorHandler);

  logger.info('Express app configured with security hardening & observability');

  return app;
}

module.exports = createApp;
