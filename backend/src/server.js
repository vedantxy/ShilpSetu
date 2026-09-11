'use strict';

const { env, validateEnv } = require('./config/env');
const logger = require('./utils/logger');

// Validate environment variables before anything else
validateEnv();

const createApp = require('./app');

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`
  ╔═══════════════════════════════════════╗
  ║         ShilpSetu API Server          ║
  ╠═══════════════════════════════════════╣
  ║  Port        : ${String(env.PORT).padEnd(22)}║
  ║  Environment : ${env.NODE_ENV.padEnd(22)}║
  ║  Health      : /health${' '.repeat(16)}║
  ╚═══════════════════════════════════════╝
  `);
});

// ─── Graceful shutdown ────────────────────────────────────────────────────────
function gracefulShutdown(signal) {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  server.close(() => {
    logger.info('HTTP server closed. Exiting process.');
    process.exit(0);
  });

  // Force exit after 10 seconds
  setTimeout(() => {
    logger.error('Forced exit after timeout.');
    process.exit(1);
  }, 10_000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise Rejection:', { reason, promise });
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  process.exit(1);
});

module.exports = server;
