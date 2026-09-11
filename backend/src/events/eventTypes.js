'use strict';

/**
 * Domain Event Types for ShilpSetu Event-Driven Architecture.
 */
const EventTypes = {
  // Product Lifecycle
  PRODUCT_PUBLISHED: 'product.published',
  PRODUCT_REJECTED: 'product.rejected',
  PRODUCT_FEATURED: 'product.featured',

  // Artisan Lifecycle
  ARTISAN_VERIFIED: 'artisan.verified',
  ARTISAN_REJECTED: 'artisan.rejected',
  ARTISAN_SUSPENDED: 'artisan.suspended',

  // Order Lifecycle
  ORDER_CREATED: 'order.created',
  ORDER_STATUS_UPDATED: 'order.status_updated',
  PAYMENT_UPDATED: 'payment.updated',

  // Communication & System
  INQUIRY_RECEIVED: 'inquiry.received',
  SYSTEM_ANNOUNCEMENT: 'system.announcement',
};

module.exports = EventTypes;
