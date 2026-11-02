import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { buildGallery, buildGalleryData } from './build-gallery.mjs';
import { createGalleryServer } from './serve-gallery.mjs';
import { projectRoot } from './validate-theme.mjs';
import { filterEntries, normalize, paramsFromState, stateFromParams } from '../gallery/model.mjs';

const catalog = JSON.parse(readFileSync(resolve(projectRoot, 'catalog/icons.json'), 'utf8'));
const manifest = JSON.parse(readFileSync(resolve(projectRoot, 'package.json'), 'utf8'));
const data = buildGalleryData(catalog, manifest);
const theme = JSON.parse(readFileSync(resolve(projectRoot, 'themes/icon-theme.json')));

function fixture(t) {
    const root = mkdtempSync(join(tmpdir(), 'jerry-gallery-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    for (const path of ['catalog', 'icons', 'assets', 'gallery', 'package.json', 'LICENSE']) {
        cpSync(resolve(projectRoot, path), resolve(root, path), { recursive: true });
    }
    return root;
}

test('gallery represents every catalog entry and derives folder asset pairs', () => {
    assert.equal(data.entries.length, catalog.files.length + catalog.folders.length);
    assert.equal(data.assetCount, new Set(Object.values(theme.iconDefinitions).map(item => item.iconPath)).size);
    const folder = data.entries.find(entry => entry.id === 'vscode_file');
    assert.equal(folder.openIcon, 'icons/folders/vscode-open.svg');
    assert.equal(folder.openId, 'vscode_open');
    assert.equal(data.entries.find(entry => entry.id === 'js').label, 'JavaScript');
});

for (const [query, id] of [['javascript', 'js'], ['.py', 'py'], ['golang', 'go'], ['C++', 'cpp'],
    ['C#', 'cs'], ['react tsx', 'tsx'], ['package.json', 'node2'], ['configuracion', 'conf']]) {
    test(`search finds ${id} by ${query}`, () => {
        assert.ok(filterEntries(data.entries, { query }).some(entry => entry.id === id));
    });
}

test('accent normalization and AND token search work without mutating data', () => {
    const order = data.entries.map(entry => entry.key);
    assert.equal(normalize('Configuración'), 'configuracion');
    assert.ok(filterEntries(data.entries, { query: '  react    typescript  ' }).some(entry => entry.id === 'tsx'));
    assert.equal(filterEntries(data.entries, { query: 'react definitely-not-present' }).length, 0);
    assert.deepEqual(data.entries.map(entry => entry.key), order);
});

test('type filters match source counts', () => {
    assert.equal(filterEntries(data.entries, { type: 'folder' }).length, catalog.folders.length);
    assert.equal(filterEntries(data.entries, { type: 'file' }).length, catalog.files.length);
    assert.equal(filterEntries(data.entries, { query: 'not-present' }).length, 0);
});

test('association sort places greater coverage first', () => {
    const sorted = filterEntries(data.entries, { sort: 'associations' });
    const count = entry => entry.names.length + entry.extensions.length;
    assert.ok(sorted.every((entry, index) => index === 0 || count(sorted[index - 1]) >= count(entry)));
});

test('gallery URL state roundtrips and rejects unknown control values', () => {
    const state = { query: 'C# .cs', type: 'file', open: true, sort: 'associations' };
    assert.deepEqual(stateFromParams(paramsFromState(state)), state);
    assert.equal(paramsFromState({ query: '', type: 'all', open: false, sort: 'name' }).toString(), '');
    assert.deepEqual(stateFromParams(new URLSearchParams('type=invalid&sort=invalid&folders=invalid')),
        { query: '', type: 'all', open: false, sort: 'name' });
});

test('static build is self-contained, current and repeatable', t => {
    const root = fixture(t);
    const first = buildGallery(root);
    const json = readFileSync(join(first.output, 'data.json'), 'utf8');
    assert.deepEqual(JSON.parse(json), data);
    for (const entry of data.entries) {
        for (const path of [entry.icon, entry.openIcon].filter(Boolean)) {
            assert.deepEqual(readFileSync(join(first.output, path)), readFileSync(join(projectRoot, path)));
        }
    }
    for (const filename of ['index.html', 'styles.css', 'app.mjs', 'model.mjs', 'assets/logo.png', 'LICENSE.txt']) {
        assert.ok(existsSync(join(first.output, filename)));
    }
    writeFileSync(join(first.output, 'stale.txt'), 'stale generated file');
    buildGallery(root);
    assert.equal(readFileSync(join(first.output, 'data.json'), 'utf8'), json);
    assert.equal(existsSync(join(first.output, 'stale.txt')), false);
    assert.equal(existsSync(join(first.output, 'catalog/icons.json')), false);
});

test('bad artwork prevents a gallery rebuild before the old output is touched', t => {
    const root = fixture(t);
    const { output } = buildGallery(root);
    writeFileSync(join(output, 'sentinel.txt'), 'old output');
    rmSync(join(root, 'icons/folders/folder-open.svg'));
    assert.throws(() => buildGallery(root), /Cannot build gallery/);
    assert.equal(readFileSync(join(output, 'sentinel.txt'), 'utf8'), 'old output');
});

test('preview only serves generated files with correct types and blocks escapes', async t => {
    const root = fixture(t);
    const { output } = buildGallery(root);
    writeFileSync(join(root, 'private.txt'), 'not public');
    symlinkSync(join(root, 'private.txt'), join(output, 'leak.txt'));
    const server = createGalleryServer(output);
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    t.after(() => new Promise(resolve => server.close(resolve)));
    const base = `http://127.0.0.1:${server.address().port}`;
    for (const [path, type] of [['/', 'text/html'], ['/app.mjs', 'text/javascript'],
        ['/data.json', 'application/json'], ['/icons/files/js.svg', 'image/svg+xml']]) {
        const response = await fetch(base + path);
        assert.equal(response.status, 200);
        assert.equal(response.headers.get('content-type').split(';')[0], type);
        assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
        await response.arrayBuffer();
    }
    for (const path of ['/missing.svg', '/catalog/icons.json', '/leak.txt', '/%2e%2e%2fprivate.txt', '/%ZZ']) {
        assert.equal((await fetch(base + path)).status, 404);
    }
    const head = await fetch(base + '/data.json', { method: 'HEAD' });
    assert.equal(head.status, 200);
    assert.equal(await head.text(), '');
    assert.equal((await fetch(base, { method: 'POST' })).status, 405);
});
