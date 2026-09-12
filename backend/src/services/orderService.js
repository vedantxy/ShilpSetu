'use strict';

const { supabaseAdmin } = require('../config/supabase');
const eventBus = require('../events/eventBus');
const EventTypes = require('../events/eventTypes');
const analyticsService = require('./analyticsService');
const { parsePagination, formatPagination } = require('../utils/pagination');
const ApiError = require('../utils/apiError');
const logger = require('../utils/logger');

/**
 * OrderService — Manages buyer order lifecycle, seller fulfillment, and event publishing.
 */
class OrderService {
  /**
   * Create a new order.
   *
   * @param {string} buyerId
   * @param {Object} orderData
   */
  async createOrder(buyerId, orderData) {
    const {
      productId,
      quantity = 1,
      shippingAddress = {},
      notes = '',
      paymentMethod = 'online',
    } = orderData;

    if (!productId) {
      throw ApiError.badRequest('productId is required to place an order');
    }

    // 1. Fetch product to verify availability and retrieve seller
    const { data: product, error: prodErr } = await supabaseAdmin
      .from('products')
      .select('id, title, price, seller_id, status')
      .eq('id', productId)
      .single();

    if (prodErr || !product) {
      throw ApiError.notFound('Product not found');
    }

    if (product.status !== 'published') {
      throw ApiError.badRequest('This product is not currently available for purchase');
    }

    const itemPrice = parseFloat(product.price) || 0;
    const totalAmount = itemPrice * quantity;

    // 2. Insert order record
    const { data: order, error: orderErr } = await supabaseAdmin
      .from('orders')
      .insert({
        buyer_id: buyerId,
        seller_id: product.seller_id,
        product_id: productId,
        quantity,
        amount: totalAmount,
        status: 'pending',
        payment_status: paymentMethod === 'cod' ? 'unpaid' : 'paid',
        shipping_address: shippingAddress,
        notes,
      })
      .select('*, product:products(id, title, price, images), buyer:profiles!buyer_id(id, full_name, email), seller:profiles!seller_id(id, full_name, email)')
      .single();

    if (orderErr) {
      logger.error(`Failed to create order: ${orderErr.message}`);
      throw ApiError.databaseError('Failed to place order');
    }

    // 3. Publish domain events asynchronously
    eventBus.publish(EventTypes.ORDER_CREATED, {
      orderId: order.id,
      orderNumber: order.id.substring(0, 8).toUpperCase(),
      sellerId: product.seller_id,
      buyerId,
      totalAmount,
      itemsCount: quantity,
      productTitle: product.title,
    });

    analyticsService.trackEvent(EventTypes.ORDER_CREATED, {
      userId: buyerId,
      entityType: 'order',
      entityId: order.id,
      metadata: { productId, sellerId: product.seller_id, amount: totalAmount, quantity },
    });

    return order;
  }

  /**
   * Get orders placed by a buyer.
   */
  async getBuyerOrders(buyerId, query = {}) {
    const { page, limit, offset } = parsePagination(query);

    let dbQuery = supabaseAdmin
      .from('orders')
      .select('*, product:products(id, title, price, images), seller:profiles!seller_id(id, full_name)', { count: 'exact' })
      .eq('buyer_id', buyerId);

    if (query.status) {
      dbQuery = dbQuery.eq('status', query.status);
    }

    const { data, count, error } = await dbQuery
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      logger.error(`Failed to fetch buyer orders: ${error.message}`);
      throw ApiError.databaseError('Failed to load orders');
    }

    return {
      orders: data || [],
      pagination: formatPagination(count || 0, page, limit),
    };
  }

  /**
   * Get orders received by a seller.
   */
  async getSellerOrders(sellerId, query = {}) {
    const { page, limit, offset } = parsePagination(query);

    let dbQuery = supabaseAdmin
      .from('orders')
      .select('*, product:products(id, title, price, images), buyer:profiles!buyer_id(id, full_name, email)', { count: 'exact' })
      .eq('seller_id', sellerId);

    if (query.status) {
      dbQuery = dbQuery.eq('status', query.status);
    }

    const { data, count, error } = await dbQuery
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      logger.error(`Failed to fetch seller orders: ${error.message}`);
      throw ApiError.databaseError('Failed to load seller orders');
    }

    return {
      orders: data || [],
      pagination: formatPagination(count || 0, page, limit),
    };
  }

  /**
   * Get order details by ID with authorization verification.
   */
  async getOrderById(orderId, requestingUser) {
    const { data: order, error } = await supabaseAdmin
      .from('orders')
      .select('*, product:products(id, title, price, images, category), buyer:profiles!buyer_id(id, full_name, email), seller:profiles!seller_id(id, full_name, email)')
      .eq('id', orderId)
      .single();

    if (error || !order) {
      throw ApiError.notFound('Order not found');
    }

    const isBuyer = order.buyer_id === requestingUser.id;
    const isSeller = order.seller_id === requestingUser.id;
    const isAdmin = requestingUser.role === 'admin';

    if (!isBuyer && !isSeller && !isAdmin) {
      throw ApiError.forbidden('You are not authorized to view this order');
    }

    return order;
  }

  /**
   * Cancel an order.
   */
  async cancelOrder(orderId, userId, role = 'buyer') {
    const order = await this.getOrderById(orderId, { id: userId, role });

    if (order.status === 'delivered' || order.status === 'cancelled') {
      throw ApiError.badRequest(`Cannot cancel an order that is already ${order.status}`);
    }

    const { data: updated, error } = await supabaseAdmin
      .from('orders')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', orderId)
      .select()
      .single();

    if (error) {
      throw ApiError.databaseError('Failed to cancel order');
    }

    eventBus.publish(EventTypes.ORDER_STATUS_UPDATED, {
      orderId: order.id,
      orderNumber: order.id.substring(0, 8).toUpperCase(),
      buyerId: order.buyer_id,
      status: 'cancelled',
    });

    return updated;
  }
}

module.exports = new OrderService();
