import React from 'react';
import { CATEGORY_GROUPS } from '../constants/categories.js';

/**
 * CategorySelect — shared dropdown with Expense / Income / Misc Income optgroups.
 *
 * Props:
 *   value       {string}   – controlled value
 *   onChange    {fn}       – called with the raw string value chosen
 *   style       {object}   – extra inline styles for the <select>
 *   placeholder {string}   – first empty option label  (default: "Select category…")
 *   emptyLabel  {string}   – for Rules where empty means "no change"
 *   showCustom  {boolean}  – whether to include "✚ Custom…" option (default true for Drawer)
 */
export default function CategorySelect({
    value = '',
    onChange,
    style = {},
    emptyLabel = 'Select category…',
    showCustom = false,
}) {
    return (
        <select
            value={value}
            onChange={e => onChange && onChange(e.target.value)}
            style={{ width: '100%', padding: '8px', ...style }}
        >
            <option value="">{emptyLabel}</option>
            {CATEGORY_GROUPS.map(({ group, label, items }) => (
                <optgroup key={group} label={label}>
                    {items.map(item => (
                        <option key={item} value={item}>{item}</option>
                    ))}
                </optgroup>
            ))}
            {showCustom && <option value="__custom__">✚ Custom Category…</option>}
        </select>
    );
}
