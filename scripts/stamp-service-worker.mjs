/**
 * After `next build`: give out/sw.js this build's id and file list — `postbuild`
 *
 * The service worker pre-caches the app so a facility without signal can still
 * open it. Two things only the build knows make that work:
 *
 *   - the build id, so each deploy installs a new worker that caches its own
 *     files (an unchanged sw.js leaves phones offline on the previous build), and
 *   - every file under /_next/static, including the chunks a screen loads only
 *     when it needs them, which no page's HTML names.
 *
 * npm runs this after every `npm run build`. It fails the build when out/sw.js
 * has no placeholders to fill, rather than ship a worker that quietly caches
 * less than it should.
 */

import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const ID_PLACEHOLDER = "'__NALAMMESH_BUILD_ID__'";
const ASSETS_PLACEHOLDER = '/*__NALAMMESH_BUILD_ASSETS__*/';

async function filesUnder(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    const nested = await Promise.all(entries.map(e => (e.isDirectory() ? filesUnder(join(dir, e.name)) : [join(dir, e.name)])));
    return nested.flat();
}

/** Stamp `<outDir>/sw.js`; returns what it wrote. Throws when there is nothing to stamp. */
export async function stamp(outDir, buildId) {
    const sw = join(outDir, 'sw.js');
    const assets = (await filesUnder(join(outDir, '_next', 'static')))
        .filter(f => !f.endsWith('.map'))
        .map(f => `/${relative(outDir, f).split(sep).join('/')}`)
        .sort();

    const source = await readFile(sw, 'utf8');
    if (!source.includes(ID_PLACEHOLDER) || !source.includes(ASSETS_PLACEHOLDER)) {
        if (source.includes(`const BUILD_ID = ${JSON.stringify(buildId)};`)) return { buildId, assets, already: true };
        throw new Error(`${sw} has no build placeholders to fill (${ID_PLACEHOLDER}, ${ASSETS_PLACEHOLDER})`);
    }
    // Replacer functions, so nothing in a file name is read as a replacement pattern.
    const stamped = source
        .replace(ID_PLACEHOLDER, () => JSON.stringify(buildId))
        .replace(ASSETS_PLACEHOLDER, () => assets.map(a => JSON.stringify(a)).join(','));
    await writeFile(sw, stamped);
    return { buildId, assets, already: false };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
    const out = new URL('../out/', import.meta.url).pathname;
    try {
        const buildId = (await readFile(new URL('../.next/BUILD_ID', import.meta.url), 'utf8')).trim();
        const { assets, already } = await stamp(out, buildId);
        console.log(already
            ? `out/sw.js already stamped for build ${buildId}`
            : `out/sw.js stamped: build ${buildId}, ${assets.length} build files to pre-cache`);
    } catch (err) {
        console.error(`Could not stamp the service worker: ${err.message}`);
        process.exit(1);
    }
}
