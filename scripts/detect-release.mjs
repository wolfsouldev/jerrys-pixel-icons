import { appendFileSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

function versionParts(version) {
    if (typeof version !== 'string' || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) {
        throw new Error(`Invalid stable X.Y.Z version: ${version}`);
    }
    return version.split('.').map(Number);
}

function compareVersions(left, right) {
    const a = versionParts(left);
    const b = versionParts(right);
    for (let index = 0; index < a.length; index++) {
        if (a[index] !== b[index]) { return a[index] < b[index] ? -1 : 1; }
    }
    return 0;
}

function requireReleaseNotes(version, changelog) {
    const escaped = version.replaceAll('.', '\\.');
    if (!new RegExp(`^## \\[${escaped}\\] - \\d{4}-\\d{2}-\\d{2}$`, 'm').test(changelog)) {
        throw new Error(`CHANGELOG.md must contain dated release notes for ${version}.`);
    }
}

export function detectReleaseVersion({ eventName, beforeVersion, currentVersion, requestedVersion, changelog }) {
    versionParts(currentVersion);
    if (eventName === 'workflow_dispatch') {
        if (requestedVersion !== currentVersion) {
            throw new Error(`Requested version ${requestedVersion} does not match package.json ${currentVersion}.`);
        }
        requireReleaseNotes(currentVersion, changelog);
        return currentVersion;
    }
    if (eventName !== 'push') { throw new Error(`Unsupported release event: ${eventName}`); }
    versionParts(beforeVersion);
    if (beforeVersion === currentVersion) { return ''; }
    if (compareVersions(currentVersion, beforeVersion) <= 0) {
        throw new Error(`The new version ${currentVersion} must be greater than ${beforeVersion}.`);
    }
    requireReleaseNotes(currentVersion, changelog);
    return currentVersion;
}

function readPreviousVersion(sha) {
    if (!sha || /^0+$/.test(sha)) { throw new Error('Cannot determine the previous master commit safely.'); }
    try {
        const source = execFileSync('git', ['show', `${sha}:package.json`], { encoding: 'utf8' });
        return JSON.parse(source).version;
    } catch (error) {
        throw new Error(`Could not read package.json from the previous master commit: ${error.message}`);
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    try {
        const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
        const eventName = process.env.RELEASE_EVENT_NAME;
        const version = detectReleaseVersion({
            eventName,
            beforeVersion: eventName === 'push' ? readPreviousVersion(process.env.RELEASE_BEFORE_SHA) : undefined,
            currentVersion: manifest.version,
            requestedVersion: process.env.REQUESTED_VERSION,
            changelog: readFileSync('CHANGELOG.md', 'utf8'),
        });
        if (process.env.GITHUB_OUTPUT) { appendFileSync(process.env.GITHUB_OUTPUT, `version=${version}\n`); }
        console.log(version ? `Release ${version} detected; Marketplace publish will run after checks.` : 'No package version change; Marketplace publish is skipped.');
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    }
}
