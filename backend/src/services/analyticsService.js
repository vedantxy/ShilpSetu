'use strict';

const crypto = require('crypto');
const { supabaseAdmin } = require('../config/supabase');
const logger = require('../utils/logger');
const { parsePagination, formatPagination } = require('../utils/pagination');

/**
 * AnalyticsService — Event telemetry, aggregation queries, and reporting for Sellers, Buyers, and Admins.
 */
class AnalyticsService {
  /**
   * Track an analytics event asynchronously without blocking.
   *
   * @param {string} eventName - e.g. PRODUCT_VIEWED, CART_ADDED
   * @param {Object} payload
   * @param {string} [payload.userId]
   * @param {string} [payload.entityType]
   * @param {string} [payload.entityId]
   * @param {Object} [payload.metadata]
   * @param {string} [payload.ip]
   * @param {string} [payload.userAgent]
   */
  async trackEvent(eventName, payload = {}) {
    try {
      const {
        userId = null,
        entityType = null,
        entityId = null,
        metadata = {},
        ip = null,
        userAgent = null,
      } = payload;

      // Hash IP for privacy preservation
      const ipHash = ip ? crypto.createHash('sha256').update(ip).digest('hex').substring(0, 16) : null;

      // Ensure no sensitive data in metadata
      const cleanMetadata = { ...metadata };
      delete cleanMetadata.password;
      delete cleanMetadata.token;
      delete cleanMetadata.jwt;
      delete cleanMetadata.otp;

      await supabaseAdmin.from('analytics_events').insert({
        event_name: eventName,
        user_id: userId,
        entity_type: entityType,
        entity_id: entityId ? String(entityId) : null,
        metadata: cleanMetadata,
        ip_hash: ipHash,
        user_agent: userAgent ? userAgent.substring(0, 255) : null,
      });
    } catch (err) {
      // Never fail the caller on telemetry tracking errors
      logger.warn(`Failed to track analytics event ${eventName}: ${err.message}`);
    }
  }

  /**
   * Get comprehensive seller analytics.
   *
   * @param {string} sellerId - UUID of artisan / seller
   * @param {Object} [options]
   */
  async getSellerAnalytics(sellerId, options = {}) {
    // 1. Fetch seller's products
    const { data: products } = await supabaseAdmin
      .from('products')
      .select('id, title, price, category, status, created_at')
      .eq('seller_id', sellerId);

    const productIds = (products || []).map((p) => p.id);

    // 2. Fetch product views & saves from analytics_events
    let productViewsCount = 0;
    let productSavesCount = 0;
    let inquiriesCount = 0;

    if (productIds.length > 0) {
      const { count: views } = await supabaseAdmin
        .from('analytics_events')
        .select('*', { count: 'exact', head: true })
        .eq('event_name', 'PRODUCT_VIEWED')
        .in('entity_id', productIds);
      productViewsCount = views || 0;

      const { count: saves } = await supabaseAdmin
        .from('analytics_events')
        .select('*', { count: 'exact', head: true })
        .eq('event_name', 'PRODUCT_SAVED')
        .in('entity_id', productIds);
      productSavesCount = saves || 0;
    }

    const { count: inq } = await supabaseAdmin
      .from('analytics_events')
      .select('*', { count: 'exact', head: true })
      .eq('event_name', 'INQUIRY_RECEIVED')
      .eq('user_id', sellerId);
    inquiriesCount = inq || 0;

    // 3. Fetch Orders & Revenue
    const { data: orders } = await supabaseAdmin
      .from('orders')
      .select('id, order_number, total_amount, status, created_at')
      .eq('seller_id', sellerId);

    const totalOrders = orders?.length || 0;
    const completedOrders = (orders || []).filter((o) => o.status === 'delivered' || o.status === 'completed');
    const totalRevenue = completedOrders.reduce((sum, o) => sum + (parseFloat(o.total_amount) || 0), 0);
    const pendingOrders = (orders || []).filter((o) => o.status === 'pending' || o.status === 'processing').length;

    // 4. Best Products (top published products)
    const bestProducts = (products || [])
      .filter((p) => p.status === 'published')
      .slice(0, 5)
      .map((p) => ({
        id: p.id,
        title: p.title,
        price: p.price,
        category: p.category,
      }));

    // 5. Recent Activity
    const { data: recentEvents } = await supabaseAdmin
      .from('analytics_events')
      .select('event_name, entity_type, entity_id, metadata, created_at')
      .or(`user_id.eq.${sellerId},entity_id.in.(${productIds.length > 0 ? productIds.join(',') : '00000000-0000-0000-0000-000000000000'})`)
      .order('created_at', { ascending: false })
      .limit(10);

    return {
      summary: {
        totalProducts: products?.length || 0,
        publishedProducts: (products || []).filter((p) => p.status === 'published').length,
        productViews: productViewsCount,
        productSaves: productSavesCount,
        inquiries: inquiriesCount,
        totalOrders,
        pendingOrders,
        totalRevenue: Math.round(totalRevenue),
        currency: 'INR',
      },
      bestProducts,
      recentActivity: recentEvents || [],
    };
  }

