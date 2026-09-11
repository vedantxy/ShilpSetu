'use strict';

const { supabaseAdmin } = require('../config/supabase');
const logger = require('../utils/logger');

/**
 * Admin Service
 *
 * Core service for admin dashboard aggregation, user management,
 * artisan management, product moderation, and order management.
 * Uses Supabase service-role client (bypasses RLS).
 */
const adminService = {
  // ═══════════════════════════════════════════════════════════════════════════
  // DASHBOARD
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Aggregate real platform-wide statistics for the admin dashboard.
   * All counts are fetched from the database — never fabricated.
   */
  async getDashboardStats() {
    // Run all independent count queries in parallel for performance
    const [
      usersResult,
      buyersResult,
      sellersResult,
      pendingArtisansResult,
      totalProductsResult,
      pendingProductsResult,
      publishedProductsResult,
      ordersResult,
      revenueResult,
      recentActivityResult,
    ] = await Promise.allSettled([
      // Total users
      supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }),

      // Buyers
      supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'buyer'),

      // Sellers
      supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'seller'),

      // Artisans pending verification
      supabaseAdmin
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('verification_status', 'pending'),

      // Total products
      supabaseAdmin.from('products').select('*', { count: 'exact', head: true }),

      // Pending review products
      supabaseAdmin
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending_review'),

      // Published products
      supabaseAdmin
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'published'),

      // Total orders
      supabaseAdmin.from('orders').select('*', { count: 'exact', head: true }),

      // Revenue (SUM of paid orders)
      supabaseAdmin
        .from('orders')
        .select('amount')
        .eq('payment_status', 'paid'),

      // Recent audit log activity (last 10 actions)
      supabaseAdmin
        .from('audit_logs')
        .select('id, action, target_type, target_id, created_at, profiles!audit_logs_admin_id_fkey(full_name)')
        .order('created_at', { ascending: false })
        .limit(10),
    ]);

    // Helper to safely extract count from settled result
    const safeCount = (result) => {
      if (result.status === 'fulfilled' && !result.value.error) {
        return result.value.count || 0;
      }
      if (result.status === 'fulfilled' && result.value.error) {
        logger.warn(`Dashboard count query failed: ${result.value.error.message}`);
      }
      return 0;
    };

    // Compute revenue from rows (Supabase doesn't support SUM directly via JS client)
    let revenue = 0;
    if (revenueResult.status === 'fulfilled' && !revenueResult.value.error) {
      revenue = (revenueResult.value.data || []).reduce(
        (sum, row) => sum + (Number(row.amount) || 0),
        0
      );
    }

    const recentActivity =
      recentActivityResult.status === 'fulfilled' && !recentActivityResult.value.error
        ? recentActivityResult.value.data || []
        : [];

    return {
      users: safeCount(usersResult),
      buyers: safeCount(buyersResult),
      sellers: safeCount(sellersResult),
      pendingArtisans: safeCount(pendingArtisansResult),
      products: safeCount(totalProductsResult),
      pendingProducts: safeCount(pendingProductsResult),
      publishedProducts: safeCount(publishedProductsResult),
      orders: safeCount(ordersResult),
      revenue: parseFloat(revenue.toFixed(2)),
      recentActivity,
    };
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // USER MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * List all users with pagination and optional role/status filters.
   */
  async getUsers({ page = 1, limit = 20, role, status, search } = {}) {
    const offset = (page - 1) * limit;
    let query = supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (role) query = query.eq('role', role);
    if (status) query = query.eq('status', status);
    if (search) query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);

    const { data, error, count } = await query.range(offset, offset + limit - 1);

    if (error) {
      logger.error(`Admin user list failed: ${error.message}`);
      throw error;
    }

    return { data, count, page, limit };
  },

  /**
   * Get a single user profile by ID.
   */
  async getUserById(userId) {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      logger.error(`Admin get user ${userId} failed: ${error.message}`);
      throw error;
    }

    return data;
  },

  /**
   * Update a user's account status.
   * Allowed statuses: active | suspended | deactivated
   */
  async updateUserStatus(userId, status) {
    const ALLOWED_STATUSES = ['active', 'suspended', 'deactivated'];
    if (!ALLOWED_STATUSES.includes(status)) {
      const err = new Error(`Invalid status. Allowed: ${ALLOWED_STATUSES.join(', ')}`);
      err.statusCode = 400;
      throw err;
    }

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      logger.error(`User status update failed for ${userId}: ${error.message}`);
      throw error;
    }

    return data;
  },

  /**
   * Update a user's role.
   * Highly protected — only admin can call this, and an admin cannot change their own role.
   * Allowed roles: buyer | seller | admin
   */
  async updateUserRole(userId, role, requestingAdminId) {
    const ALLOWED_ROLES = ['buyer', 'seller', 'admin'];
    if (!ALLOWED_ROLES.includes(role)) {
      const err = new Error(`Invalid role. Allowed: ${ALLOWED_ROLES.join(', ')}`);
      err.statusCode = 400;
      throw err;
    }

    // Self-demotion guard — an admin cannot change their own role
    if (userId === requestingAdminId) {
      const err = new Error('Admins cannot change their own role');
      err.statusCode = 403;
      throw err;
    }

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update({ role, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      logger.error(`User role update failed for ${userId}: ${error.message}`);
      throw error;
    }

    return data;
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ARTISAN MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * List artisans (role=seller) with optional verification_status filter.
   */
  async getArtisans({ page = 1, limit = 20, verificationStatus, search } = {}) {
    const offset = (page - 1) * limit;
    let query = supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact' })
      .eq('role', 'seller')
      .order('created_at', { ascending: false });

    if (verificationStatus) query = query.eq('verification_status', verificationStatus);
    if (search) query = query.ilike('full_name', `%${search}%`);

    const { data, error, count } = await query.range(offset, offset + limit - 1);

    if (error) {
      logger.error(`Admin artisan list failed: ${error.message}`);
      throw error;
    }

    return { data, count, page, limit };
  },

  /**
   * Get a single artisan profile by ID (must be a seller).
   */
  async getArtisanById(artisanId) {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('*, products(id, title, status, price, created_at)')
      .eq('id', artisanId)
      .eq('role', 'seller')
      .single();

    if (error) {
      logger.error(`Admin get artisan ${artisanId} failed: ${error.message}`);
      throw error;
    }

    return data;
  },

  /**
   * Verify an artisan — sets is_verified=true, verification_status=approved.
   */
  async verifyArtisan(artisanId) {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update({
        is_verified: true,
        verification_status: 'approved',
        updated_at: new Date().toISOString(),
      })
      .eq('id', artisanId)
      .select()
      .single();

    if (error) {
      logger.error(`Artisan verify failed for ${artisanId}: ${error.message}`);
      throw error;
    }

    return data;
  },

  /**
   * Reject an artisan's verification.
   */
  async rejectArtisan(artisanId, reason = null) {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update({
        is_verified: false,
        verification_status: 'rejected',
        rejection_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', artisanId)
      .select()
      .single();

    if (error) {
      logger.error(`Artisan reject failed for ${artisanId}: ${error.message}`);
      throw error;
    }

    return data;
  },

  /**
   * Suspend an artisan.
   */
  async suspendArtisan(artisanId, reason = null) {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update({
        status: 'suspended',
        suspension_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', artisanId)
      .select()
      .single();

    if (error) {
      logger.error(`Artisan suspend failed for ${artisanId}: ${error.message}`);
      throw error;
    }

    return data;
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PRODUCT MODERATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get all products with full seller info and optional filters.
   */
  async getProducts({ page = 1, limit = 20, status, search, sellerId } = {}) {
    const offset = (page - 1) * limit;
    let query = supabaseAdmin
      .from('products')
      .select(
        `*, profiles!products_seller_id_fkey(id, full_name, email, is_verified)`,
        { count: 'exact' }
      )
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);
    if (sellerId) query = query.eq('seller_id', sellerId);
    if (search) query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);

    const { data, error, count } = await query.range(offset, offset + limit - 1);

    if (error) {
      logger.error(`Admin product list failed: ${error.message}`);
      throw error;
    }

    return { data, count, page, limit };
  },

  /**
   * Get products awaiting moderation (status=pending_review).
   */
  async getPendingProducts({ page = 1, limit = 20 } = {}) {
    return this.getProducts({ page, limit, status: 'pending_review' });
  },

  /**
   * Approve a product — sets status to 'published'.
   */
  async approveProduct(productId) {
    const { data, error } = await supabaseAdmin
      .from('products')
      .update({ status: 'published', updated_at: new Date().toISOString() })
      .eq('id', productId)
      .select()
      .single();

    if (error) {
      logger.error(`Product approve failed for ${productId}: ${error.message}`);
      throw error;
    }

    return data;
  },

  /**
   * Reject a product — sets status to 'rejected' and stores the reason.
   */
  async rejectProduct(productId, reason) {
    const { data, error } = await supabaseAdmin
      .from('products')
      .update({
        status: 'rejected',
        rejection_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', productId)
      .select()
      .single();

    if (error) {
      logger.error(`Product reject failed for ${productId}: ${error.message}`);
      throw error;
    }

    return data;
  },

  /**
   * Archive a product — sets status to 'archived'.
   */
  async archiveProduct(productId) {
    const { data, error } = await supabaseAdmin
      .from('products')
      .update({ status: 'archived', updated_at: new Date().toISOString() })
      .eq('id', productId)
      .select()
      .single();

    if (error) {
      logger.error(`Product archive failed for ${productId}: ${error.message}`);
      throw error;
    }

    return data;
  },

  /**
   * Feature a product — sets is_featured=true.
   */
  async featureProduct(productId) {
    const { data, error } = await supabaseAdmin
      .from('products')
      .update({ is_featured: true, updated_at: new Date().toISOString() })
      .eq('id', productId)
      .select()
      .single();

    if (error) {
      logger.error(`Product feature failed for ${productId}: ${error.message}`);
      throw error;
    }

    return data;
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ORDER MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * List all orders with buyer, seller, and product info.
   */
  async getOrders({ page = 1, limit = 20, status, paymentStatus } = {}) {
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('orders')
      .select(
        `
        *,
        buyer:profiles!orders_buyer_id_fkey(id, full_name, email),
        seller:profiles!orders_seller_id_fkey(id, full_name, email),
        product:products!orders_product_id_fkey(id, title, images, price)
        `,
        { count: 'exact' }
      )
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);
    if (paymentStatus) query = query.eq('payment_status', paymentStatus);

    const { data, error, count } = await query.range(offset, offset + limit - 1);

    if (error) {
      logger.error(`Admin order list failed: ${error.message}`);
      throw error;
    }

    return { data, count, page, limit };
  },

  /**
   * Get a single order by ID with full join data.
   */
  async getOrderById(orderId) {
    const { data, error } = await supabaseAdmin
      .from('orders')
      .select(
        `
        *,
        buyer:profiles!orders_buyer_id_fkey(id, full_name, email, phone),
        seller:profiles!orders_seller_id_fkey(id, full_name, email, phone),
        product:products!orders_product_id_fkey(id, title, description, images, price, category)
        `
      )
      .eq('id', orderId)
      .single();

    if (error) {
      logger.error(`Admin get order ${orderId} failed: ${error.message}`);
      throw error;
    }

    return data;
  },

  /**
   * Update an order's status.
   * Allowed: pending | confirmed | shipped | delivered | cancelled | disputed
   */
  async updateOrderStatus(orderId, status) {
    const ALLOWED = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled', 'disputed'];
    if (!ALLOWED.includes(status)) {
      const err = new Error(`Invalid order status. Allowed: ${ALLOWED.join(', ')}`);
      err.statusCode = 400;
      throw err;
    }

    const { data, error } = await supabaseAdmin
      .from('orders')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', orderId)
      .select()
      .single();

    if (error) {
      logger.error(`Order status update failed for ${orderId}: ${error.message}`);
      throw error;
    }

    return data;
  },
};

module.exports = adminService;
