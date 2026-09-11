'use strict';

const { supabaseAdmin } = require('../config/supabase');
const marketPriceService = require('./marketPriceService');
const logger = require('../utils/logger');

/**
 * PricingService — Deterministic pricing calculations, profit margins, cost breakdown,
 * and market-aligned price recommendations for artisans.
 */
class PricingService {
  /**
   * Calculate comprehensive pricing breakdown.
   *
   * @param {string} userId - Artisan / seller UUID
   * @param {Object} input - Cost parameters
   */
  async calculatePrice(userId, input) {
    const materialCost = parseFloat(input.materialCost) || 0;
    const laborHours = parseFloat(input.laborHours) || 0;
    const hourlyRate = parseFloat(input.hourlyRate) || 0;
    const directLaborCost = parseFloat(input.laborCost) || (laborHours * hourlyRate) || 0;
    const packagingCost = parseFloat(input.packagingCost) || 0;
    const shippingCost = parseFloat(input.shippingCost) || 0;
    const otherCost = parseFloat(input.otherCost) || 0;

    const totalCost = materialCost + directLaborCost + packagingCost + shippingCost + otherCost;

    if (totalCost <= 0) {
      throw new Error('Total production cost must be greater than 0');
    }

    const categorySignals = marketPriceService.getCategorySignals(input.category || '');
    const defaultMarginPct = categorySignals.benchmarks.suggestedMarginPct || 35;
    const profitMarginPct = parseFloat(input.desiredProfitMargin) || defaultMarginPct;

    // Platform fee & tax rates (configurable defaults)
    const platformFeePct = parseFloat(input.platformFeePct) || 5.0; // 5% ShilpSetu support fee
    const gstRatePct = parseFloat(input.gstRatePct) || 5.0; // Standard 5% GST on handicrafts

    // 1. Minimum Floor Price (Breakeven + 10% safety buffer + fees)
    const floorProfit = totalCost * 0.10;
    const minPrice = Math.ceil((totalCost + floorProfit) / (1 - (platformFeePct + gstRatePct) / 100));

    // 2. Recommended Price (Total Cost + Desired Margin + Fees)
    const desiredProfit = totalCost * (profitMarginPct / 100);
    const recommendedPrice = Math.ceil((totalCost + desiredProfit) / (1 - (platformFeePct + gstRatePct) / 100));

    // 3. Premium / Masterpiece Tier (Total Cost + 60% Margin + Fees)
    const premiumProfit = totalCost * 0.60;
    const maxPrice = Math.ceil((totalCost + premiumProfit) / (1 - (platformFeePct + gstRatePct) / 100));

    // 4. Financial breakdown of recommended price
    const platformFeeAmount = Math.round(recommendedPrice * (platformFeePct / 100));
    const gstAmount = Math.round(recommendedPrice * (gstRatePct / 100));
    const netArtisanPayout = recommendedPrice - platformFeeAmount - gstAmount;
    const netProfitAmount = netArtisanPayout - totalCost;
    const effectiveMarginPct = parseFloat(((netProfitAmount / recommendedPrice) * 100).toFixed(2));

    // 5. Market analysis
    const marketFit = marketPriceService.analyzeMarketFit(input.category || '', recommendedPrice);

    // 6. Record in DB
    const { data: record, error } = await supabaseAdmin
      .from('pricing_records')
      .insert({
        seller_id: userId,
        product_id: input.productId || null,
        material_cost: materialCost,
        labor_cost: directLaborCost,
        packaging_cost: packagingCost,
        shipping_cost: shippingCost,
        other_cost: otherCost,
        total_cost: totalCost,
        desired_profit_margin: profitMarginPct,
        product_category: input.category || 'handicrafts',
        market_signals: {
          laborHours,
          hourlyRate,
          platformFeePct,
          gstRatePct,
          category: input.category,
        },
        recommended_price: recommendedPrice,
        minimum_price: minPrice,
        maximum_price: maxPrice,
        profit_amount: netProfitAmount,
        profit_margin_pct: effectiveMarginPct,
        market_analysis: marketFit,
        currency: 'INR',
      })
      .select()
      .single();

    if (error) {
      logger.error(`Failed to save pricing_records: ${error.message}`);
    }

    return {
      id: record?.id,
      costs: {
        materialCost,
        laborCost: directLaborCost,
        packagingCost,
        shippingCost,
        otherCost,
        totalCost,
      },
      pricing: {
        minimumPrice: minPrice,
        recommendedPrice,
        premiumPrice: maxPrice,
        currency: 'INR',
      },
      payoutBreakdown: {
        customerPrice: recommendedPrice,
        platformFee: platformFeeAmount,
        platformFeePct: `${platformFeePct}%`,
        gstAmount,
        gstRatePct: `${gstRatePct}%`,
        artisanGrossPayout: netArtisanPayout,
        netProfitAmount,
        effectiveProfitMargin: `${effectiveMarginPct}%`,
      },
      marketFit: {
        category: marketFit.category,
        positioning: marketFit.positioning,
        recommendation: marketFit.recommendation,
        isWithinMarketRange: marketFit.isWithinMarketRange,
        benchmarkPriceRange: marketFit.benchmarks.priceRange,
        demandLevel: marketFit.benchmarks.demandLevel,
        seasonality: marketFit.benchmarks.seasonality,
        insights: marketFit.insights,
        dataSource: marketFit.dataSource,
      },
      suggestions: [
        `Recommended selling price is ₹${recommendedPrice.toLocaleString('en-IN')}, earning you ₹${netProfitAmount.toLocaleString('en-IN')} net profit.`,
        directLaborCost > 0 ? `Your time (${laborHours}h) is fairly valued at ₹${directLaborCost.toLocaleString('en-IN')}.` : 'Make sure to factor in labor time for sustainable earnings.',
        marketFit.recommendation,
      ],
    };
  }

  /**
   * Get pricing record by ID.
   */
  async getRecordById(id, userId) {
    const { data, error } = await supabaseAdmin
      .from('pricing_records')
      .select('*')
      .eq('id', id)
      .eq('seller_id', userId)
      .single();

    if (error || !data) {
      throw new Error('Pricing record not found');
    }

    return data;
  }

  /**
   * List seller's pricing records.
   */
  async listRecords(userId, limit = 20) {
    const { data, error } = await supabaseAdmin
      .from('pricing_records')
      .select('*')
      .eq('seller_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    return data || [];
  }
}

module.exports = new PricingService();
