/**
 * Evaluation or production — read once from the environment, for the hosted
 * relay (./hosted.ts) and the facility relay (../mesh-server.ts) alike.
 *
 *   NALAMMESH_DEPLOYMENT_MODE      "production", or anything else for an
 *                                  evaluation relay (the default)
 *   NALAMMESH_BOOTSTRAP_ADMIN_PIN  production: six digits, the first Super
 *                                  Admin's PIN; used only while no Super
 *                                  Admin exists
 *   NALAMMESH_BOOTSTRAP_ADMIN_NAME production, optional
 *
 * An evaluation relay signs in the seeded demo roster on the public PIN. A
 * production relay never does, and will not start without the bootstrap PIN
 * — otherwise nobody could ever sign in to create the first account — nor
 * with nowhere durable to keep its state (durabilityProblem below).
 */

export interface RelayMode {
    production: boolean;
    demoAccounts: boolean;
    bootstrapAdmin: { pin: string; name?: string } | null;
    /** What stops a production relay from serving; empty when it can. */
    problems: string[];
}

export function relayModeFromEnv(env: Record<string, string | undefined>): RelayMode {
    const production = env.NALAMMESH_DEPLOYMENT_MODE?.trim().toLowerCase() === 'production';
    if (!production) return { production, demoAccounts: true, bootstrapAdmin: null, problems: [] };
    const pin = env.NALAMMESH_BOOTSTRAP_ADMIN_PIN?.trim() ?? '';
    const problems = /^\d{6}$/.test(pin) ? [] : ['NALAMMESH_BOOTSTRAP_ADMIN_PIN (exactly 6 digits) — a production relay has no demo accounts, so it needs the first Super Admin\'s PIN'];
    return {
        production,
        demoAccounts: false,
        bootstrapAdmin: problems.length === 0 ? { pin, name: env.NALAMMESH_BOOTSTRAP_ADMIN_NAME } : null,
        problems,
    };
}

/**
 * A production relay keeps the staff directory and referrals still waiting for
 * an offline facility. In memory, a restart or a crash would lose both — every
 * account, and the relay would make a fresh bootstrap Super Admin — so it must
 * have a file (NALAMMESH_RELAY_STORE_FILE) or Upstash. Null when it may start.
 */
export function durabilityProblem(mode: Pick<RelayMode, 'production'>, storeKind: 'memory' | 'file' | 'upstash'): string | null {
    return mode.production && storeKind === 'memory'
        ? 'NALAMMESH_RELAY_STORE_FILE (a path on persistent, encrypted, backed-up storage), or Upstash credentials — in memory a restart would lose every staff account and any referral still waiting for an offline facility'
        : null;
}
