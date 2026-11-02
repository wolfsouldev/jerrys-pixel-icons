import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { projectRoot, validateTheme, validateThemeFile } from './validate-theme.mjs';

const themePath = resolve(projectRoot, 'themes/icon-theme.json');
const theme = JSON.parse(readFileSync(themePath, 'utf8'));

function fixture(t) {
    const directory = mkdtempSync(join(tmpdir(), 'jerry-icons-test-'));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    writeFileSync(join(directory, 'icon.svg'), '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>');
    return {
        directory,
        theme: {
            iconDefinitions: { file: { iconPath: 'icon.svg' }, folder: { iconPath: 'icon.svg' },
                folder_open: { iconPath: 'icon.svg' } },
            file: 'file', folder: 'folder', folderExpanded: 'folder_open',
            fileExtensions: { ts: 'file' }, fileNames: { 'README.md': 'file' },
            folderNames: { src: 'folder' }, folderNamesExpanded: { src: 'folder_open' },
        },
    };
}

// Model the documented exact-name > longest compound-extension > default
// precedence. This checks mappings, not the VS Code renderer.
function fileIcon(name) {
    const lower = name.toLowerCase();
    const exact = Object.entries(theme.fileNames).find(([key]) => key.toLowerCase() === lower);
    if (exact) {
        return exact[1];
    }
    const parts = lower.split('.');
    for (let index = 1; index < parts.length; index++) {
        const suffix = parts.slice(index).join('.');
        if (Object.hasOwn(theme.fileExtensions, suffix)) {
            return theme.fileExtensions[suffix];
        }
    }
    return theme.file;
}

test('the contributed theme passes all static checks', () => {
    assert.deepEqual(validateThemeFile(themePath).errors, []);
});

test('a minimal valid theme passes', t => {
    const f = fixture(t);
    assert.deepEqual(validateTheme(f.theme, f.directory), []);
});

for (const [name, expected] of [
    ['app.module.ts', 'nest'], ['app.module.js', 'nest'],
    ['route.ts', 'router'], ['route.js', 'router'],
    ['app.routes.ts', 'router'], ['app.router.js', 'router'],
    ['app.routing.ts', 'router'], ['project.urls.py', 'router'],
    ['navigation.ts', 'router'], ['navigation.js', 'router'],
    ['favicon.ico', 'favicon'], ['favicon.png', 'favicon'], ['FAVICON.SVG', 'favicon'],
    ['README.MD', 'readme'], ['dockerfile', 'docker'], ['license', 'license'],
    ['CHANGELOG.MD', 'changelog'], ['package.json', 'node2'],
    ['index.ts', 'ts'], ['index.js', 'js'], ['index.module.css', 'css'],
    ['appRouter.ts', 'ts'], ['myfavicon.png', 'img'], ['unknown.filetype', '_file'],
]) {
    test(`${name} maps to ${expected}`, () => {
        assert.equal(fileIcon(name), expected);
        assert.ok(Object.hasOwn(theme.iconDefinitions, expected));
    });
}

test('previously omitted folder aliases have their matching expanded icon', () => {
    for (const [name, closed, expanded] of [
        ['views', 'pages', 'pages_open'],
        ['contents', 'content', 'content_open'],
        ['example', 'examples', 'examples_open'],
    ]) {
        assert.equal(theme.folderNames[name], closed);
        assert.equal(theme.folderNamesExpanded[name], expanded);
    }
});

test('undefined icon references fail validation', t => {
    const f = fixture(t);
    f.theme.fileExtensions.ts = 'route';
    assert.match(validateTheme(f.theme, f.directory).join('\n'), /undefined icon "route"/);
});

for (const group of ['fileExtensions', 'fileNames', 'folderNames', 'folderNamesExpanded']) {
    test(`glob patterns in ${group} fail validation`, t => {
        const f = fixture(t);
        f.theme[group]['*.module.*'] = 'file';
        assert.match(validateTheme(f.theme, f.directory).join('\n'), /not glob patterns/);
    });
}

test('missing SVG files fail validation', t => {
    const f = fixture(t);
    f.theme.iconDefinitions.file.iconPath = 'missing.svg';
    assert.match(validateTheme(f.theme, f.directory).join('\n'), /cannot read or parse missing.svg/);
});

test('malformed SVG XML fails validation', t => {
    const f = fixture(t);
    writeFileSync(join(f.directory, 'icon.svg'), '<svg xmlns="http://www.w3.org/2000/svg"><path></svg>');
    assert.match(validateTheme(f.theme, f.directory).join('\n'), /invalid SVG XML/);
});

