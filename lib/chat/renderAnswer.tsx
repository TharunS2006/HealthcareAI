/**
 * Minimal Markdown rendering for an assistant answer.
 *
 * A cloud model replies in Markdown whether or not it was asked to, and the
 * widget used to print it verbatim — so a long answer arrived as a wall of
 * literal `**asterisks**` and `1.` prefixes. The offline layer writes plain
 * prose and passes through this untouched, so the two layers still read alike.
 *
 * Deliberately not a Markdown library, and deliberately never
 * dangerouslySetInnerHTML: this renders text the model produced, which is the
 * one input on this screen that nobody in the building wrote. Everything here
 * builds React text nodes, so the worst a crafted answer can do is look odd.
 * Four constructs are supported because they are the four that models actually
 * emit in a chat bubble — a heading, a bullet, a numbered step, and bold. Tables
 * and links are left as written rather than half-rendered.
 */

// The default import is what the classic JSX transform compiles to, and
// scripts/verify-chat-render.mts runs this file outside Next's automatic
// runtime. Harmless under both; without it the suite cannot load the module.
import React, { Fragment, type ReactNode } from 'react';

/** `*italic*` → <em>, applied inside a segment that is already known not to be bold. */
function withItalic(segment: string, keyPrefix: string): ReactNode[] {
    const parts = segment.split(/\*/);
    // An odd number of segments means the delimiters paired up. An even number
    // means one is unclosed — a lone asterisk in prose — and pretending
    // otherwise would italicise the whole rest of the line.
    if (parts.length % 2 === 0) return [<Fragment key={`${keyPrefix}-raw`}>{segment}</Fragment>];
    return parts.map((part, i) =>
        i % 2 === 1 ? (
            <em key={`${keyPrefix}-i${i}`} className="italic">
                {part}
            </em>
        ) : (
            <Fragment key={`${keyPrefix}-t${i}`}>{part}</Fragment>
        )
    );
}

/** `**bold**` and `*italic*` → <strong>/<em>, with everything else left as text. */
function withBold(line: string, keyPrefix: string): ReactNode[] {
    // Split on the delimiter rather than matching the content, so an unclosed
    // `**` degrades into ordinary text instead of swallowing the rest. Bold is
    // resolved first: splitting on a single `*` would otherwise tear `**` in
    // half and leave stray asterisks on either side.
    const parts = line.split(/\*\*/);
    return parts.map((part, i) =>
        i % 2 === 1 ? (
            <strong key={`${keyPrefix}-b${i}`} className="font-semibold">
                {part}
            </strong>
        ) : (
            <Fragment key={`${keyPrefix}-t${i}`}>{withItalic(part, `${keyPrefix}-${i}`)}</Fragment>
        )
    );
}

export function renderAnswer(text: string): ReactNode {
    const lines = text.split('\n');

    return lines.map((raw, i) => {
        const line = raw.replace(/\s+$/, '');
        const key = `l${i}`;

        if (line.trim() === '') return <div key={key} className="h-2" />;

        // ### Heading
        const heading = /^#{1,6}\s+(.*)$/.exec(line);
        if (heading) {
            return (
                <p key={key} className="mt-1.5 font-semibold text-gov-navy-dark">
                    {withBold(heading[1], key)}
                </p>
            );
        }

        // - bullet  /  * bullet
        const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
        if (bullet) {
            return (
                <p key={key} className="flex gap-1.5 pl-1">
                    <span aria-hidden="true" className="text-slate-500">
                        •
                    </span>
                    <span>{withBold(bullet[1], key)}</span>
                </p>
            );
        }

        // 1. numbered step — the number is kept, because in a protocol answer
        // the order is the content, not decoration.
        const numbered = /^\s*(\d{1,2})[.)]\s+(.*)$/.exec(line);
        if (numbered) {
            return (
                <p key={key} className="flex gap-1.5 pl-1">
                    <span className="font-semibold tabular-nums text-slate-600">{numbered[1]}.</span>
                    <span>{withBold(numbered[2], key)}</span>
                </p>
            );
        }

        return <p key={key}>{withBold(line, key)}</p>;
    });
}
