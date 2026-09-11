'use strict';

const eventBus = require('../eventBus');
const EventTypes = require('../eventTypes');
const notificationService = require('../../services/notificationService');
const logger = require('../../utils/logger');

/**
 * NotificationSubscriber
 * Registers event listeners for all business lifecycle events and converts them into in-app & push notifications.
 */
function initializeNotificationSubscriber() {
  logger.info('[NotificationSubscriber] Initializing domain event listeners...');

  // 1. PRODUCT_PUBLISHED
  eventBus.subscribe(EventTypes.PRODUCT_PUBLISHED, async (payload) => {
    const { sellerId, productId, productTitle } = payload;
    if (!sellerId) return;

    await notificationService.createNotification({
      userId: sellerId,
      type: 'product_published',
      title: 'Product Published! 🎉',
      message: `Your product "${productTitle || 'item'}" is now live on the ShilpSetu marketplace.`,
      data: { productId, deepLink: `/products/${productId}` },
    });
  });

  // 2. PRODUCT_REJECTED
  eventBus.subscribe(EventTypes.PRODUCT_REJECTED, async (payload) => {
    const { sellerId, productId, productTitle, reason } = payload;
    if (!sellerId) return;

    await notificationService.createNotification({
      userId: sellerId,
      type: 'product_rejected',
      title: 'Product Update Needed',
      message: `Your product "${productTitle || 'item'}" requires changes before publishing. Reason: ${reason || 'Please review moderation guidelines.'}`,
      data: { productId, reason, deepLink: `/seller/products/${productId}/edit` },
    });
  });

  // 3. ARTISAN_VERIFIED
  eventBus.subscribe(EventTypes.ARTISAN_VERIFIED, async (payload) => {
    const { artisanId, craftName } = payload;
    if (!artisanId) return;

    await notificationService.createNotification({
      userId: artisanId,
      type: 'artisan_verified',
      title: 'Artisan Profile Verified! 🌟',
      message: 'Congratulations! Your artisan profile has been verified. You can now publish handcrafted products to buyers across India.',
      data: { craftName, deepLink: '/seller/dashboard' },
    });
  });

  // 4. ARTISAN_REJECTED
  eventBus.subscribe(EventTypes.ARTISAN_REJECTED, async (payload) => {
    const { artisanId, reason } = payload;
    if (!artisanId) return;

    await notificationService.createNotification({
      userId: artisanId,
      type: 'artisan_rejected',
      title: 'Artisan Verification Update',
      message: `Your artisan verification was not approved. Reason: ${reason || 'Please provide updated documentation.'}`,
      data: { reason, deepLink: '/seller/profile' },
    });
  });

  // 5. ORDER_CREATED
  eventBus.subscribe(EventTypes.ORDER_CREATED, async (payload) => {
    const { orderId, orderNumber, sellerId, buyerId, totalAmount, itemsCount } = payload;

    // Notify Seller
    if (sellerId) {
      await notificationService.createNotification({
        userId: sellerId,
        type: 'order_created',
        title: 'New Order Received! 🛍️',
        message: `You received a new order #${orderNumber || orderId} for ₹${totalAmount?.toLocaleString('en-IN') || 0}.`,
        data: { orderId, deepLink: `/seller/orders/${orderId}` },
      });
    }

    // Notify Buyer
    if (buyerId) {
      await notificationService.createNotification({
        userId: buyerId,
        type: 'order_created',
        title: 'Order Placed Successfully! ✨',
        message: `Thank you for supporting authentic Indian craft! Order #${orderNumber || orderId} is being prepared.`,
        data: { orderId, deepLink: `/orders/${orderId}` },
      });
    }
  });

  // 6. ORDER_STATUS_UPDATED
  eventBus.subscribe(EventTypes.ORDER_STATUS_UPDATED, async (payload) => {
    const { orderId, orderNumber, buyerId, status, trackingNumber } = payload;
    if (!buyerId) return;

    let message = `Your order #${orderNumber || orderId} status has been updated to "${status}".`;
    if (status === 'shipped') {
      message = `Your craft order #${orderNumber || orderId} has been shipped! ${trackingNumber ? `Tracking: ${trackingNumber}` : ''}`;
    } else if (status === 'delivered') {
      message = `Your order #${orderNumber || orderId} has been delivered. Enjoy your handmade heritage item!`;
    }

    await notificationService.createNotification({
      userId: buyerId,
      type: 'order_updated',
      title: `Order Status: ${status.charAt(0).toUpperCase() + status.slice(1)}`,
      message,
      data: { orderId, status, trackingNumber, deepLink: `/orders/${orderId}` },
    });
  });

  // 7. PAYMENT_UPDATED
  eventBus.subscribe(EventTypes.PAYMENT_UPDATED, async (payload) => {
    const { userId, orderId, paymentStatus, amount } = payload;
    if (!userId) return;

    await notificationService.createNotification({
      userId,
      type: 'payment_updated',
      title: `Payment ${paymentStatus === 'completed' ? 'Successful' : 'Update'}`,
      message: `Payment of ₹${amount?.toLocaleString('en-IN') || 0} is ${paymentStatus}.`,
      data: { orderId, paymentStatus },
    });
  });

  // 8. INQUIRY_RECEIVED
  eventBus.subscribe(EventTypes.INQUIRY_RECEIVED, async (payload) => {
    const { sellerId, buyerName, productTitle, messageText } = payload;
    if (!sellerId) return;

    await notificationService.createNotification({
      userId: sellerId,
      type: 'inquiry',
      title: 'New Customer Inquiry 💬',
      message: `${buyerName || 'A customer'} asked about "${productTitle || 'your item'}": "${messageText?.substring(0, 80)}..."`,
      data: { ...payload, deepLink: '/seller/messages' },
    });
  });

  logger.info('[NotificationSubscriber] All domain event listeners registered.');
}

module.exports = { initializeNotificationSubscriber };
