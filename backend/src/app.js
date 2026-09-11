'use strict';

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const { env } = require('./config/env');
const router = require('./routes/index');
const errorHandler = require('./middleware/errorHandler');
const notFoundHandler = require('./middleware/notFoundHandler');
const requestLogger = require('./middleware/requestLogger');
const { generalLimiter } = require('./middleware/rateLimiter');
const logger = require('./utils/logger');

/**
 * Creates and configures the Express application.
 * Exported as a factory so it can be imported by tests without starting the server.
 */
function createApp() {
  const app = express();

  // ─── Security headers ──────────────────────────────────────────────────────
  app.use(helmet());

  // ─── CORS ─────────────────────────────────────────────────────────────────
  app.use(
    cors({
      origin: [env.FRONTEND_URL, 'http://localhost:3000', 'http://localhost:5173'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  // ─── Body parsers ─────────────────────────────────────────────────────────
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // ─── HTTP logging ─────────────────────────────────────────────────────────
  if (env.isDevelopment) {
    app.use(morgan('dev'));
  } else {
    app.use(morgan('combined'));
  }

  // ─── Request logger (custom structured logging) ───────────────────────────
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

  // ─── API Routes ───────────────────────────────────────────────────────────
  app.use('/api', router);

  // ─── 404 handler ─────────────────────────────────────────────────────────
  app.use(notFoundHandler);

  // ─── Global error handler ─────────────────────────────────────────────────
  app.use(errorHandler);

  logger.info('Express app configured');

  return app;
}

module.exports = createApp;
