/**
 * Evaluation or production build — NEXT_PUBLIC_DEPLOYMENT_MODE, fixed at build.
 *
 * An evaluation build (the default) opens with a fictional district — seeded
 * patients, referrals and a demo account per role on the public PIN — so every
 * feature can be tried at once, and says so on every page. A production build
 * seeds nothing but the facility list and has no demo accounts: staff sign in
 * with the Staff ID and PIN the Super Admin gave them (pair it with a relay
 * started with NALAMMESH_DEPLOYMENT_MODE=production, server/relay/mode.ts).
 */
export const PRODUCTION = process.env.NEXT_PUBLIC_DEPLOYMENT_MODE?.trim().toLowerCase() === 'production';
