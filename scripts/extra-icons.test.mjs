import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { posix } from 'node:path';
import { test } from 'node:test';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { buildTheme } from './generate-theme.mjs';

const catalog = JSON.parse(readFileSync(new URL('../catalog/icons.json', import.meta.url), 'utf8'));
const theme = buildTheme(catalog);
const newIds = ['pdf', 'archive', 'font', 'jupyter', 'angular', 'nuxt', 'vitest', 'playwright', 'kubernetes', 'terraform'];

// Models documented filename > longest compound extension > fallback lookup.
// A key prefixed by a direct parent is supported by VS Code's file-icon theme format.
function fileIcon(path) {
    const normalized = path.replaceAll('\\', '/').toLowerCase();
    const name = posix.basename(normalized);
    const parent = posix.basename(posix.dirname(normalized));
    for (const key of [`${parent}/${name}`, name]) {
        if (Object.hasOwn(theme.fileNames, key)) {
            return theme.fileNames[key];
        }
    }
    const segments = name.split('.');
    for (let index = 1; index < segments.length; index++) {
        const extension = segments.slice(index).join('.');
        for (const key of [`${parent}/${extension}`, extension]) {
            if (Object.hasOwn(theme.fileExtensions, key)) {
                return theme.fileExtensions[key];
            }
        }
    }
    return theme.file;
}

for (const [path, id] of [
    ['document.pdf', 'pdf'], ['DOCUMENT.PDF', 'pdf'],
    ['backup.zip', 'archive'], ['backup.7z', 'archive'], ['backup.rar', 'archive'],
    ['backup.tar.gz', 'archive'], ['backup.tar.xz', 'archive'], ['backup.tar.zst', 'archive'],
    ['text.woff', 'font'], ['text.woff2', 'font'], ['text.ttf', 'font'], ['text.otf', 'font'],
    ['analysis.ipynb', 'jupyter'],
    ['angular.json', 'angular'], ['.angular-cli.json', 'angular'], ['ngsw-config.json', 'angular'],
    ['nuxt.config.ts', 'nuxt'], ['nuxt.config.js', 'nuxt'], ['nuxt.config.mjs', 'nuxt'], ['.nuxtignore', 'nuxt'],
    ['vitest.config.ts', 'vitest'], ['vitest.config.mts', 'vitest'], ['vitest.config.cjs', 'vitest'],
    ['playwright.config.ts', 'playwright'], ['playwright.config.mjs', 'playwright'], ['playwright.config.cts', 'playwright'],
    ['k8s.yaml', 'kubernetes'], ['kubernetes.yml', 'kubernetes'], ['kustomization.yaml', 'kubernetes'],
    ['kubeconfig', 'kubernetes'], ['/home/user/.kube/config', 'kubernetes'],
    ['main.tf', 'terraform'], ['prod.tfvars', 'terraform'], ['main.tf.json', 'terraform'],
    ['prod.tfvars.json', 'terraform'], ['.terraform.lock.hcl', 'terraform'],
]) {
    test(`${path} uses the new ${id} icon`, () => {
        assert.equal(fileIcon(path), id);
        assert.ok(Object.hasOwn(theme.iconDefinitions, id));
    });
}

for (const [path, id] of [
    ['ordinary.json', 'json'], ['ordinary.yaml', 'yaml'], ['ordinary.yml', 'yaml'],
    ['ordinary.ts', 'ts'], ['ordinary.js', 'js'], ['ordinary.html', 'html'],
    ['widget.spec.ts', 'ts'], ['widget.test.ts', 'ts'], ['deployment.yaml', 'yaml'],
    ['service.yml', 'yaml'], ['other.hcl', '_file'], ['/project/config', '_file'],
    ['package.json', 'node2'], ['app.module.ts', 'nest'], ['route.ts', 'router'],
]) {
    test(`${path} preserves the existing ${id} mapping`, () => {
        assert.equal(fileIcon(path), id);
    });
}

for (const id of newIds) {
    test(`${id} is native transparent pixel SVG with integer, axis-aligned geometry`, () => {
        const source = readFileSync(new URL(`../icons/files/${id}.svg`, import.meta.url), 'utf8');
        assert.equal(XMLValidator.validate(source), true);
        const svg = new XMLParser({ ignoreAttributes: false }).parse(source).svg;
        assert.equal(svg['@_viewBox'], '0 0 16 16');
        assert.equal(svg['@_shape-rendering'], 'crispEdges');
        assert.equal(svg['@_xmlns'], 'http://www.w3.org/2000/svg');
        assert.doesNotMatch(source, /<(?:image|script|text|foreignObject|filter)\b|(?:xlink:)?href=|data:image/i);
        for (const path of [svg.path].flat()) {
            assert.match(path['@_d'], /^[MmHhVvZz\d\s,.-]+$/);
            for (const number of path['@_d'].match(/-?\d+(?:\.\d+)?/g)) {
                assert.ok(Number.isInteger(Number(number)));
            }
        }
        assert.ok(catalog.files.some(entry => entry.id === id && entry.label));
    });
}

test('specific artwork notices ship with standalone SVG descriptions', () => {
    const notices = readFileSync(new URL('../ICON_NOTICES.txt', import.meta.url), 'utf8');
    for (const id of ['angular', 'kubernetes']) {
        const source = readFileSync(new URL(`../icons/files/${id}.svg`, import.meta.url), 'utf8');
        assert.match(source, /CC BY 4.0/);
        assert.match(notices, new RegExp(`icons/files/${id}\\.svg`));
    }
});
