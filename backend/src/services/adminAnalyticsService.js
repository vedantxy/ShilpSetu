'use strict';

const { supabaseAdmin } = require('../config/supabase');
const logger = require('../utils/logger');

/**
 * Compute the start date for a given range string.
 *
 * @param {'7d'|'30d'|'90d'|'1y'} range
 * @returns {string} ISO 8601 timestamp
 */
function getStartDate(range = '30d') {
  const now = new Date();
  const rangeMap = {
    '7d': 7,
    '30d': 30,
    '90d': 90,
    '1y': 365,
  };
  const days = rangeMap[range] ?? 30;
  now.setDate(now.getDate() - days);
  return now.toISOString();
}

/**
 * Group an array of records by calendar day (YYYY-MM-DD from created_at).
 *
 * @param {object[]} rows       - Records with a created_at field
 * @param {string}   valueField - If provided, sum this field; otherwise count rows
 * @returns {Array<{ date: string, count: number }>}
 */
function groupByDay(rows, valueField = null) {
  const map = {};
  for (const row of rows) {
    const day = new Date(row.created_at).toISOString().slice(0, 10);
    if (!map[day]) map[day] = 0;
    map[day] += valueField ? Number(row[valueField]) || 0 : 1;
  }
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));
}

/**
 * Admin Analytics Service
 *
 * Provides date-ranged (7d/30d/90d/1y) analytics using targeted
 * Supabase queries with JS-side aggregation/grouping.
 */
