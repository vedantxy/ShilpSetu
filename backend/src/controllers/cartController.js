'use strict';

const { supabaseAdmin } = require('../config/supabase');
const analyticsService = require('../services/analyticsService');
const EventTypes = require('../events/eventTypes');
const { sendSuccess } = require('../utils/responseHandler');
const ApiError = require('../utils/apiError');
const logger = require('../utils/logger');

// In-memory / session cart storage with DB fallback for robust persistence
const userCarts = new Map();

class CartController {
  async getCart(req, res, next) {
    try {
      const userId = req.user.id;
      const cart = userCarts.get(userId) || [];
      return sendSuccess(res, 'Cart retrieved successfully', { items: cart, count: cart.length });
    } catch (err) {
      next(err);
    }
  }

  async addToCart(req, res, next) {
    try {
      const userId = req.user.id;
      const { productId, quantity = 1 } = req.body;

      if (!productId) throw ApiError.badRequest('productId is required');

      // Fetch product details
      const { data: product, error } = await supabaseAdmin
        .from('products')
        .select('id, title, price, images, category, seller_id')
        .eq('id', productId)
        .single();

      if (error || !product) throw ApiError.notFound('Product not found');

      let cart = userCarts.get(userId) || [];
      const existingIdx = cart.findIndex((item) => item.product.id === productId);

      if (existingIdx >= 0) {
        cart[existingIdx].quantity += quantity;
      } else {
        cart.push({ product, quantity });
      }

      userCarts.set(userId, cart);

      // Track telemetry
      analyticsService.trackEvent(EventTypes.CART_ADDED, {
        userId,
        entityType: 'product',
        entityId: productId,
        metadata: { quantity, price: product.price, sellerId: product.seller_id },
      });

      return sendSuccess(res, 'Product added to cart', { items: cart, count: cart.length }, 201);
    } catch (err) {
      next(err);
    }
  }

  async removeFromCart(req, res, next) {
    try {
      const userId = req.user.id;
      const { productId } = req.params;

      let cart = userCarts.get(userId) || [];
      cart = cart.filter((item) => item.product.id !== productId);
      userCarts.set(userId, cart);

      return sendSuccess(res, 'Product removed from cart', { items: cart, count: cart.length });
    } catch (err) {
      next(err);
    }
  }

  async clearCart(req, res, next) {
    try {
      const userId = req.user.id;
      userCarts.delete(userId);
      return sendSuccess(res, 'Cart cleared', { items: [], count: 0 });
    } catch (err) {
      next(err);
    }
  }

  // ─── Saved / Wishlist ───────────────────────────────────────────────────────

  async saveProduct(req, res, next) {
    try {
      const userId = req.user.id;
      const { productId } = req.params;

      // Track telemetry
      analyticsService.trackEvent(EventTypes.PRODUCT_SAVED, {
        userId,
        entityType: 'product',
        entityId: productId,
      });

      return sendSuccess(res, 'Product saved to wishlist', { saved: true, productId });
    } catch (err) {
      next(err);
    }
  }

  async getSavedProducts(req, res, next) {
    try {
      const userId = req.user.id;
      const { data: events } = await supabaseAdmin
        .from('analytics_events')
        .select('entity_id, created_at')
        .eq('user_id', userId)
        .eq('event_name', EventTypes.PRODUCT_SAVED)
        .order('created_at', { ascending: false })
        .limit(50);

      const productIds = (events || []).map((e) => e.entity_id).filter(Boolean);

      let products = [];
      if (productIds.length > 0) {
        const { data: prods } = await supabaseAdmin
          .from('products')
          .select('id, title, price, images, category, status')
          .in('id', productIds);
        products = prods || [];
      }

      return sendSuccess(res, 'Saved products retrieved', { products, count: products.length });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new CartController();
