import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { expectedGalleryFiles, normalizeGalleryUrl, verifyLiveGallery } from './check-live-gallery.mjs';
import { projectRoot } from './validate-theme.mjs';

const { files, entries, assets } = expectedGalleryFiles();
const base = 'https://owner.github.io/jerrys-pixel-icons/';

function fakeFetch(modify) {
    return async (url, options) => {
        assert.equal(options.cache, 'no-store');
        assert.ok(options.signal instanceof AbortSignal);
        assert.equal(url.origin, 'https://owner.github.io');
        assert.ok(url.pathname.startsWith('/jerrys-pixel-icons/'));
        assert.match(url.searchParams.get('_verify'), /^[a-f0-9]{16}$/);
        const path = url.pathname.slice('/jerrys-pixel-icons/'.length) || 'index.html';
        const replacement = modify?.(path);
        return replacement ?? new Response(files.get(path), {
            status: files.has(path) ? 200 : 404,
            headers: { 'Content-Type': path.endsWith('.mjs') ? 'text/javascript; charset=utf-8' : 'application/octet-stream' },
        });
    };
}

test('public gallery URL supports repository subpaths and custom domains', () => {
    assert.equal(normalizeGalleryUrl('https://owner.github.io/jerrys-pixel-icons').href, base);
    assert.equal(normalizeGalleryUrl('https://icons.example.com').href, 'https://icons.example.com/');
    assert.equal(normalizeGalleryUrl('http://127.0.0.1:4173').href, 'http://127.0.0.1:4173/');
});

for (const url of ['http://example.com', 'ftp://example.com', 'https://user:secret@example.com',
    'https://example.com/?q=test', 'https://example.com/#section', 'invalid']) {
    test('reject unsafe or ambiguous gallery URL: ' + url.replace('user:secret', 'credentials'), () => {
        assert.throws(() => normalizeGalleryUrl(url));
    });
}

test('expected publication includes the UI, data and every unique SVG, not source files', () => {
    for (const path of ['index.html', 'styles.css', 'app.mjs', 'model.mjs', 'data.json', 'assets/logo.png', 'LICENSE.txt']) {
        assert.ok(files.has(path));
    }
    assert.equal([...files.keys()].filter(path => path.endsWith('.svg')).length, assets);
    assert.equal(files.size, assets + 7);
    assert.ok([...files.keys()].every(path => !path.startsWith('catalog/') && !path.startsWith('scripts/')));
});

test('verification checks source bytes for the whole site and preserves the Pages base path', async () => {
    const result = await verifyLiveGallery(base, { fetchImpl: fakeFetch() });
    assert.deepEqual(result, { url: base, files: files.size, entries, assets });
});

test('public HTTP 200 does not mask a stale deployment', async () => {
    await assert.rejects(verifyLiveGallery(base, { fetchImpl: fakeFetch(path => path === 'data.json' ?
        new Response('{"entries":[]}', { status: 200 }) : undefined) }), /data.json: public content differs/);
});

test('missing SVG on the public host fails verification', async () => {
    await assert.rejects(verifyLiveGallery(base, { fetchImpl: fakeFetch(path => path === 'icons/files/js.svg' ?
        new Response('not found', { status: 404 }) : undefined) }), /icons\/files\/js.svg: expected HTTP 200, got 404/);
});

test('a changed SVG is detected even with HTTP 200', async () => {
    await assert.rejects(verifyLiveGallery(base, { fetchImpl: fakeFetch(path => path === 'icons/files/js.svg' ?
        new Response('<svg/>') : undefined) }), /icons\/files\/js.svg: public content differs/);
});

test('wrong module MIME type fails even if JavaScript bytes are correct', async () => {
    await assert.rejects(verifyLiveGallery(base, { fetchImpl: fakeFetch(path => path === 'app.mjs' ?
        new Response(files.get(path), { headers: { 'Content-Type': 'application/octet-stream' } }) : undefined) }), /JavaScript MIME type/);
});

test('HTTP verification caps concurrency and waits for requests to finish', async () => {
    let active = 0;
    let max = 0;
    const response = fakeFetch();
    await verifyLiveGallery(base, { fetchImpl: async (...args) => {
        active++;
        max = Math.max(max, active);
        await setImmediate();
        const result = await response(...args);
        active--;
        return result;
    } });
    assert.ok(max > 1 && max <= 6);
    assert.equal(active, 0);
});

test('HTTP verification stops scheduling new requests after a failure', async () => {
    let requests = 0;
    await assert.rejects(verifyLiveGallery(base, { fetchImpl: async () => {
        requests++;
        return new Response('not found', { status: 404 });
    } }), /expected HTTP 200/);
    assert.ok(requests <= 6);
});

test('network failures propagate instead of counting as success', async () => {
    await assert.rejects(verifyLiveGallery(base, { fetchImpl: async () => { throw new Error('network unavailable'); } }), /network unavailable/);
});

test('CLI rejects invalid arguments without making HTTP requests', () => {
    for (const args of [[], ['--url', base, '--attempts', '0'], ['--url', 'http://example.com'], ['--unknown']]) {
        const result = spawnSync(process.execPath, [resolve(projectRoot, 'scripts/check-live-gallery.mjs'), ...args], { encoding: 'utf8' });
        assert.equal(result.status, 1);
        assert.ok(result.stderr.trim());
    }
});
