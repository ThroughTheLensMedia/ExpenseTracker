export const EXPERIENCE_MODES = Object.freeze({
    BUSINESS: 'business',
    PERSONAL: 'personal',
});

export const BUSINESS_ONLY_PATHS = Object.freeze([
    '/tax',
    '/mileage',
    '/equipment',
    '/crm',
    '/clients',
]);

export function getExperienceMode(settings) {
    const localPreviewMode = import.meta.env?.DEV
        ? import.meta.env.VITE_PREVIEW_EXPERIENCE_MODE
        : null;
    if (localPreviewMode === EXPERIENCE_MODES.PERSONAL) return EXPERIENCE_MODES.PERSONAL;
    if (localPreviewMode === EXPERIENCE_MODES.BUSINESS) return EXPERIENCE_MODES.BUSINESS;

    return settings?.experience_mode === EXPERIENCE_MODES.PERSONAL
        ? EXPERIENCE_MODES.PERSONAL
        : EXPERIENCE_MODES.BUSINESS;
}

export function isBusinessExperience(settings) {
    return getExperienceMode(settings) === EXPERIENCE_MODES.BUSINESS;
}

export function getAssistantExperienceCopy(settings) {
    if (getExperienceMode(settings) === EXPERIENCE_MODES.PERSONAL) {
        return {
            dataScope: 'your transactions and spending history',
            examples: [
                'How much did I spend on travel this quarter?',
                'What is my top spending category this year?',
                'Which recurring charges should I review?',
                'Show my spending trend for the last six months',
            ],
        };
    }

    return {
        dataScope: 'your ledger, invoices, and CRM',
        examples: [
            'How much did I spend on travel this quarter?',
            'Mark invoice #0428 as paid',
            'What is my top spending category this year?',
            'Move the FotoFetch lead to Booked',
        ],
    };
}
