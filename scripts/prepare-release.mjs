import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function nextVersion(version, bump) {
    if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) {
        throw new Error('Only stable X.Y.Z versions are supported.');
    }
    const parts = version.split('.').map(Number);
    const index = ['major', 'minor', 'patch'].indexOf(bump);
    if (index < 0) { throw new Error('Choose patch, minor or major.'); }
    parts[index]++;
    for (let i = index + 1; i < parts.length; i++) { parts[i] = 0; }
    if (!parts.every(Number.isSafeInteger)) { throw new Error('Version exceeds the safe integer range.'); }
    return parts.join('.');
}

export function prepareRelease(root, bump, date = new Date().toISOString().slice(0, 10)) {
    const manifestPath = resolve(root, 'package.json');
    const changelogPath = resolve(root, 'CHANGELOG.md');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    const changelog = readFileSync(changelogPath, 'utf8');
    const version = nextVersion(manifest.version, bump);
    const section = changelog.match(/^## \[Unreleased\]\s*\n([\s\S]*?)(?=^## \[|$(?![\s\S]))/m);
    if (!section || !/^\s*-\s+\S/m.test(section[1])) {
        throw new Error('Add release notes under ## [Unreleased] before preparing a release.');
    }
    if (changelog.includes(`## [${version}]`)) { throw new Error('Version already exists in CHANGELOG.'); }
    manifest.version = version;
    const updated = changelog.replace(section[0], `## [Unreleased]\n\n## [${version}] - ${date}\n\n${section[1].trim()}\n\n`);
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    writeFileSync(changelogPath, updated);
    return version;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    try {
        if (process.argv.length !== 3) { throw new Error('Usage: node scripts/prepare-release.mjs patch|minor|major'); }
        console.log(prepareRelease(process.cwd(), process.argv[2]));
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    }
}
