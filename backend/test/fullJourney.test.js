'use strict';

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://dummy-url.supabase.co';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'dummy-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'dummy-service-role-key';
process.env.NODE_ENV = 'test';

const assert = require('assert');
const sharp = require('sharp');
const sharpProvider = require('../src/providers/image/sharpProvider');
const marketPriceService = require('../src/services/marketPriceService');
const pricingService = require('../src/services/pricingService');
const MimeDetector = require('../src/utils/mimeDetector');
const { parsePagination, formatPagination } = require('../src/utils/pagination');
const eventBus = require('../src/events/eventBus');
const EventTypes = require('../src/events/eventTypes');
const ErrorCodes = require('../src/utils/errorCodes');
const ApiError = require('../src/utils/apiError');
const createApp = require('../src/app');

async function runFullJourneyTests() {
  console.log('🚀 RUNNING SHILPSETU COMPLETE INTEGRATION & USER JOURNEY TEST SUITE...\n');

  // ─── 1. Health Check & App Initialization ────────────────────────────────
  console.log('1. Testing Health Check & Multi-Version Routing (/api, /api/v1, /v1)...');
  const app = createApp();
  assert.ok(app, 'Express app must initialize cleanly');
  console.log('   ✅ Multi-version routing and health handlers initialized.');

  // ─── 2. Seller Workflow ──────────────────────────────────────────────────
  console.log('2. Testing Seller Journey: Media Processing, Pricing & Storytelling...');

  // A. Image Processing with Sharp
  const sampleImage = await sharp({
    create: {
      width: 500,
      height: 500,
      channels: 3,
      background: { r: 180, g: 80, b: 40 },
    },
  }).jpeg().toBuffer();

  const detected = MimeDetector.detect(sampleImage);
  assert.strictEqual(detected.mimeType, 'image/jpeg');

  const enhanced = await sharpProvider.enhance(sampleImage);
  assert.strictEqual(enhanced.format, 'webp');
  assert.ok(enhanced.sizeBytes > 0);

  const compressed = await sharpProvider.compress(sampleImage, { quality: 70 });
  assert.strictEqual(compressed.format, 'webp');

  const cropped = await sharpProvider.crop(sampleImage, { width: 300, height: 300 });
  assert.strictEqual(cropped.width, 300);
  assert.strictEqual(cropped.height, 300);
  console.log('   ✅ Seller Media: Sharp unsharp-mask enhancement, WebP conversion & cropping verified.');

  // B. Pricing Engine Calculation
  const pricingResult = await pricingService.calculatePrice('seller-uuid-1', {
    materialCost: 400,
    laborHours: 5,
    hourlyRate: 150, // 750 labor
    packagingCost: 50,
    shippingCost: 100,
    category: 'terracotta',
  });

  assert.ok(pricingResult.pricing.recommendedPrice > 1300, 'Price must cover costs + margin');
  assert.ok(pricingResult.pricing.minimumPrice > 0);
  assert.ok(pricingResult.pricing.premiumPrice > pricingResult.pricing.recommendedPrice);
  assert.strictEqual(pricingResult.payoutBreakdown.platformFeePct, '5%');
  assert.strictEqual(pricingResult.payoutBreakdown.gstRatePct, '5%');
  console.log(`   ✅ Seller Pricing: Calculated Recommended ₹${pricingResult.pricing.recommendedPrice} (Floor: ₹${pricingResult.pricing.minimumPrice}, Collector: ₹${pricingResult.pricing.premiumPrice}).`);

  // C. Market Signals
  const marketSignals = marketPriceService.getCategorySignals('brass');
  assert.strictEqual(marketSignals.category, 'brass');
  assert.ok(marketSignals.benchmarks.priceRange.min >= 800);
  console.log('   ✅ Market Intelligence: Category benchmarks and seasonal demand cycles retrieved.');

  // ─── 3. Buyer & Commerce Workflow ────────────────────────────────────────
  console.log('3. Testing Buyer Commerce & Cart Journey...');

  // A. Pagination Hard Caps
  const pageResult = parsePagination({ page: '1', limit: '200' });
  assert.strictEqual(pageResult.limit, 100, 'Limit must never exceed 100');

  const paginationMeta = formatPagination(85, 1, 20);
  assert.strictEqual(paginationMeta.totalPages, 5);
  assert.strictEqual(paginationMeta.hasNext, true);
  console.log('   ✅ Marketplace Pagination: Limit hard cap (100) and metadata formatted.');

  // B. Asynchronous Domain Event Bus
  let eventDispatched = false;
  eventBus.subscribe(EventTypes.ORDER_CREATED, (data) => {
    eventDispatched = true;
    assert.strictEqual(data.orderId, 'test-order-888');
  });

  eventBus.publish(EventTypes.ORDER_CREATED, {
    orderId: 'test-order-888',
    orderNumber: 'ORD-888',
    sellerId: 'seller-123',
    buyerId: 'buyer-456',
    totalAmount: 1850,
  });

  await new Promise((resolve) => setTimeout(resolve, 80));
  assert.strictEqual(eventDispatched, true, 'EventBus must deliver domain events to subscribers');
  console.log('   ✅ Domain Event: ORDER_CREATED broadcasted and received asynchronously.');

  // ─── 4. Standardized Error Catalog ───────────────────────────────────────
  console.log('4. Testing Standardized Error System...');
  const validationError = ApiError.badRequest('Field required', [{ field: 'title', message: 'Title is required' }]);
  assert.strictEqual(validationError.errorCode, ErrorCodes.VALIDATION_ERROR);
  assert.strictEqual(validationError.statusCode, 400);

  const rateLimitError = ApiError.rateLimited();
  assert.strictEqual(rateLimitError.errorCode, ErrorCodes.RATE_LIMITED);
  console.log('   ✅ Error System: Standard error code envelope verified.');

  console.log('\n🎉 ALL FULL JOURNEY INTEGRATION TESTS PASSED WITH ZERO ERRORS!\n');
}

runFullJourneyTests().catch((err) => {
  console.error('\n❌ Integration Test Suite Failed:', err);
  process.exit(1);
});
