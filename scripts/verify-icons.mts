/**
 * Icon path check — `npm run verify:icons`
 *
 * Every inline SVG path (d="…") in app/, components/ and lib/ must parse under
 * the SVG path grammar. A browser that cannot parse a path draws nothing and
 * logs an error; five icons were silently blank that way after a text
 * clean-up collapsed "0 .375" into "0.375".
 */


import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
const files = execSync("grep -rlE '\\bd=\"' app components lib --include='*.tsx' --include='*.ts'").toString().trim().split('\n');
const ARGS: Record<string, number> = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };
function validate(d: string): string | null {
  let i = 0; const s = d;
  const ws = () => { while (i < s.length && /[\s,]/.test(s[i])) i++; };
  const num = () => { ws(); const m = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(s.slice(i)); if (!m) return false; i += m[0].length; return true; };
  const flag = () => { ws(); if (s[i] === '0' || s[i] === '1') { i++; return true; } return false; };
  ws(); let first = true;
  while (i < s.length) {
    const c = s[i]; const up = c?.toUpperCase();
    if (!(up in ARGS)) return `unexpected "${s.slice(i, i + 12)}"`;
    if (first && up !== 'M') return 'must start with M';
    first = false; i++;
    const n = ARGS[up]; if (n === 0) { ws(); continue; }
    let sets = 0;
    for (;;) {
      ws(); const save = i;
      let ok = true;
      for (let k = 0; k < n; k++) { ok = (up === 'A' && (k === 3 || k === 4)) ? flag() : num(); if (!ok) break; }
      if (!ok) { i = save; if (sets === 0) return `bad args for ${c} at "${s.slice(save, save + 20)}"`; break; }
      sets++; ws(); if (i >= s.length || /[A-Za-z]/.test(s[i])) break;
    }
  }
  return null;
}
let bad = 0;
let checked = 0;
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(/\bd="([^"]+)"/g)) {
    // A path built at run time (d="${...}") cannot be read here; its generator
    // is checked by its own suite (lib/qr.ts → verify:qr).
    if (m[1].includes('${')) continue;
    checked++;
    const err = validate(m[1]);
    if (err) { bad++; const line = src.slice(0, m.index).split('\n').length; console.log(`${f}:${line}  ${err}`); }
  }
}
console.log(bad === 0 ? `All ${checked} icon paths parse.` : `${bad} invalid path(s).`);
process.exit(bad === 0 ? 0 : 1);
