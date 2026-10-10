/**
 * Strip personal identifiers out of a question before it leaves the device.
 *
 * Layer 2 of the assistant may be a model run by a third party outside the
 * department (Groq, xAI, Anthropic) unless the deployment points it at its own
 * server. The grounding brief carries no patient data, but the question is
 * whatever the worker typed — and "Ramesh's mobile is 98765 43210, BP 180/110,
 * what next?" is a natural way to ask. Numbers that identify a person are
 * replaced here; the server repeats the same step (backend/app/chat_guard.py)
 * for any caller that is not this widget. Both copies are held to one set of
 * cases, scripts/fixtures/redaction-cases.json.
 *
 * Names cannot be found reliably by a pattern, which is why the widget also
 * asks people not to type them.
 *
 * No lookbehind: older WebViews reject it at parse time, which would take the
 * whole widget down. A captured leading character does the same job.
 */

// An ASCII or a Devanagari digit (०-९) — Hindi and Marathi keyboards type the
// latter. JavaScript's \d is ASCII only, so it is spelled out.
const D = '[0-9०-९]';
const D29 = '[2-9२-९]';
const D69 = '[6-9६-९]';
const START = `(^|[^0-9०-९])`;
const END = `(?!${D})`;

interface Rule {
    label: string;
    pattern: RegExp;
    /** True when group 1 is the preceding character, put back on replace. */
    lead: boolean;
}

// Same order as the server: email and ABHA address, +91 mobiles, then the
// 14-digit ABHA number before the 12-digit Aadhaar before the 10-digit mobile,
// so a long number is removed whole rather than in pieces.
const RULES: Rule[] = [
    { label: 'email or ABHA address', pattern: /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*/g, lead: false },
    { label: 'phone number', pattern: new RegExp(`\\+91[ -]?${D69}${D}{4}[ -]?${D}{5}${END}`, 'g'), lead: false },
    { label: 'ABHA number', pattern: new RegExp(`${START}${D}{2}[ -]?${D}{4}[ -]?${D}{4}[ -]?${D}{4}${END}`, 'g'), lead: true },
    { label: 'Aadhaar number', pattern: new RegExp(`${START}${D29}${D}{3}[ -]?${D}{4}[ -]?${D}{4}${END}`, 'g'), lead: true },
    { label: 'phone number', pattern: new RegExp(`${START}[0०]?${D69}${D}{4}[ -]?${D}{5}${END}`, 'g'), lead: true },
    // Nine or more digits in a row is an identifier of some kind; no vital
    // sign, date or count a health worker types is that long.
    { label: 'ID number', pattern: new RegExp(`${START}${D}{9,}${END}`, 'g'), lead: true },
];

export interface Redacted {
    text: string;
    /** How many identifiers were replaced. */
    removed: number;
}

export function redactIdentifiers(input: string): Redacted {
    let text = input;
    let removed = 0;
    for (const rule of RULES) {
        text = text.replace(rule.pattern, (_match: string, lead?: string) => {
            removed += 1;
            return `${rule.lead ? lead ?? '' : ''}[${rule.label} removed]`;
        });
    }
    return { text, removed };
}
