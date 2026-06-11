import React from 'react';
import { CATEGORY_GROUPS } from '../constants/categories.js';

/**
 * CategorySelect — grouped dropdown with built-in + user custom categories.
 *
 * Props:
 *   value         {string}    – controlled value
 *   onChange      {fn}        – called with the raw string value chosen
 *   style         {object}    – extra inline styles for the <select>
 *   emptyLabel    {string}    – first empty option label
 *   showCustom    {boolean}   – include "+ New Category…" option at bottom
 *   customCats    {Array}     – user_categories rows [{ id, name, type }]
 */
export default function CategorySelect({
    value = '',
    onChange,
    style = {},
    emptyLabel = 'Select category…',
    showCustom = false,
    customCats = [],
}) {
    // Group custom categories by type to merge under the right optgroup
    const customByType = { expense: [], income: [], misc_income: [] };
    for (const c of customCats) {
        if (customByType[c.type]) customByType[c.type].push(c.name);
    }

    // Map CATEGORY_GROUPS group key → custom type key
    const typeMap = { Expenses: 'expense', Income: 'income', 'Misc Income': 'misc_income' };

    return (
        <select
            value={value}
            onChange={e => onChange && onChange(e.target.value)}
            style={{ width: '100%', padding: '8px', ...style }}
        >
            <option value="">{emptyLabel}</option>
            {CATEGORY_GROUPS.map(({ group, label, items }) => {
                const extra = customByType[typeMap[group]] || [];
                return (
                    <optgroup key={group} label={label}>
                        {items.map(item => (
                            <option key={item} value={item}>{item}</option>
                        ))}
                        {extra.map(name => (
                            <option key={`custom:${name}`} value={name}>{name} ✦</option>
                        ))}
                    </optgroup>
                );
            })}
            {showCustom && <option value="__new_category__">✚ New Category…</option>}
        </select>
    );
}
