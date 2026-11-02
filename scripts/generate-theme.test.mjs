import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { buildTheme, serializeTheme } from './generate-theme.mjs';
import { projectRoot } from './validate-theme.mjs';

const sourceCatalog = JSON.parse(readFileSync(resolve(projectRoot, 'catalog/icons.json'), 'utf8'));
const minimalCatalog = () => ({ version: 1, defaults: { file: 'file', folder: 'folder' },
    files: [{ id: 'file', extensions: ['ts', 'js'], names: ['README.md'] }],
    folders: [{ id: 'folder', names: ['src', 'source'] }] });

function fixture(t) {
    const root = mkdtempSync(join(tmpdir(), 'jerry-generate-test-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    for (const dir of ['catalog', 'themes', 'icons/files', 'icons/folders']) {
        mkdirSync(join(root, dir), { recursive: true });
    }
    writeFileSync(join(root, 'catalog/icons.json'), JSON.stringify(minimalCatalog()));
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"/>';
    for (const icon of ['files/file', 'folders/folder', 'folders/folder-open']) {
        writeFileSync(join(root, `icons/${icon}.svg`), svg);
    }
    return root;
}

function run(root, args = []) {
    const url = pathToFileURL(resolve(projectRoot, 'scripts/generate-theme.mjs')).href;
    return spawnSync(process.execPath, ['--input-type=module', '-e',
        `import { main } from ${JSON.stringify(url)}; process.exitCode = main(${JSON.stringify(args)}, ${JSON.stringify(root)});`],
    { cwd: tmpdir(), encoding: 'utf8' });
}

test('committed theme is exactly generated from the catalog', () => {
    assert.equal(serializeTheme(buildTheme(sourceCatalog)), readFileSync(resolve(projectRoot, 'themes/icon-theme.json'), 'utf8'));
});

test('generation derives folder defaults and both alias states', () => {
    const theme = buildTheme(minimalCatalog());
    assert.equal(theme.folderExpanded, 'folder_open');
    assert.equal(theme.folderNames.src, 'folder');
    assert.equal(theme.folderNamesExpanded.src, 'folder_open');
    assert.equal(theme.folderNamesExpanded.source, 'folder_open');
    assert.equal(theme.fileNames['readme.md'], 'file');
});

test('historical nonstandard expanded IDs and asset names are preserved', () => {
    const catalog = minimalCatalog();
    catalog.folders[0] = { id: 'vscode_file', icon: 'vscode', expandedId: 'vscode_open', names: ['.vscode'] };
    catalog.defaults.folder = 'vscode_file';
    const theme = buildTheme(catalog);
    assert.equal(theme.folderNamesExpanded['.vscode'], 'vscode_open');
    assert.equal(theme.iconDefinitions.vscode_open.iconPath, '../icons/folders/vscode-open.svg');
});

test('output is deterministic regardless of catalog entry or alias order', () => {
    const shuffled = structuredClone(sourceCatalog);
    shuffled.files.reverse();
    shuffled.folders.reverse();
    for (const entry of [...shuffled.files, ...shuffled.folders]) {
        entry.names?.reverse();
        entry.extensions?.reverse();
    }
    assert.equal(serializeTheme(buildTheme(shuffled)), serializeTheme(buildTheme(sourceCatalog)));
});

for (const [name, modify, message] of [
    ['duplicate IDs', c => c.files.push({ id: 'file' }), /Duplicate icon id/],
    ['cross-group ID collisions', c => c.folders[0].id = 'file', /Duplicate icon id/],
    ['expanded ID collisions', c => c.folders[0].expandedId = 'file', /Duplicate icon id/],
    ['duplicate extension aliases', c => c.files[0].extensions.push('TS'), /duplicate association/],
    ['duplicate folder aliases', c => c.folders[0].names.push('SRC'), /duplicate association/],
    ['glob aliases', c => c.files[0].names.push('favicon.*'), /not glob patterns/],
    ['empty aliases', c => c.folders[0].names.push(''), /nonempty exact names/],
    ['invalid alias types', c => c.files[0].names = 'README.md', /must be an array/],
    ['asset traversal', c => c.files[0].icon = '../outside', /asset basename/],
    ['null asset names', c => c.files[0].icon = null, /asset basename/],
    ['null expanded IDs', c => c.folders[0].expandedId = null, /icon identifier/],
    ['invalid schema locations', c => c.$schema = {}, /schema must be a string/],
    ['unknown fields', c => c.files[0].extensons = ['py'], /unknown field/],
    ['unknown versions', c => c.version = 2, /version must be 1/],
    ['wrong file default', c => c.defaults.file = 'folder', /defaults.file/],
    ['wrong folder default', c => c.defaults.folder = 'file', /defaults.folder/],
    ['missing defaults', c => delete c.defaults, /defaults must be an object/],
    ['empty entry groups', c => c.files = [], /nonempty array/],
]) {
    test(`catalog rejects ${name}`, () => {
        const catalog = minimalCatalog();
        modify(catalog);
        assert.throws(() => buildTheme(catalog), message);
    });
}

test('literal bracket aliases are preserved', () => {
    const catalog = minimalCatalog();
    catalog.folders[0].names.push('[slug]');
    assert.equal(buildTheme(catalog).folderNamesExpanded['[slug]'], 'folder_open');
});

test('generate creates valid output and is idempotent', t => {
    const root = fixture(t);
    assert.equal(run(root).status, 0);
    const first = readFileSync(join(root, 'themes/icon-theme.json'), 'utf8');
    assert.equal(run(root).status, 0);
    assert.equal(readFileSync(join(root, 'themes/icon-theme.json'), 'utf8'), first);
    assert.equal(run(root, ['--check']).status, 0);
});

test('--check detects stale output without rewriting it', t => {
    const root = fixture(t);
    writeFileSync(join(root, 'themes/icon-theme.json'), '{}\n');
    const result = run(root, ['--check']);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /out of date/);
    assert.equal(readFileSync(join(root, 'themes/icon-theme.json'), 'utf8'), '{}\n');
});

test('--check detects a missing generated theme without creating it', t => {
    const root = fixture(t);
    assert.equal(run(root, ['--check']).status, 1);
    assert.throws(() => readFileSync(join(root, 'themes/icon-theme.json')), { code: 'ENOENT' });
});

test('missing expanded artwork fails generation before output is changed', t => {
    const root = fixture(t);
    writeFileSync(join(root, 'themes/icon-theme.json'), '{}\n');
    rmSync(join(root, 'icons/folders/folder-open.svg'));
    const result = run(root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Cannot generate an invalid theme/);
    assert.equal(readFileSync(join(root, 'themes/icon-theme.json'), 'utf8'), '{}\n');
});

test('malformed catalog JSON and unknown arguments fail clearly', t => {
    const root = fixture(t);
    assert.match(run(root, ['--write']).stderr, /Usage:/);
    writeFileSync(join(root, 'catalog/icons.json'), '{');
    assert.equal(run(root).status, 1);
});