  /**
   * Get buyer analytics and activity overview.
   *
   * @param {string} buyerId - UUID of buyer
   */
  async getBuyerAnalytics(buyerId) {
    // 1. Fetch buyer's orders
    const { data: orders } = await supabaseAdmin
      .from('orders')
      .select('id, order_number, total_amount, status, created_at')
      .eq('buyer_id', buyerId)
      .order('created_at', { ascending: false });

    const totalSpent = (orders || []).reduce((sum, o) => sum + (parseFloat(o.total_amount) || 0), 0);

    // 2. Fetch saved products
    const { data: saveEvents } = await supabaseAdmin
      .from('analytics_events')
      .select('entity_id, metadata, created_at')
      .eq('user_id', buyerId)
      .eq('event_name', 'PRODUCT_SAVED')
      .order('created_at', { ascending: false })
      .limit(20);

    // 3. Fetch categories viewed
    const { data: viewEvents } = await supabaseAdmin
      .from('analytics_events')
      .select('metadata, created_at')
      .eq('user_id', buyerId)
      .eq('event_name', 'PRODUCT_VIEWED')
      .order('created_at', { ascending: false })
      .limit(50);

    const categoryCounts = {};
    for (const v of viewEvents || []) {
      const cat = v.metadata?.category || 'Handicrafts';
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    }

    const favoriteCategories = Object.entries(categoryCounts)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      summary: {
        totalOrders: orders?.length || 0,
        totalSpent: Math.round(totalSpent),
        savedCount: saveEvents?.length || 0,
        currency: 'INR',
      },
      favoriteCategories,
      recentOrders: (orders || []).slice(0, 5),
      savedProducts: saveEvents || [],
    };
  }

  /**
   * Get platform admin analytics.
   */
  async getAdminAnalytics() {
    // 1. User & Seller Counts
    const { count: totalUsers } = await supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    const { count: totalSellers } = await supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'seller');

    const { count: verifiedArtisans } = await supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'seller')
      .eq('is_verified', true);

    // 2. Product Counts
    const { count: totalProducts } = await supabaseAdmin
      .from('products')
      .select('*', { count: 'exact', head: true });

    const { count: publishedProducts } = await supabaseAdmin
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'published');

    // 3. Order & Revenue Counts
    const { data: allOrders } = await supabaseAdmin
      .from('orders')
      .select('id, total_amount, status, created_at');

    const totalOrders = allOrders?.length || 0;
    const completedOrders = (allOrders || []).filter((o) => o.status === 'delivered' || o.status === 'completed');
    const totalPlatformGMV = completedOrders.reduce((sum, o) => sum + (parseFloat(o.total_amount) || 0), 0);
    const platformCommission = Math.round(totalPlatformGMV * 0.05); // 5% fee

    // 4. Telemetry Events summary
    const { count: totalViews } = await supabaseAdmin
      .from('analytics_events')
      .select('*', { count: 'exact', head: true })
      .eq('event_name', 'PRODUCT_VIEWED');

    const { count: totalAIGenerations } = await supabaseAdmin
      .from('analytics_events')
      .select('*', { count: 'exact', head: true })
      .eq('event_name', 'AI_CATALOG_GENERATED');

    return {
      overview: {
        users: {
          total: totalUsers || 0,
          sellers: totalSellers || 0,
          verifiedArtisans: verifiedArtisans || 0,
        },
        products: {
          total: totalProducts || 0,
          published: publishedProducts || 0,
          views: totalViews || 0,
        },
        orders: {
          total: totalOrders,
          completed: completedOrders.length,
          gmv: Math.round(totalPlatformGMV),
          revenue: platformCommission,
          currency: 'INR',
        },
        ai: {
          catalogsGenerated: totalAIGenerations || 0,
        },
      },
    };
  }
}

module.exports = new AnalyticsService();
