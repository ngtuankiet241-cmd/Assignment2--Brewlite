// Enable only after both manual status endpoints enforce the Staff/payment policy.
// NEXT_PUBLIC values are embedded at build time; enabling requires a new build.
export const STAFF_STATUS_UPDATES_ENABLED = process.env.NEXT_PUBLIC_STAFF_STATUS_UPDATES_ENABLED === 'true';
