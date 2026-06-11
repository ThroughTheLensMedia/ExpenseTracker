// api/routes/categories.js
// User-managed custom categories — expense, income, misc_income
// GET    /api/categories         — list user's custom categories
// POST   /api/categories         — create { name, type }
// PUT    /api/categories/:id     — rename { name } + update matching expense rows
// DELETE /api/categories/:id     — delete; requires ?force=true if transactions use it
'use strict';

const express = require('express');
const { z }   = require('zod');
const router  = express.Router();

const CategorySchema = z.object({
    name: z.string().trim().min(1).max(50),
    type: z.enum(['expense', 'income', 'misc_income']),
});

const RenameSchema = z.object({
    name: z.string().trim().min(1).max(50),
});

// GET /api/categories
router.get('/', async (req, res) => {
    try {
        const { data, error } = await req.sb
            .from('user_categories')
            .select('id, name, type, created_at')
            .eq('user_id', req.user.id)
            .order('type')
            .order('name');
        if (error) throw error;
        res.json(data || []);
    } catch (err) {
        console.error('[categories] GET error', err.message);
        res.status(500).json({ error: 'Failed to load categories.' });
    }
});

// POST /api/categories
router.post('/', async (req, res) => {
    const parsed = CategorySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message });
    const { name, type } = parsed.data;
    try {
        const { data, error } = await req.sb
            .from('user_categories')
            .insert({ user_id: req.user.id, name, type })
            .select('id, name, type, created_at')
            .single();
        if (error) {
            if (error.code === '23505') return res.status(409).json({ error: `Category "${name}" already exists.` });
            throw error;
        }
        res.status(201).json(data);
    } catch (err) {
        console.error('[categories] POST error', err.message);
        res.status(500).json({ error: 'Failed to create category.' });
    }
});

// PUT /api/categories/:id  — rename + update expenses
router.put('/:id', async (req, res) => {
    const parsed = RenameSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message });
    const { name: newName } = parsed.data;
    const { id } = req.params;
    try {
        // Fetch old name first so we can update expenses
        const { data: existing, error: fetchErr } = await req.sb
            .from('user_categories')
            .select('name')
            .eq('id', id)
            .eq('user_id', req.user.id)
            .single();
        if (fetchErr || !existing) return res.status(404).json({ error: 'Category not found.' });

        const oldName = existing.name;

        const { data, error } = await req.sb
            .from('user_categories')
            .update({ name: newName })
            .eq('id', id)
            .eq('user_id', req.user.id)
            .select('id, name, type, created_at')
            .single();
        if (error) {
            if (error.code === '23505') return res.status(409).json({ error: `Category "${newName}" already exists.` });
            throw error;
        }

        // Update all expenses that used the old name
        if (oldName !== newName) {
            await req.sb
                .from('expenses')
                .update({ category: newName })
                .eq('user_id', req.user.id)
                .eq('category', oldName);
        }

        res.json(data);
    } catch (err) {
        console.error('[categories] PUT error', err.message);
        res.status(500).json({ error: 'Failed to rename category.' });
    }
});

// DELETE /api/categories/:id
// If transactions still use this category, returns 409 with count unless ?force=true
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    const force = req.query.force === 'true';
    try {
        const { data: existing, error: fetchErr } = await req.sb
            .from('user_categories')
            .select('name')
            .eq('id', id)
            .eq('user_id', req.user.id)
            .single();
        if (fetchErr || !existing) return res.status(404).json({ error: 'Category not found.' });

        const { name } = existing;

        // Count transactions using this category
        const { count, error: countErr } = await req.sb
            .from('expenses')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', req.user.id)
            .eq('category', name);
        if (countErr) throw countErr;

        if (count > 0 && !force) {
            return res.status(409).json({
                error: `${count} transaction${count === 1 ? '' : 's'} use this category. Pass ?force=true to delete anyway.`,
                count,
            });
        }

        const { error: delErr } = await req.sb
            .from('user_categories')
            .delete()
            .eq('id', id)
            .eq('user_id', req.user.id);
        if (delErr) throw delErr;

        res.json({ deleted: true, name });
    } catch (err) {
        console.error('[categories] DELETE error', err.message);
        res.status(500).json({ error: 'Failed to delete category.' });
    }
});

// DELETE /api/categories/orphan?name=X
// Clears the category field from all expenses that use the given freeform string.
// Used to clean up orphan categories that weren't imported.
router.delete('/orphan', async (req, res) => {
    const name = (req.query.name || '').trim();
    if (!name) return res.status(400).json({ error: 'name query param required.' });
    try {
        const { count, error: countErr } = await req.sb
            .from('expenses')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', req.user.id)
            .eq('category', name);
        if (countErr) throw countErr;

        const { error: updateErr } = await req.sb
            .from('expenses')
            .update({ category: null })
            .eq('user_id', req.user.id)
            .eq('category', name);
        if (updateErr) throw updateErr;

        res.json({ cleared: true, name, count: count || 0 });
    } catch (err) {
        console.error('[categories] DELETE /orphan error', err.message);
        res.status(500).json({ error: 'Failed to clear category.' });
    }
});

module.exports = router;
