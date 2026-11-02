import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { buildGalleryData } from './build-gallery.mjs';
import { projectRoot } from './validate-theme.mjs';

export function normalizeGalleryUrl(value) {
    const url = new URL(value);
    const local = url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if ((!local && url.protocol !== 'https:') || url.username || url.password || url.search || url.hash) {
        throw new Error('Use a public HTTPS gallery URL (or HTTP loopback for local tests), without credentials, query or fragment.');
    }
    if (!url.pathname.endsWith('/')) {
        url.pathname += '/';
    }
    return url;
}

export function expectedGalleryFiles(root = projectRoot) {
    const catalog = JSON.parse(readFileSync(resolve(root, 'catalog/icons.json'), 'utf8'));
    const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
    const data = buildGalleryData(catalog, manifest);
    const files = new Map();
    for (const file of ['index.html', 'styles.css', 'app.mjs', 'model.mjs']) {
        files.set(file, readFileSync(resolve(root, 'gallery', file)));
    }
    files.set('data.json', Buffer.from(`${JSON.stringify(data, null, 2)}\n`));
    files.set('assets/logo.png', readFileSync(resolve(root, 'assets/logo.png')));
    files.set('LICENSE.txt', readFileSync(resolve(root, 'LICENSE')));
    files.set('ICON_NOTICES.txt', readFileSync(resolve(root, 'ICON_NOTICES.txt')));
    for (const path of new Set(data.entries.flatMap(entry => [entry.icon, entry.openIcon].filter(Boolean)))) {
        files.set(path, readFileSync(resolve(root, path)));
    }
    return { files, entries: data.entries.length, assets: data.assetCount };
}

export async function verifyLiveGallery(value, { root = projectRoot, fetchImpl = fetch } = {}) {
    const base = normalizeGalleryUrl(value);
    const { files, entries, assets } = expectedGalleryFiles(root);
    const paths = [...files.keys()];
    let cursor = 0;
    let failure;
    let checked = 0;

    // A small, fixed pool limits load on the public site. Stop scheduling after failure.
    await Promise.all(Array.from({ length: 6 }, async () => {
        while (!failure && cursor < paths.length) {
            const path = paths[cursor++];
            try {
                const expected = files.get(path);
                const url = new URL(path === 'index.html' ? './' : path, base);
                url.searchParams.set('_verify', createHash('sha256').update(expected).digest('hex').slice(0, 16));
                const response = await fetchImpl(url, { cache: 'no-store', signal: AbortSignal.timeout(15000) });
                if (response.status !== 200) {
                    throw new Error(`${path}: expected HTTP 200, got ${response.status}.`);
                }
                const actual = Buffer.from(await response.arrayBuffer());
                if (!actual.equals(expected)) {
                    throw new Error(`${path}: public content differs from the tested commit (stale deployment or missing asset).`);
                }
                if (path.endsWith('.mjs') && !/^(text|application)\/(javascript|ecmascript)(;|$)/i.test(response.headers.get('content-type') ?? '')) {
                    throw new Error(`${path}: the host must serve ES modules with a JavaScript MIME type.`);
                }
                checked++;
            } catch (error) {
                failure ??= error;
            }
        }
    }));
    if (failure) {
        throw failure;
    }
    return { url: base.href, files: checked, entries, assets };
}

export async function main(args = process.argv.slice(2)) {
    try {
        const { values } = parseArgs({ args, options: { url: { type: 'string' }, attempts: { type: 'string', default: '5' } } });
        if (!values.url) {
            throw new Error('Usage: node scripts/check-live-gallery.mjs --url https://owner.github.io/repository/ [--attempts 1..5]');
        }
        const attempts = Number(values.attempts);
        if (!Number.isInteger(attempts) || attempts < 1 || attempts > 5) {
            throw new Error('attempts must be an integer between 1 and 5.');
        }
        normalizeGalleryUrl(values.url);
        for (let attempt = 1; attempt <= attempts; attempt++) {
            try {
                const result = await verifyLiveGallery(values.url);
                console.log(`Published gallery verified: ${result.url}\n${result.entries} entries, ${result.assets} SVGs, ${result.files} source-matching public files.`);
                return 0;
            } catch (error) {
                if (attempt === attempts) {
                    throw error;
                }
                console.warn(`Verification ${attempt}/${attempts}: ${error.message} Retrying in 15 seconds for Pages/CDN propagation.`);
                await sleep(15000);
            }
        }
    } catch (error) {
        console.error(error.message);
        return 1;
    }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    process.exitCode = await main();
}
