// /api/routes/intake-keys.js
// Authenticated CRUD for a user's website intake keys
// Mounted at /api/intake-keys (behind authMiddleware)

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

// GET /intake-keys — list all keys for the logged-in user
router.get('/', async (req, res) => {
    try {
        const { data, error } = await req.sb
            .from('intake_keys')
            .select('id, label, key, created_at, last_used_at')
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return res.json({ keys: data });
    } catch (err) {
        console.error('[intake-keys] GET error:', err.message);
        return res.status(500).json({ error: err.message });
    }
});

// POST /intake-keys — generate a new intake key
router.post('/', async (req, res) => {
    try {
        const label = String(req.body?.label || 'Website Integration').trim().slice(0, 80);
        const key = `ll-${uuidv4().replace(/-/g, '').slice(0, 24)}`;

        const { data, error } = await req.sb
            .from('intake_keys')
            .insert({ user_id: req.user.id, key, label })
            .select('id, label, key, created_at, last_used_at')
            .single();

        if (error) throw error;
        return res.json(data);
    } catch (err) {
        console.error('[intake-keys] POST error:', err.message);
        return res.status(500).json({ error: err.message });
    }
});

// DELETE /intake-keys/:id — revoke a key
router.delete('/:id', async (req, res) => {
    try {
        const { error } = await req.sb
            .from('intake_keys')
            .delete()
            .eq('id', req.params.id)
            .eq('user_id', req.user.id);

        if (error) throw error;
        return res.status(204).send();
    } catch (err) {
        console.error('[intake-keys] DELETE error:', err.message);
        return res.status(500).json({ error: err.message });
    }
});

module.exports = router;
