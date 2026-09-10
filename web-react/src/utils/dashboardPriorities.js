function money(cents) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
    }).format((Number(cents) || 0) / 100);
}

export function getDashboardPriorities(metrics, taxRate = 30) {
    if (!metrics) return [];

    const priorities = [];
    const snapshot = metrics.snapshot || {};
    const obligations = metrics.obligations || {};
    const recurringVendors = metrics.analytics?.recurringVendors || [];
    const recurringReviewCount = recurringVendors.filter(vendor => vendor.flags?.review).length;

    if ((obligations.overdueInvoices || 0) > 0) {
        priorities.push({
            tone: 'risk',
            title: `Collect ${obligations.overdueInvoices} overdue invoice${obligations.overdueInvoices === 1 ? '' : 's'}`,
            detail: `${money(obligations.overdueCents)} is past due.`,
            action: 'Review invoices',
            path: '/crm/financials',
        });
    } else if ((obligations.dueSoonCount || 0) > 0) {
        priorities.push({
            tone: 'watch',
            title: `${obligations.dueSoonCount} invoice${obligations.dueSoonCount === 1 ? '' : 's'} due this week`,
            detail: 'Confirm delivery and payment timing.',
            action: 'Review invoices',
            path: '/crm/financials',
        });
    }

    if ((obligations.draftInvoices || 0) > 0) {
        priorities.push({
            tone: 'watch',
            title: `${obligations.draftInvoices} draft invoice${obligations.draftInvoices === 1 ? '' : 's'} waiting`,
            detail: 'Review and send completed drafts.',
            action: 'Open invoices',
            path: '/crm/financials',
        });
    }

    if ((snapshot.ytdSpend || 0) > 0 && (snapshot.ytdDeductibleCents || 0) === 0) {
        priorities.push({
            tone: 'watch',
            title: 'Review tax deductions',
            detail: `${money(snapshot.ytdSpend)} of recorded spending has produced no YTD deductions.`,
            action: 'Review Schedule C',
            path: '/tax',
        });
    }

    if (recurringReviewCount > 0) {
        priorities.push({
            tone: 'watch',
            title: `Review ${recurringReviewCount} recurring charge${recurringReviewCount === 1 ? '' : 's'}`,
            detail: 'Confirm these vendors are expected and still useful.',
            action: 'Review transactions',
            path: '/transactions',
        });
    }

    if ((snapshot.mtdIncome || 0) > 0 && (snapshot.mtdSpend || 0) > snapshot.mtdIncome) {
        priorities.push({
            tone: 'risk',
            title: 'Monthly spending is above revenue',
            detail: `${money(snapshot.mtdSpend - snapshot.mtdIncome)} more spent than earned this month.`,
            action: 'Review transactions',
            path: '/transactions',
        });
    }

    if (priorities.length === 0) {
        return [{
            tone: 'healthy',
            title: 'No urgent actions in current data',
            detail: `Your dashboard has no overdue invoices, unsent drafts, or flagged financial exceptions. Estimated tax rate: ${Number(taxRate) || 30}%.`,
            action: 'Review transactions',
            path: '/transactions',
        }];
    }

    return priorities.slice(0, 3);
}

export function getSubscriptionStatusLabel(subscription, daysLeft) {
    if (!subscription) return 'INVITE REQUIRED';

    const plan = String(subscription.plan_type || 'account').replaceAll('_', ' ').toUpperCase();
    if (daysLeft === null || daysLeft === undefined || Number.isNaN(daysLeft)) {
        return `${plan} • ACTIVE`;
    }
    if (daysLeft <= 0) return `${plan} • EXPIRED`;
    return `${plan} • ${daysLeft}D LEFT`;
}
