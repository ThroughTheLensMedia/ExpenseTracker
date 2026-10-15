'use strict';

const { isFlagEnabled } = require('../utils/flags');
const { supabase: adminClient } = require('../db');

/**
 * requireFeature(flagKey)
 * Blocks non-admin requests when the named feature flag is off.
 * Admins always bypass. Missing/unreadable flags fail open for features
 * (handled inside isFlagEnabled).
 *
 * Usage: router.use(requireFeature('invoicing'));
 */
function requireFeature(flagKey) {
  return async function requireFeatureMiddleware(req, res, next) {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Admin bypass via user_roles (service role)
      if (adminClient) {
        try {
          const { data: roleRecord } = await adminClient
            .from('user_roles')
            .select('role')
            .eq('user_id', req.user.id)
            .single();
          if (roleRecord?.role === 'admin') {
            req.userRole = 'admin';
            return next();
          }
        } catch {
          // fall through to flag check
        }
      }

      const enabled = await isFlagEnabled(flagKey);
      if (!enabled) {
        return res.status(403).json({ error: 'feature_disabled', feature: flagKey });
      }
      return next();
    } catch (err) {
      console.error('[requireFeature] error:', err.message);
      // Fail open for unexpected errors on feature gates
      return next();
    }
  };
}

module.exports = { requireFeature };
