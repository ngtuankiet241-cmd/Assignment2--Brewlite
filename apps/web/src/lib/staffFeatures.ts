// NEXT_PUBLIC values are embedded at build time; changing this requires a new build.
// Staff actions are enabled by default; deployments can explicitly disable them.
const configured = process.env.NEXT_PUBLIC_STAFF_STATUS_UPDATES_ENABLED;
export const STAFF_STATUS_UPDATES_ENABLED = configured === undefined || configured === 'true';
