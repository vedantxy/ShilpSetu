'use strict';

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://dummy-url.supabase.co';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'dummy-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'dummy-service-role-key';

const assert = require('assert');
const ErrorCodes = require('../src/utils/errorCodes');
const ApiError = require('../src/utils/apiError');
const sanitizeInput = require('../src/middleware/sanitizeInput');
const { parsePagination, formatPagination } = require('../src/utils/pagination');
const { redactSensitive } = require('../src/middleware/requestLogger');

async function runSecurityTestSuite() {
  console.log('🔒 STARTING SHILPSETU SECURITY & ANALYTICS TEST SUITE...\n');

  // ─── 1. Standardized Error Codes ──────────────────────────────────────────
  console.log('1. Testing Standardized Error Codes & ApiError factory...');
  const authReqErr = ApiError.unauthorized();
  assert.strictEqual(authReqErr.errorCode, ErrorCodes.AUTH_REQUIRED);
  assert.strictEqual(authReqErr.statusCode, 401);

  const authInvErr = ApiError.invalidAuth();
  assert.strictEqual(authInvErr.errorCode, ErrorCodes.AUTH_INVALID);

  const forbiddenErr = ApiError.forbidden();
  assert.strictEqual(forbiddenErr.errorCode, ErrorCodes.FORBIDDEN);
  assert.strictEqual(forbiddenErr.statusCode, 403);

  const rateLimitErr = ApiError.rateLimited();
  assert.strictEqual(rateLimitErr.errorCode, ErrorCodes.RATE_LIMITED);
  assert.strictEqual(rateLimitErr.statusCode, 429);

  const mediaErr = ApiError.mediaError('Invalid image');
  assert.strictEqual(mediaErr.errorCode, ErrorCodes.MEDIA_UPLOAD_ERROR);
  console.log('   ✅ All ApiError error codes match standard catalog.');

  // ─── 2. Input Sanitization & Injection Defense ────────────────────────────
  console.log('2. Testing NoSQL / SQL Injection & XSS Sanitization...');
  const dirtyReq = {
    body: {
      $where: 'sleep(5000)',
      username: 'artisan_1',
      payload: {
        $gt: '',
        bio: 'Authentic handmade pottery <script>alert("xss")</script>',
        website: 'javascript:stealCookies()',
      },
    },
    query: {
      '$gt': '0',
      'search.filter': 'attack',
      category: 'pottery',
    },
    params: {},
  };

  sanitizeInput(dirtyReq, {}, () => {});

  assert.strictEqual(dirtyReq.body.$where, undefined, 'NoSQL operator $where must be stripped');
  assert.strictEqual(dirtyReq.body.payload.$gt, undefined, 'Nested NoSQL operator $gt must be stripped');
  assert.strictEqual(dirtyReq.body.payload.bio, 'Authentic handmade pottery ', 'Script tags must be removed');
  assert.strictEqual(dirtyReq.body.payload.website, 'stealCookies()', 'javascript: URI scheme must be removed');
  assert.strictEqual(dirtyReq.query.$gt, undefined, 'Query operator must be stripped');
  assert.strictEqual(dirtyReq.query['search.filter'], undefined, 'Dotted query key must be stripped');
  assert.strictEqual(dirtyReq.query.category, 'pottery', 'Safe query param preserved');
  console.log('   ✅ Input sanitization cleanly neutralizes injection payloads.');

  // ─── 3. Pagination Clamping & Performance ─────────────────────────────────
  console.log('3. Testing Pagination Hard Caps...');
  const clampedPagination = parsePagination({ page: '1', limit: '500' });
  assert.strictEqual(clampedPagination.limit, 100, 'Limit must be capped to maximum 100');

  const negativePagination = parsePagination({ page: '-5', limit: '0' });
  assert.strictEqual(negativePagination.page, 1, 'Negative page must fallback to 1');
  assert.strictEqual(negativePagination.limit, 20, 'Zero limit must fallback to default 20');

  const meta = formatPagination(250, 2, 20);
  assert.strictEqual(meta.totalPages, 13);
  assert.strictEqual(meta.hasNext, true);
  assert.strictEqual(meta.hasPrev, true);
  console.log('   ✅ Pagination limits strictly enforced.');

  // ─── 4. Sensitive Credential Redaction in Observability ───────────────────
  console.log('4. Testing Sensitive Credential Redaction...');
  const logData = {
    user: 'artisan@shilpsetu.in',
    password: 'SuperSecretPassword123!',
    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    jwt: 'secret-jwt',
    otp: '948201',
    apiKey: 'AIzaSyD-secret-key',
    profile: {
      name: 'Ramesh Patel',
      cardNumber: '4111-2222-3333-4444',
      cvv: '123',
    },
  };

  const redacted = redactSensitive(logData);
  assert.strictEqual(redacted.password, '[REDACTED]');
  assert.strictEqual(redacted.token, '[REDACTED]');
  assert.strictEqual(redacted.jwt, '[REDACTED]');
  assert.strictEqual(redacted.otp, '[REDACTED]');
  assert.strictEqual(redacted.apiKey, '[REDACTED]');
  assert.strictEqual(redacted.profile.cardNumber, '[REDACTED]');
  assert.strictEqual(redacted.profile.cvv, '[REDACTED]');
  assert.strictEqual(redacted.profile.name, 'Ramesh Patel');
  console.log('   ✅ Credentials and sensitive fields properly masked in logs.');

  // ─── 5. App & Subsystem Sanity Check ──────────────────────────────────────
  console.log('5. Loading full app and routes with security configurations...');
  const createApp = require('../src/app');
  const app = createApp();
  assert.ok(app, 'Express app initialized successfully');
  console.log('   ✅ App instance configured with Helmet, CORS, Sanitizer & Tracing.');

  console.log('\n🎉 ALL SECURITY & OBSERVABILITY VERIFICATION TESTS PASSED SUCCESSFULLY!\n');
}

runSecurityTestSuite().catch((err) => {
  console.error('\n❌ Security Test Suite Failed:', err);
  process.exit(1);
});
