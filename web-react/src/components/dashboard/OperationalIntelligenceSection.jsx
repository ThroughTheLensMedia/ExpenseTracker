import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiPost, apiPut, apiDelete } from '../../api';
import { 
    SectionHeader, 
    ControlSummaryPanel, 
    SubscriptionActionStrip, 
    TopOffendersSnapshot, 
    RecurringVendorsTable 
} from './OpIntellComponents.jsx';

export default function OperationalIntelligenceSection({ data, onReload }) {
    const navigate = useNavigate();
    const [activeFilter, setActiveFilter] = useState('all');

    // 1. Map raw metrics data to SubscriptionRow format needed by the new UI
    const rows = useMemo(() => {
        if (!data || !Array.isArray(data)) return [];
        
        return data.map((r, idx) => {
            let flag = 'none';
            if (r.flags?.ignored) flag = 'ignored';
            else if (r.flags?.review) flag = 'review';
            else if (r.flags?.duplicate) flag = 'duplicate';
            else if (r.flags?.unused) flag = 'unused';
            else if (r.flags?.isSubscription) flag = 'subscription';
            
            return {
                id: r.vendor + idx,
                vendor: r.vendor,
                monthly_cost: r.avgMonthlyCents || 0,
                annual_cost: r.annualProjectedCents || 0,
                flag: flag,
                isSubscription: r.flags?.isSubscription || false,
                cadenceLabel: r.cadenceLabel || 'Unconfirmed',
                mergedFrom: r.mergedFrom || []
            };
        }).sort((a, b) => b.monthly_cost - a.monthly_cost);
    }, [data]);

    // 2. Derive Summary
    // "Approx Monthly Expense" must be scoped to the same row set as "Active
    // Subscriptions" (isSubscription only) — previously it summed every
    // non-ignored flagged row (review/duplicate/unused too), so a vendor
    // flagged "review" but NOT a subscription would inflate the dollar total
    // without being counted in the subscription count above it. Surfaced by
    // the Subscriptions Radar dashboard widget showing a different number.
    const summary = useMemo(() => {
        const activeRows = rows.filter(r => r.flag !== 'ignored');
        const subRows = activeRows.filter(r => r.isSubscription);
        const subCount = subRows.length;

        let monthlyTotal = 0;
        let reviewCount = 0;
        let reviewMonthlyTotal = 0;
        let duplicateCount = 0;
        let unusedCount = 0;

        subRows.forEach(row => { monthlyTotal += row.monthly_cost; });

        for (const row of activeRows) {
            if (row.flag === 'review') {
                reviewCount++;
                reviewMonthlyTotal += row.monthly_cost;
            }
            if (row.flag === 'duplicate') duplicateCount++;
            if (row.flag === 'unused') unusedCount++;
        }

        let ignoredCount = rows.length - activeRows.length;

        return {
            active_count: subCount,
            monthly_total: monthlyTotal,
            annual_total: monthlyTotal * 12,
            review_count: reviewCount,
            review_monthly_total: reviewMonthlyTotal,
            duplicate_count: duplicateCount,
            unused_count: unusedCount,
            ignored_count: ignoredCount
        };
    }, [rows]);



    // 3. Filter Logic
    const filteredRows = useMemo(() => {
        switch (activeFilter) {
            case 'review': return rows.filter(r => r.flag === 'review');
            case 'duplicate': return rows.filter(r => r.flag === 'duplicate');
            case 'unused': return rows.filter(r => r.flag === 'unused');
            case 'ignored': return rows.filter(r => r.flag === 'ignored');
            case 'subscription': return rows.filter(r => r.isSubscription && r.flag !== 'ignored');
            case 'all':
            default: return rows.filter(r => r.flag !== 'ignored');
        }
    }, [rows, activeFilter]);

    // 4. Top Offenders
    const topOffenders = useMemo(() => rows.filter(r => r.flag !== 'ignored').slice(0, 3), [rows]);

    const handleRowClick = (vendor) => {
        navigate('/transactions?search=' + encodeURIComponent(vendor));
    };

    const handleIgnoreToggle = async (e, vendor, isCurrentlyIgnored) => {
        e.stopPropagation();
        try {
            await apiPost('/vendors/settings', { vendor, is_ignored: !isCurrentlyIgnored });
            // For a smooth experience, aggressively reload so metrics recalculate
            window.location.reload();
        } catch(err) {
            alert('Failed to update vendor settings: ' + err.message);
        }
    };

    const handleMerge = async (vendorKey, canonicalName) => {
        try {
            await apiPut('/vendors/alias', { vendor_key: vendorKey, canonical_name: canonicalName });
            if (onReload) await onReload();
            else window.location.reload();
        } catch (err) {
            alert('Failed to merge vendor: ' + err.message);
        }
    };

    const handleUnmerge = async (vendorKey) => {
        try {
            await apiDelete(`/vendors/alias/${encodeURIComponent(vendorKey)}`);
            if (onReload) await onReload();
            else window.location.reload();
        } catch (err) {
            alert('Failed to unmerge vendor: ' + err.message);
        }
    };

    if (rows.length === 0) {
        return (
            <div className="card glass glow-blue" style={{ margin: 0, padding: '30px' }}>
                <SectionHeader />
                <div className="muted" style={{ fontSize: '13px', fontStyle: 'italic', padding: '20px' }}>No recurring data mapped.</div>
            </div>
        );
    }

    return (
        <div className="card glass glow-blue" style={{ margin: 0, padding: '30px', position: 'relative' }}>
            <SectionHeader />
            <ControlSummaryPanel summary={summary} activeFilter={activeFilter} onChangeFilter={setActiveFilter} />
            
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', gap: '15px' }}>
                <TopOffendersSnapshot offenders={topOffenders} />
                <SubscriptionActionStrip 
                    reviewCount={summary.review_count}
                    duplicateCount={summary.duplicate_count}
                    unusedCount={summary.unused_count}
                    ignoredCount={summary.ignored_count}
                    activeFilter={activeFilter}
                    onChange={setActiveFilter}
                />
            </div>

            <RecurringVendorsTable rows={filteredRows} onRowClick={handleRowClick} onIgnoreToggle={handleIgnoreToggle} onMerge={handleMerge} onUnmerge={handleUnmerge} />
        </div>
    );
}