const adminAnalyticsService = {
  /**
   * User registration analytics over the given range.
   */
  async getUserAnalytics(range = '30d') {
    const startDate = getStartDate(range);

    const [allResult, buyersResult, sellersResult, recentResult] = await Promise.all([
      supabaseAdmin
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startDate),

      supabaseAdmin
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'buyer')
        .gte('created_at', startDate),

      supabaseAdmin
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'seller')
        .gte('created_at', startDate),

      supabaseAdmin
        .from('profiles')
        .select('created_at, role')
        .gte('created_at', startDate)
        .order('created_at', { ascending: true }),
    ]);

    const timeline = groupByDay(recentResult.data || []);

    // Role breakdown within the date range
    const roleBreakdown = {};
    for (const row of recentResult.data || []) {
      roleBreakdown[row.role] = (roleBreakdown[row.role] || 0) + 1;
    }

    return {
      range,
      summary: {
        total: allResult.count || 0,
        buyers: buyersResult.count || 0,
        sellers: sellersResult.count || 0,
      },
      timeline,
      roleBreakdown,
    };
  },

  /**
   * Product creation & status analytics.
   */
  async getProductAnalytics(range = '30d') {
    const startDate = getStartDate(range);

    const { data: products, error } = await supabaseAdmin
      .from('products')
      .select('id, status, price, created_at')
      .gte('created_at', startDate)
      .order('created_at', { ascending: true });

    if (error) {
      logger.error(`Product analytics failed: ${error.message}`);
      throw error;
    }

    const rows = products || [];

    // Group by status
    const statusBreakdown = {};
    for (const p of rows) {
      statusBreakdown[p.status] = (statusBreakdown[p.status] || 0) + 1;
    }

    // Timeline of new products created per day
    const timeline = groupByDay(rows);

    return {
      range,
      summary: {
        total: rows.length,
        published: statusBreakdown.published || 0,
        pending: statusBreakdown.pending_review || 0,
        draft: statusBreakdown.draft || 0,
        rejected: statusBreakdown.rejected || 0,
        archived: statusBreakdown.archived || 0,
      },
      statusBreakdown,
      timeline,
    };
  },

  /**
   * Order volume analytics.
   */
  async getOrderAnalytics(range = '30d') {
    const startDate = getStartDate(range);

    const { data: orders, error } = await supabaseAdmin
      .from('orders')
      .select('id, status, payment_status, amount, created_at')
      .gte('created_at', startDate)
      .order('created_at', { ascending: true });

    if (error) {
      logger.error(`Order analytics failed: ${error.message}`);
      // Return empty data gracefully if orders table doesn't exist yet
      return {
        range,
        summary: { total: 0, confirmed: 0, delivered: 0, cancelled: 0 },
        statusBreakdown: {},
        timeline: [],
      };
    }

    const rows = orders || [];

    const statusBreakdown = {};
    for (const o of rows) {
      statusBreakdown[o.status] = (statusBreakdown[o.status] || 0) + 1;
    }

    return {
      range,
      summary: {
        total: rows.length,
        confirmed: statusBreakdown.confirmed || 0,
        delivered: statusBreakdown.delivered || 0,
        cancelled: statusBreakdown.cancelled || 0,
      },
      statusBreakdown,
      timeline: groupByDay(rows),
    };
  },

  /**
   * Revenue analytics — grouped by day, with totals.
   */
  async getRevenueAnalytics(range = '30d') {
    const startDate = getStartDate(range);

    const { data: orders, error } = await supabaseAdmin
      .from('orders')
      .select('amount, payment_status, created_at')
      .eq('payment_status', 'paid')
      .gte('created_at', startDate)
      .order('created_at', { ascending: true });

    if (error) {
      logger.error(`Revenue analytics failed: ${error.message}`);
      return {
        range,
        summary: { totalRevenue: 0, totalOrders: 0, averageOrderValue: 0 },
        timeline: [],
      };
    }

    const rows = orders || [];
    const totalRevenue = rows.reduce((sum, o) => sum + (Number(o.amount) || 0), 0);
    const totalOrders = rows.length;
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Group revenue by day
    const dayMap = {};
    for (const o of rows) {
      const day = new Date(o.created_at).toISOString().slice(0, 10);
      if (!dayMap[day]) dayMap[day] = { date: day, revenue: 0, orders: 0 };
      dayMap[day].revenue += Number(o.amount) || 0;
      dayMap[day].orders += 1;
    }
    const timeline = Object.values(dayMap).sort((a, b) => a.date.localeCompare(b.date));

    return {
      range,
      summary: {
        totalRevenue: parseFloat(totalRevenue.toFixed(2)),
        totalOrders,
        averageOrderValue: parseFloat(averageOrderValue.toFixed(2)),
      },
      timeline,
    };
  },

  /**
   * Seller performance analytics — top sellers by products and (if available) revenue.
   */
  async getSellerAnalytics(range = '30d') {
    const startDate = getStartDate(range);

    // Sellers who registered in this period
    const { data: newSellers, error: sellersError } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email, created_at, is_verified, verification_status')
      .eq('role', 'seller')
      .gte('created_at', startDate)
      .order('created_at', { ascending: false });

    if (sellersError) {
      logger.error(`Seller analytics failed: ${sellersError.message}`);
      throw sellersError;
    }

    // Products grouped by seller in this period
    const { data: products } = await supabaseAdmin
      .from('products')
      .select('seller_id, status, price')
      .gte('created_at', startDate);

    const sellerProductMap = {};
    for (const p of products || []) {
      if (!sellerProductMap[p.seller_id]) {
        sellerProductMap[p.seller_id] = { total: 0, published: 0, pending: 0 };
      }
      sellerProductMap[p.seller_id].total += 1;
      if (p.status === 'published') sellerProductMap[p.seller_id].published += 1;
      if (p.status === 'pending_review') sellerProductMap[p.seller_id].pending += 1;
    }

    // Top sellers by published product count
    const topSellersBySellerId = Object.entries(sellerProductMap)
      .sort(([, a], [, b]) => b.published - a.published)
      .slice(0, 10)
      .map(([sellerId, stats]) => ({ sellerId, ...stats }));

    // Verification stats
    const verificationBreakdown = {
      verified: 0,
      pending: 0,
      rejected: 0,
      unsubmitted: 0,
    };
    for (const s of newSellers || []) {
      const vs = s.verification_status || 'unsubmitted';
      verificationBreakdown[vs] = (verificationBreakdown[vs] || 0) + 1;
    }

    const sellerTimeline = groupByDay(newSellers || []);

    return {
      range,
      summary: {
        newSellers: (newSellers || []).length,
        verificationBreakdown,
      },
      topSellersBySellerId,
      sellerTimeline,
    };
  },
};

module.exports = adminAnalyticsService;