test('well-formed XML without an SVG root fails validation', t => {
    const f = fixture(t);
    writeFileSync(join(f.directory, 'icon.svg'), '<html/>');
    assert.match(validateTheme(f.theme, f.directory).join('\n'), /single <svg> root/);
});

test('SVG root must declare the SVG namespace', t => {
    const f = fixture(t);
    writeFileSync(join(f.directory, 'icon.svg'), '<svg/>');
    assert.match(validateTheme(f.theme, f.directory).join('\n'), /SVG namespace/);
});

test('multiple XML roots fail validation', t => {
    const f = fixture(t);
    writeFileSync(join(f.directory, 'icon.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/><other/>');
    assert.notDeepEqual(validateTheme(f.theme, f.directory), []);
});

test('a missing expanded folder association fails validation', t => {
    const f = fixture(t);
    delete f.theme.folderNamesExpanded.src;
    assert.match(validateTheme(f.theme, f.directory).join('\n'), /missing expanded association for "src"/);
});

test('an expanded folder without a collapsed counterpart fails validation', t => {
    const f = fixture(t);
    f.theme.folderNamesExpanded.views = 'folder_open';
    assert.match(validateTheme(f.theme, f.directory).join('\n'), /missing collapsed association for "views"/);
});

test('case-insensitive duplicate associations fail validation', t => {
    const f = fixture(t);
    f.theme.fileNames['readme.md'] = 'file';
    assert.match(validateTheme(f.theme, f.directory).join('\n'), /duplicate case-insensitive association/);
});

test('literal bracket filenames and dynamic folder names are allowed', t => {
    const f = fixture(t);
    f.theme.fileNames['[id].tsx'] = 'file';
    f.theme.folderNames['[slug]'] = 'folder';
    f.theme.folderNamesExpanded['[slug]'] = 'folder_open';
    assert.deepEqual(validateTheme(f.theme, f.directory), []);
});

test('language IDs keep their case-sensitive identity', t => {
    const f = fixture(t);
    f.theme.languageIds = { custom: 'file', Custom: 'file' };
    assert.deepEqual(validateTheme(f.theme, f.directory), []);
});

test('undefined defaults and variant references fail validation', t => {
    const f = fixture(t);
    f.theme.file = 'missing';
    f.theme.light = { fileNames: { 'test.ts': 'missing' } };
    assert.equal(validateTheme(f.theme, f.directory).filter(error => /undefined icon/.test(error)).length, 2);
});

test('missing default associations fail validation', t => {
    const f = fixture(t);
    delete f.theme.file;
    assert.match(validateTheme(f.theme, f.directory).join('\n'), /Missing default file association/);
});

test('malformed mapping structures produce clear errors', t => {
    const f = fixture(t);
    f.theme.fileExtensions = null;
    f.theme.folderNamesExpanded = [];
    f.theme.highContrast = 'invalid';
    const errors = validateTheme(f.theme, f.directory).join('\n');
    assert.match(errors, /fileExtensions must be an object/);
    assert.match(errors, /folderNamesExpanded must be an object/);
    assert.match(errors, /highContrast must be an object/);
});

test('malformed theme JSON fails validation', t => {
    const f = fixture(t);
    const path = join(f.directory, 'theme.json');
    writeFileSync(path, '{"iconDefinitions":');
    assert.match(validateThemeFile(path).errors.join('\n'), /Cannot load theme JSON/);
});

test('invalid top-level structures fail validation', () => {
    for (const invalid of [null, [], {}, { iconDefinitions: [] }]) {
        assert.match(validateTheme(invalid, projectRoot).join('\n'), /iconDefinitions must be an object/);
    }
});

test('CLI succeeds when invoked from a different working directory', () => {
    const result = spawnSync(process.execPath, [resolve(projectRoot, 'scripts/validate-theme.mjs')],
        { cwd: tmpdir(), encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /jerrys-pixel: valid/);
});

test('CLI exits nonzero when a contributed theme has an error', t => {
    const f = fixture(t);
    f.theme.fileExtensions.ts = 'missing';
    writeFileSync(join(f.directory, 'theme.json'), JSON.stringify(f.theme));
    writeFileSync(join(f.directory, 'package.json'), JSON.stringify({
        contributes: { iconThemes: [{ id: 'fixture', path: './theme.json' }] },
    }));
    const moduleUrl = pathToFileURL(resolve(projectRoot, 'scripts/validate-theme.mjs')).href;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e',
        `import { main } from ${JSON.stringify(moduleUrl)}; process.exitCode = main(${JSON.stringify(f.directory)});`],
    { encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /undefined icon "missing"/);
});
