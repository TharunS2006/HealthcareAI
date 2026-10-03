/**
 * Content Security Policy check — `npm run verify:csp`
 *
 *   1. LOCKED       scripts only from this origin, no eval; no plugins; no
 *                   foreign <base> or form targets
 *   2. CONFIGURED   a build with its endpoints set may connect to exactly
 *                   those (and their websocket twins), and nothing else
 *   3. LAN BUILD    without them it may connect anywhere — it finds its relay
 *                   by host — while scripts stay locked
 *   4. HEADERS      vercel.json forbids framing and limits device access to
 *                   the microphone (voice triage)
 */

import { readFileSync } from 'node:fs';
const { contentSecurityPolicy } = await import('../lib/security/csp');

let failures = 0;
function check(label: string, condition: boolean, detail = ''): void {
    if (condition) console.log(` PASS ${label}`);
    else {
        failures += 1;
        console.log(` FAIL ${label}${detail ? ` — ${detail}` : ''}`);
    }
}
const parse = (policy: string) => Object.fromEntries(policy.split(';').map(d => d.trim().split(/\s+/)).map(([k, ...v]) => [k, v]));

const hosted = parse(contentSecurityPolicy({
    NEXT_PUBLIC_MESH_URL: 'https://nalammesh-relay.vercel.app/',
    NEXT_PUBLIC_REPORTING_URL: 'https://district.example.gov.in/api',
    NEXT_PUBLIC_CHAT_URL: 'https://nalammesh-chat.vercel.app',
}));
const lan = parse(contentSecurityPolicy({}));

console.log('\n1. LOCKED');
for (const [name, p] of [['hosted', hosted], ['LAN', lan]] as const) {
    check(`${name}: scripts from this origin only, never eval`, p['script-src'].join(' ') === "'self' 'unsafe-inline'", p['script-src'].join(' '));
    check(`${name}: no plugins, no foreign <base> or form targets`, p['object-src'][0] === "'none'" && p['base-uri'][0] === "'self'" && p['form-action'][0] === "'self'");
    check(`${name}: map tiles allowed as images`, p['img-src'].includes('https://*.tile.openstreetmap.org'));
}

console.log('\n2. CONFIGURED');
const c = hosted['connect-src'];
check('the relay, over HTTPS and its websocket', c.includes('https://nalammesh-relay.vercel.app') && c.includes('wss://nalammesh-relay.vercel.app'), c.join(' '));
check('the district service, by origin', c.includes('https://district.example.gov.in'), c.join(' '));
check('the assistant', c.includes('https://nalammesh-chat.vercel.app'));
check('nothing else', c.length === 5 && !c.some(v => /^(https?|wss?):$/.test(v)), c.join(' '));

console.log('\n3. LAN BUILD');
check('connections open, since the relay is found by host', ['http:', 'https:', 'ws:', 'wss:'].every(s => lan['connect-src'].includes(s)), lan['connect-src'].join(' '));
check('a half-configured build is treated as a LAN build, not locked out of its relay',
    parse(contentSecurityPolicy({ NEXT_PUBLIC_MESH_URL: 'http://192.168.1.9:3001' }))['connect-src'].includes('http:'));

console.log('\n4. HEADERS');
const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
const all = Object.fromEntries(vercel.headers.find((h: { source: string }) => h.source === '/(.*)').headers.map((h: { key: string; value: string }) => [h.key, h.value]));
check('framing forbidden (CSP frame-ancestors and X-Frame-Options)', all['Content-Security-Policy'] === "frame-ancestors 'none'" && all['X-Frame-Options'] === 'DENY');
check('no MIME sniffing', all['X-Content-Type-Options'] === 'nosniff');
check('microphone for this origin only; no camera or location', /microphone=\(self\)/.test(all['Permissions-Policy']) && /camera=\(\)/.test(all['Permissions-Policy']) && /geolocation=\(\)/.test(all['Permissions-Policy']));

console.log(failures === 0 ? '\nAll CSP checks passed.\n' : `\n${failures} check(s) FAILED.\n`);
process.exit(failures === 0 ? 0 : 1);
