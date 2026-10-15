import { useState, useEffect, useCallback } from 'react';
import { apiGet } from '../api';

/** Built-in defaults — all user-facing features ON (fail open). */
export const FEATURE_FLAG_DEFAULTS = Object.freeze({
    bank_sync: true,
    invoicing: true,
    mileage: true,
    gear_depreciation: true,
    tax_review: true,
    ai_assistant: true,
});

/**
 * useFlags — loads feature flags for the signed-in user.
 * Defaults all ON; on error/network failure keeps defaults (fail open).
 */
export function useFlags() {
    const [flags, setFlags] = useState(() => ({ ...FEATURE_FLAG_DEFAULTS }));
    const [ready, setReady] = useState(false);
    const [migrationPending, setMigrationPending] = useState(false);

    const refresh = useCallback(async () => {
        try {
            const res = await apiGet('/settings/feature-flags');
            const next = { ...FEATURE_FLAG_DEFAULTS };
            if (res?.flags && typeof res.flags === 'object') {
                for (const key of Object.keys(FEATURE_FLAG_DEFAULTS)) {
                    if (typeof res.flags[key] === 'boolean') next[key] = res.flags[key];
                }
            }
            setFlags(next);
            setMigrationPending(!!res?.migration_pending);
        } catch {
            setFlags({ ...FEATURE_FLAG_DEFAULTS });
        } finally {
            setReady(true);
        }
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const isEnabled = useCallback((key) => {
        if (Object.prototype.hasOwnProperty.call(flags, key)) return !!flags[key];
        return true; // unknown → fail open
    }, [flags]);

    return { flags, ready, migrationPending, isEnabled, refresh };
}

export default useFlags;
