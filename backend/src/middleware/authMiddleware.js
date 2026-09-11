const { supabaseAdmin } = require('../config/supabase');
const ApiError = require('../utils/apiError');
const logger = require('../utils/logger');

/**
 * Authentication middleware.
 * 1. Extracts the Bearer token from the Authorization header.
 * 2. Verifies the token with Supabase Auth (getUser).
 * 3. Loads the user's profile from the profiles table.
 * 4. Attaches req.user (auth user) and req.profile (profile row) to the request.
 */
async function authMiddleware(req, _res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw ApiError.unauthorized('Missing or invalid authorization header');
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      throw ApiError.unauthorized('Access token is required');
    }

    // Verify the token and retrieve the user
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      logger.warn(`Auth verification failed: ${authError?.message || 'No user returned'}`);
      throw ApiError.unauthorized('Invalid or expired access token');
    }

    // Fetch the profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError) {
      logger.warn(`Profile lookup failed for user ${user.id}: ${profileError.message}`);
      // Profile might not exist yet for newly signed-up users
      // Create a basic profile on the fly
      const newProfile = {
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name || user.user_metadata?.name || null,
        profile_image: user.user_metadata?.avatar_url || null,
        role: 'seller',
        is_verified: false,
      };

      const { data: created, error: createErr } = await supabaseAdmin
        .from('profiles')
        .upsert(newProfile, { onConflict: 'id' })
        .select()
        .single();

      if (createErr) {
        logger.error(`Failed to auto-create profile for user ${user.id}: ${createErr.message}`);
        throw ApiError.internal('Failed to load user profile');
      }

      req.profile = created;
    } else {
      req.profile = profile;
    }

    // Store the raw access token for scoped client usage
    req.accessToken = token;
    req.user = user;

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Optional authentication middleware.
 * If Bearer token is provided, validates and sets req.user & req.profile.
 * If not provided, proceeds without error.
 */
async function optionalAuth(req, _res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }
    const token = authHeader.split(' ')[1];
    if (!token) return next();

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return next();

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    req.user = user;
    req.profile = profile || null;
    req.accessToken = token;
    next();
  } catch {
    next();
  }
}

module.exports = authMiddleware;
module.exports.optionalAuth = optionalAuth;

