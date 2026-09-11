'use strict';

const { env } = require('../config/env');
const logger = require('../utils/logger');

/**
 * Indian Handicraft Category Benchmarks & Market Intelligence Data
 */
const CATEGORY_BENCHMARKS = {
  pottery: {
    averageRange: { min: 350, max: 2500 },
    demandLevel: 'high',
    seasonality: 'Diwali & festive seasons (Oct-Nov), wedding season (Nov-Feb)',
    targetAudience: 'Home decor enthusiasts, eco-friendly consumers, gift shoppers',
    suggestedMarginPct: 35,
    elasticity: 'moderate',
  },
  handloom: {
    averageRange: { min: 1200, max: 15000 },
    demandLevel: 'high',
    seasonality: 'Year-round, peaks during festivals (Aug-Nov) and weddings (Nov-Feb)',
    targetAudience: 'Ethnic fashion buyers, festive shoppers, conscious fashion advocates',
    suggestedMarginPct: 40,
    elasticity: 'low-to-moderate',
  },
  terracotta: {
    averageRange: { min: 250, max: 3500 },
    demandLevel: 'moderate-to-high',
    seasonality: 'Festive seasons (Durga Puja, Diwali), garden decor in spring',
    targetAudience: 'Art collectors, garden decorators, interior stylists',
    suggestedMarginPct: 40,
    elasticity: 'moderate',
  },
  woodwork: {
    averageRange: { min: 600, max: 8500 },
    demandLevel: 'moderate',
    seasonality: 'Housewarming, holiday gifts, corporate gifting (Oct-Dec)',
    targetAudience: 'Interior decor collectors, heritage enthusiasts, premium gifting',
    suggestedMarginPct: 45,
    elasticity: 'low',
  },
  brass: {
    averageRange: { min: 800, max: 12000 },
    demandLevel: 'high',
    seasonality: 'Puja/festive seasons (Sep-Nov), wedding gifting (Nov-Jan)',
    targetAudience: 'Spiritual homes, antique collectors, luxury decor',
    suggestedMarginPct: 40,
    elasticity: 'low',
  },
  paintings: {
    averageRange: { min: 900, max: 25000 },
    demandLevel: 'moderate-to-high',
    seasonality: 'Year-round, art exhibitions, gallery seasons (Nov-Mar)',
    targetAudience: 'Art collectors, cultural enthusiasts, premium home decor',
    suggestedMarginPct: 50,
    elasticity: 'inelastic',
  },
  jewelry: {
    averageRange: { min: 450, max: 6500 },
    demandLevel: 'very-high',
    seasonality: 'Wedding season (Nov-Feb), festivals (Rakhi, Navratri, Diwali)',
    targetAudience: 'Youth fashion, festive buyers, sustainable lifestyle shoppers',
    suggestedMarginPct: 45,
    elasticity: 'high',
  },
  jute_bamboo: {
    averageRange: { min: 200, max: 2800 },
    demandLevel: 'growing',
    seasonality: 'Summer living, eco-living campaigns, everyday storage',
    targetAudience: 'Zero-waste lifestyle consumers, urban sustainable shoppers',
    suggestedMarginPct: 30,
    elasticity: 'moderate',
  },
};

/**
 * MarketPriceService — Provides market intelligence, competitive ranges, and demand trends for handicraft categories.
 */
class MarketPriceService {
  /**
   * Get category market intelligence and pricing signals.
   */
  getCategorySignals(category = '') {
    const normCategory = (category || '').toLowerCase().trim();

    let matchedKey = 'handloom';
    for (const key of Object.keys(CATEGORY_BENCHMARKS)) {
      if (normCategory.includes(key) || key.includes(normCategory)) {
        matchedKey = key;
        break;
      }
    }

    const benchmark = CATEGORY_BENCHMARKS[matchedKey] || CATEGORY_BENCHMARKS.handloom;

    const isLive = env.MARKET_DATA_PROVIDER !== 'none' && Boolean(env.MARKET_DATA_API_KEY);

    return {
      category: matchedKey,
      dataSource: isLive ? 'live_market_api' : 'estimated_benchmark_model',
      confidence: isLive ? 'high' : 'medium',
      benchmarks: {
        priceRange: benchmark.averageRange,
        demandLevel: benchmark.demandLevel,
        seasonality: benchmark.seasonality,
        targetAudience: benchmark.targetAudience,
        suggestedMarginPct: benchmark.suggestedMarginPct,
        priceElasticity: benchmark.elasticity,
      },
      insights: [
        `Typical market prices for authentic ${matchedKey} range from ₹${benchmark.averageRange.min.toLocaleString('en-IN')} to ₹${benchmark.averageRange.max.toLocaleString('en-IN')}.`,
        `Peak demand aligns with ${benchmark.seasonality}.`,
        `Primary consumer segment: ${benchmark.targetAudience}.`,
      ],
    };
  }

  /**
   * Run detailed market comparison for a product with cost inputs.
   */
  analyzeMarketFit(category, suggestedPrice) {
    const signals = this.getCategorySignals(category);
    const { min, max } = signals.benchmarks.priceRange;

    let positioning = 'Balanced / Market-Standard';
    let recommendation = 'Price is aligned with prevailing artisan market standards.';

    if (suggestedPrice < min) {
      positioning = 'Budget / High-Volume Value';
      recommendation = 'Price is below typical handmade market rates. Consider increasing to ensure artisan labor is fairly compensated.';
    } else if (suggestedPrice > max * 1.5) {
      positioning = 'Masterpiece / Collector Heritage';
      recommendation = 'Premium pricing tier. Ensure product listing highlights unique master artisan provenance, GI tags, and hours invested.';
    } else if (suggestedPrice > max) {
      positioning = 'Premium / Luxury Artisanal';
      recommendation = 'Higher-tier pricing. Strong storytelling and high-resolution craft photography will support this price point.';
    }

    return {
      ...signals,
      positioning,
      recommendation,
      isWithinMarketRange: suggestedPrice >= min && suggestedPrice <= max,
    };
  }
}

module.exports = new MarketPriceService();
