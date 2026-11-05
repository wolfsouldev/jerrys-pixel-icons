import { appendFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const SHA_PATTERN = /^[a-f0-9]{40}$/i;
const VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export function validateCiArtifact({
    run,
    artifacts,
    currentSha,
    expectedVersion,
    expectedRunId,
    isAncestor,
    readManifestAt = sha => JSON.parse(execFileSync('git', ['show', `${sha}:package.json`], { encoding: 'utf8' })),
}) {
    if (expectedRunId !== undefined && String(run.id) !== String(expectedRunId)) {
        throw new Error('GitHub returned a different CI run than the requested run ID.');
    }
    if (run.name !== 'Validate and package' || run.head_branch !== 'master' ||
        run.status !== 'completed' || run.conclusion !== 'success') {
        throw new Error('The VSIX must come from a successful Validate and package run on master.');
    }
    if (!SHA_PATTERN.test(run.head_sha) || !SHA_PATTERN.test(currentSha) || !isAncestor(run.head_sha, currentSha)) {
        throw new Error('The tested CI commit is not an ancestor of the current master commit.');
    }
    if (!VERSION_PATTERN.test(expectedVersion)) {
        throw new Error(`Invalid requested release version: ${expectedVersion}`);
    }
    const sourceManifest = readManifestAt(run.head_sha);
    if (sourceManifest.name !== 'jerrys-pixel-icons' || sourceManifest.publisher !== 'MelissaGutierrez') {
        throw new Error('The CI commit does not contain the expected Jerry’s Pixel Icons extension identity.');
    }
    if (sourceManifest.version !== expectedVersion) {
        throw new Error(`CI artifact version ${sourceManifest.version} does not match requested version ${expectedVersion}.`);
    }
    if (!Array.isArray(artifacts)) {
        throw new Error('GitHub did not return a valid CI artifact list.');
    }
    const artifact = artifacts.find(entry => entry.name === 'jerrys-pixel-icons-node-24');
    if (!artifact || artifact.expired || !(artifact.size_in_bytes > 0)) {
        throw new Error('The successful CI run has no unexpired Node 24 VSIX artifact.');
    }
    return artifact;
}

async function requestJson(url, token) {
    const response = await fetch(url, {
        headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${token}`,
            'X-GitHub-Api-Version': '2022-11-28',
        },
        signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) { throw new Error(`GitHub API returned HTTP ${response.status}.`); }
    return response.json();
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    try {
        const { GITHUB_API_URL = 'https://api.github.com', GITHUB_REPOSITORY, GITHUB_TOKEN,
            GITHUB_SHA, SOURCE_CI_RUN_ID, RELEASE_VERSION, GITHUB_OUTPUT } = process.env;
        if (!GITHUB_REPOSITORY || !GITHUB_TOKEN || !GITHUB_SHA || !SOURCE_CI_RUN_ID || !RELEASE_VERSION) {
            throw new Error('Missing source CI verification inputs.');
        }
        if (!/^\d+$/.test(SOURCE_CI_RUN_ID)) { throw new Error('CI run ID must be numeric.'); }
        const base = `${GITHUB_API_URL.replace(/\/$/, '')}/repos/${GITHUB_REPOSITORY}/actions/runs/${SOURCE_CI_RUN_ID}`;
        const [run, artifactPage] = await Promise.all([
            requestJson(base, GITHUB_TOKEN),
            requestJson(`${base}/artifacts?per_page=100`, GITHUB_TOKEN),
        ]);
        const artifact = validateCiArtifact({
            run,
            artifacts: artifactPage.artifacts,
            currentSha: GITHUB_SHA,
            expectedVersion: RELEASE_VERSION,
            expectedRunId: SOURCE_CI_RUN_ID,
            isAncestor: (source, target) => {
                try {
                    execFileSync('git', ['merge-base', '--is-ancestor', source, target], { stdio: 'ignore' });
                    return true;
                } catch { return false; }
            },
        });
        if (GITHUB_OUTPUT) {
            appendFileSync(GITHUB_OUTPUT, `head_sha=${run.head_sha}\nartifact_id=${artifact.id}\n`);
        }
        console.log(`Verified successful CI run ${run.id} (${run.head_sha}) and artifact ${artifact.name}.`);
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    }
}
