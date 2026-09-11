'use strict';

const EventEmitter = require('events');
const logger = require('../utils/logger');

/**
 * EventBus — Centralized asynchronous domain event publisher & subscriber.
 *
 * Guarantees fault-isolation: handler errors are logged and swallowed
 * so primary business transactions are NEVER interrupted or rolled back.
 */
class EventBus extends EventEmitter {
  constructor() {
    super();
    // Allow ample listeners without warning
    this.setMaxListeners(50);
  }

  /**
   * Publish an event asynchronously.
   *
   * @param {string} eventName - One of EventTypes
   * @param {Object} payload - Event data
   */
  publish(eventName, payload) {
    logger.debug(`[EventBus] Publishing event: ${eventName}`, { eventName });
    // Run on next tick so calling handler returns immediately
    setImmediate(() => {
      this.emit(eventName, payload);
    });
  }

  /**
   * Register a subscriber to an event.
   * Handler errors are safely caught and logged.
   *
   * @param {string} eventName
   * @param {Function} handler - async (payload) => void
   */
  subscribe(eventName, handler) {
    this.on(eventName, async (payload) => {
      try {
        await handler(payload);
      } catch (err) {
        logger.error(`[EventBus] Error handling event ${eventName}: ${err.message}`, {
          error: err.stack,
          payload,
        });
      }
    });
  }
}

module.exports = new EventBus();
