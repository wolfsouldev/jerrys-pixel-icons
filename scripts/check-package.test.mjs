import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { posix, resolve } from 'node:path';
import { test } from 'node:test';
import { readArchive, validatePackage } from './check-package.mjs';
import { projectRoot } from './validate-theme.mjs';

function fixture() {
    const manifest = JSON.parse(readFileSync(resolve(projectRoot, 'package.json'), 'utf8'));
    const files = new Map([
        ['[Content_Types].xml', Buffer.from('<Types/>')],
        ['extension.vsixmanifest', Buffer.from('<PackageManifest/>')],
        ['extension/package.json', Buffer.from(JSON.stringify(manifest))],
    ]);
    function add(path) {
        const normalized = posix.normalize(path);
        files.set(`extension/${normalized}`, readFileSync(resolve(projectRoot, path)));
    }
    add(manifest.icon);
    add('ICON_NOTICES.txt');
    for (const contribution of manifest.contributes.iconThemes) {
        add(contribution.path);
        const theme = JSON.parse(readFileSync(resolve(projectRoot, contribution.path), 'utf8'));
        for (const icon of Object.values(theme.iconDefinitions)) {
            add(posix.join(posix.dirname(contribution.path), icon.iconPath));
        }
    }
    return files;
}

test('package verifier accepts source-matching manifest, theme and all icons', () => {
    assert.deepEqual(validatePackage(fixture()), []);
});

test('package verifier rejects a missing icon', () => {
    const files = fixture();
    files.delete('extension/icons/files/js.svg');
    assert.match(validatePackage(files).join('\n'), /Missing package asset: icons\/files\/js.svg/);
});

test('package verifier rejects stale generated output', () => {
    const files = fixture();
    files.set('extension/themes/icon-theme.json', Buffer.from('{}'));
    assert.match(validatePackage(files).join('\n'), /Packaged asset differs from source/);
});

test('package verifier rejects changed icon bytes', () => {
    const files = fixture();
    files.set('extension/icons/files/js.svg', Buffer.from('<svg/>'));
    assert.match(validatePackage(files).join('\n'), /Packaged asset differs from source: icons\/files\/js.svg/);
});

for (const path of ['catalog/icons.json', 'scripts/generate-theme.mjs', '.github/workflows/ci.yml',
    'gallery/index.html', 'dist/gallery/data.json',
    '.vscode/tasks.json', 'node_modules/example/index.js', 'pnpm-lock.yaml', '.npmrc', 'CONTRIBUTING.md']) {
    test(`package verifier rejects leaked ${path}`, () => {
        const files = fixture();
        files.set(`extension/${path}`, Buffer.from('development only'));
        assert.match(validatePackage(files).join('\n'), /Development file leaked/);
    });
}

test('package verifier rejects mismatched version and theme contribution', () => {
    const files = fixture();
    const manifest = JSON.parse(files.get('extension/package.json'));
    manifest.version = '0.0.0';
    manifest.contributes.iconThemes = [];
    files.set('extension/package.json', Buffer.from(JSON.stringify(manifest)));
    const errors = validatePackage(files).join('\n');
    assert.match(errors, /Packaged version/);
    assert.match(errors, /Packaged contributions/);
});

test('package verifier rejects missing manifest and container metadata', () => {
    const files = fixture();
    files.delete('extension/package.json');
    files.delete('extension.vsixmanifest');
    assert.equal(validatePackage(files).length, 2);
});

test('archive reader rejects a nonexistent file', async () => {
    await assert.rejects(readArchive(resolve(projectRoot, 'does-not-exist.vsix')), /ENOENT/);
});

test('archive reader rejects a non-ZIP file', async () => {
    await assert.rejects(readArchive(resolve(projectRoot, 'package.json')));
});
