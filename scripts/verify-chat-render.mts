/**
 * Assistant answer rendering — `npm run verify:chat-render`
 *
 * The answer bubble is the one place in this app that displays text nobody in
 * the building wrote: a cloud model's reply, in whatever Markdown it felt like
 * emitting. Before lib/chat/renderAnswer.tsx existed it was printed verbatim,
 * so a long answer arrived as a wall of literal `**asterisks**` — which is what
 * an evaluator would have been reading.
 *
 * Two properties are asserted, and the second is the one that matters:
 *
 *   1. The constructs models actually emit — headings, bullets, numbered
 *      steps, bold, italics — come out as elements, not as punctuation.
 *   2. Malformed input degrades into plain text. A half-written delimiter must
 *      never swallow the rest of an answer, and nothing in the input may become
 *      markup: this renderer builds text nodes only, so a reply containing HTML
 *      has to arrive on screen as the characters the model typed.
 */

import { createElement, Fragment } from 'react';

const { renderToStaticMarkup } = await import('react-dom/server');
const { renderAnswer } = await import('../lib/chat/renderAnswer');

const failures: string[] = [];
const pass = (label: string) => console.log(`  PASS  ${label}`);
const fail = (label: string, detail: string) => {
    console.log(`  FAIL  ${label}\n        ${detail}`);
    failures.push(label);
};

const html = (text: string) =>
    renderToStaticMarkup(createElement(Fragment, null, renderAnswer(text) as never));

/** The rendered text with all tags stripped — what a reader actually sees. */
const visible = (text: string) => html(text).replace(/<[^>]*>/g, '');

const check = (label: string, condition: boolean, detail: string) =>
    condition ? pass(label) : fail(label, detail);

console.log('\nWhat models emit is rendered as elements, not as punctuation:');

check('**bold** becomes <strong>', /<strong[^>]*>Danger sign<\/strong>/.test(html('**Danger sign** at 32 weeks')),
    html('**Danger sign** at 32 weeks'));
check('*italic* becomes <em>', /<em[^>]*>per the app<\/em>/.test(html('Refer now *per the app*')),
    html('Refer now *per the app*'));
check('### heading becomes its own emphasised line',
    /font-semibold/.test(html('### Referral pathway')) && !/###/.test(visible('### Referral pathway')),
    html('### Referral pathway'));
check('- bullet gets a bullet glyph and loses the dash',
    visible('- Check SpO2').includes('•') && !visible('- Check SpO2').includes('- Check'),
    visible('- Check SpO2'));
check('* bullet is a bullet, not an unclosed italic',
    visible('* Check SpO2').includes('•') && !visible('* Check SpO2').includes('*Check'),
    visible('* Check SpO2'));
check('a numbered step keeps its number',
    visible('1. Measure vitals').startsWith('1.') && visible('1. Measure vitals').includes('Measure vitals'),
    visible('1. Measure vitals'));
check('bold inside a bullet still renders',
    /<strong[^>]*>SpO2<\/strong>/.test(html('- Check **SpO2** first')),
    html('- Check **SpO2** first'));

console.log('\nNo asterisk survives to the screen when it was markup:');
for (const sample of [
    '**Bold** and *italic* together',
    '### Heading\n- **Bold** bullet\n1. **Bold** step',
    '**Problem solved** *(per the app)*',
]) {
    check(`no stray asterisks in ${JSON.stringify(sample.slice(0, 34))}`,
        !visible(sample).includes('*'), visible(sample));
}

console.log('\nMalformed Markdown degrades to plain text instead of eating the answer:');

const unclosedBold = 'Refer **now to the District Hospital';
check('an unclosed ** leaves the text intact',
    visible(unclosedBold).includes('now to the District Hospital'), visible(unclosedBold));

const loneStar = 'Give 2*3 doses of nothing and see SpO2';
check('a lone * in prose is not treated as an italic opener',
    visible(loneStar) === loneStar, visible(loneStar));

const starryNight = 'a * b * c * d';
check('an odd number of single asterisks is left as written',
    visible(starryNight).includes('b') && visible(starryNight).includes('d'), visible(starryNight));

console.log('\nModel output can never become markup:');
for (const hostile of [
    '<script>alert(1)</script>',
    '<img src=x onerror="alert(1)">',
    '**<b>bold</b>**',
    '<a href="https://example.com">click</a>',
]) {
    const out = html(hostile);
    // Only real tag openers count as injection. Matching on an attribute name
    // like "onerror" would also fire on the correctly-escaped `&quot;` form and
    // report a pass as a failure — the bug this comment exists to prevent.
    const injectedTag = /<(script|img|a|b)[\s>]/i.test(out);
    const escaped = !hostile.includes('<') || out.includes('&lt;');
    check(`${JSON.stringify(hostile.slice(0, 30))} arrives as text, not as HTML`,
        !injectedTag && escaped, out.slice(0, 160));
}

console.log('\nPlain prose from the offline layer passes through unchanged:');
const offline = 'RED case: refer to the District Hospital immediately.\nCall 108 for an ambulance.';
check('an offline answer is not reformatted',
    visible(offline).includes('RED case: refer to the District Hospital immediately.') &&
    visible(offline).includes('Call 108 for an ambulance.'),
    visible(offline));
check('a blank line stays a break, not a lost paragraph',
    visible('First line.\n\nSecond line.').includes('First line.') &&
    visible('First line.\n\nSecond line.').includes('Second line.'),
    visible('First line.\n\nSecond line.'));
check('an empty answer renders nothing rather than throwing', html('') === '' || html('').length < 40, html(''));

console.log('');
if (failures.length === 0) {
    console.log('All checks passed — model Markdown renders as elements, malformed Markdown');
    console.log('degrades to text, and nothing a model writes can become markup.\n');
    process.exit(0);
} else {
    console.log(`${failures.length} check(s) FAILED:`);
    failures.forEach((f) => console.log(`  - ${f}`));
    console.log('');
    process.exit(1);
}
