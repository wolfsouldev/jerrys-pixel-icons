import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { parseDocument } from 'yaml';
import { detectReleaseVersion } from './detect-release.mjs';
import { nextVersion, prepareRelease } from './prepare-release.mjs';
import { validateCiArtifact } from './verify-ci-artifact.mjs';

test('stable versions increment explicitly without prerelease ambiguity', () => {
    assert.equal(nextVersion('0.3.0', 'patch'), '0.3.1');
    assert.equal(nextVersion('0.3.5', 'minor'), '0.4.0');
    assert.equal(nextVersion('0.3.5', 'major'), '1.0.0');
    for (const version of ['01.3.0', '0.3.0-beta', 'v0.3.0', 'junk']) {
        assert.throws(() => nextVersion(version, 'patch'));
    }
    assert.throws(() => nextVersion('0.3.0', 'invalid'));
});

test('release preparation updates manifest and moves only unreleased notes', t => {
    const root = mkdtempSync(join(tmpdir(), 'jerry-release-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'example', version: '0.3.0' }));
    writeFileSync(join(root, 'CHANGELOG.md'), '# Changes\n\n## [Unreleased]\n\n### Added\n\n- New art.\n\n## [0.3.0]\n\n- Old art.\n');
    assert.equal(prepareRelease(root, 'minor', '2026-11-03'), '0.4.0');
    assert.equal(JSON.parse(readFileSync(join(root, 'package.json'))).version, '0.4.0');
    const notes = readFileSync(join(root, 'CHANGELOG.md'), 'utf8');
    assert.match(notes, /## \[Unreleased\]\n\n## \[0.4.0\] - 2026-11-03\n\n### Added\n\n- New art./);
    assert.ok(notes.endsWith('## [0.3.0]\n\n- Old art.\n'));
    const before = readFileSync(join(root, 'package.json'), 'utf8');
    assert.throws(() => prepareRelease(root, 'patch'), /release notes/);
    assert.equal(readFileSync(join(root, 'package.json'), 'utf8'), before);
});

function workflow(name) {
    const doc = parseDocument(readFileSync(new URL(`../.github/workflows/${name}.yml`, import.meta.url), 'utf8'));
    assert.deepEqual(doc.errors, []);
    return doc.toJS();
}

test('release preparation is manual; publishing detects version changes on master', () => {
    const prepare = workflow('prepare-release');
    const publish = workflow('publish');
    assert.deepEqual(Object.keys(prepare.on), ['workflow_dispatch']);
    assert.deepEqual(Object.keys(publish.on), ['workflow_run', 'workflow_dispatch']);
    assert.deepEqual(publish.on.workflow_run.workflows, ['Validate and package']);
    assert.deepEqual(publish.on.workflow_run.branches, ['master']);
    assert.deepEqual(prepare.permissions, { contents: 'read' });
    assert.deepEqual(publish.permissions, { contents: 'read' });
    assert.equal(prepare.concurrency['cancel-in-progress'], false);
    assert.equal(publish.concurrency['cancel-in-progress'], false);
    assert.equal(prepare.jobs.prepare.if, "github.ref == 'refs/heads/master'");
    assert.match(publish.jobs['detect-release'].if, /workflow_run\.conclusion == 'success'/);
    assert.match(publish.jobs['detect-release'].if, /workflow_dispatch.*refs\/heads\/master/s);
    assert.equal(publish.jobs.publish.if, "needs.detect-release.outputs.version != ''");
    for (const config of [prepare, publish]) {
        for (const job of Object.values(config.jobs)) {
            for (const step of job.steps) {
                if (step.uses) { assert.match(step.uses, /^[\w-]+\/[\w-]+@[a-f0-9]{40}$/); }
                if (step.uses?.startsWith('actions/checkout@')) { assert.equal(step.with['persist-credentials'], false); }
                if (step.uses?.startsWith('actions/checkout@') && step.with['fetch-depth'] !== undefined) {
                    assert.equal(step.with['fetch-depth'], 0);
                }
            }
        }
    }
});

test('publishing uses an approved, verified artifact and no long-lived secret', () => {
    const { jobs } = workflow('publish');
    assert.deepEqual(jobs['verify-artifact'].needs, 'detect-release');
    assert.deepEqual(jobs.publish.needs, ['detect-release', 'verify-artifact']);
    assert.equal(jobs.publish.environment.name, 'marketplace');
    assert.equal(jobs['verify-artifact'].environment, undefined);
    assert.deepEqual(jobs['verify-artifact'].permissions, { actions: 'read', contents: 'read' });
    assert.deepEqual(jobs.publish.permissions, { contents: 'read', 'id-token': 'write' });
    const commands = jobs.publish.steps.map(step => step.run).filter(Boolean);
    assert.ok(commands.some(cmd => cmd.includes('--oidc --skip-duplicate --packagePath')));
    assert.equal(commands.at(-1), 'pnpm run release:verify');
    const verifyCommands = jobs['verify-artifact'].steps.map(step => step.run).filter(Boolean);
    assert.ok(verifyCommands.indexOf('pnpm run package:check') >= 0);
    assert.ok(verifyCommands.indexOf('pnpm run package:check') < verifyCommands.findIndex(cmd => cmd.includes('sha256sum')));
    assert.doesNotMatch(JSON.stringify(jobs), /secrets\.|vsce publish (minor|patch|major)/);
    assert.equal([...commands, ...verifyCommands].some(cmd => cmd.includes('playwright install')), false);
    assert.ok(verifyCommands.some(cmd => cmd.includes('scripts/verify-ci-artifact.mjs')));
    const download = jobs['verify-artifact'].steps.find(step => step.uses?.startsWith('actions/download-artifact@'));
    assert.equal(download.with.name, 'jerrys-pixel-icons-node-24');
    assert.equal(download.with['run-id'], '${{ needs.detect-release.outputs.source_ci_run_id }}');
    assert.equal(download.with['github-token'], '${{ github.token }}');
    const publishDownload = jobs.publish.steps.find(step => step.uses?.startsWith('actions/download-artifact@'));
    assert.equal(publishDownload.with.name, 'verified-marketplace-vsix');
    assert.ok(workflow('ci').jobs['gallery-browser'].steps.some(step => step.run === 'pnpm run test:gallery'));
});

test('only a strictly higher manifest version with dated notes triggers automatic publish', () => {
    const changelog = '# Changes\n\n## [Unreleased]\n\n## [0.4.0] - 2026-11-05\n\n- New icons.\n';
    const release = { eventName: 'push', beforeVersion: '0.3.0', currentVersion: '0.4.0', changelog };
    assert.equal(detectReleaseVersion(release), '0.4.0');
    assert.equal(detectReleaseVersion({ ...release, eventName: 'workflow_run' }), '0.4.0');
    assert.equal(detectReleaseVersion({ ...release, currentVersion: '0.3.0', beforeVersion: '0.3.0' }), '');
    assert.throws(() => detectReleaseVersion({ ...release, currentVersion: '0.2.9' }), /must be greater/);
    assert.throws(() => detectReleaseVersion({ ...release, changelog: '# Changes' }), /dated release notes/);
    assert.equal(detectReleaseVersion({ ...release, eventName: 'workflow_dispatch', requestedVersion: '0.4.0' }), '0.4.0');
    assert.throws(() => detectReleaseVersion({ ...release, eventName: 'workflow_dispatch', requestedVersion: '0.5.0' }), /does not match/);
});

test('only a successful master CI run with the exact version and artifact can be published', () => {
    const sha = 'a'.repeat(40);
    const run = {
        id: 123,
        name: 'Validate and package',
        head_branch: 'master',
        head_sha: sha,
        status: 'completed',
        conclusion: 'success',
    };
    const artifacts = [{ name: 'jerrys-pixel-icons-node-24', expired: false, size_in_bytes: 1024 }];
    const input = {
        run,
        artifacts,
        currentSha: sha,
        expectedVersion: '0.4.0',
        expectedRunId: 123,
        isAncestor: () => true,
        readManifestAt: () => ({ name: 'jerrys-pixel-icons', publisher: 'MelissaGutierrez', version: '0.4.0' }),
    };
    assert.equal(validateCiArtifact(input), artifacts[0]);
    assert.throws(() => validateCiArtifact({ ...input, isAncestor: () => false }), /not an ancestor/);
    assert.throws(() => validateCiArtifact({ ...input, readManifestAt: () => ({ name: 'jerrys-pixel-icons', publisher: 'MelissaGutierrez', version: '0.3.0' }) }), /does not match requested/);
    assert.throws(() => validateCiArtifact({ ...input, readManifestAt: () => ({ name: 'other-extension', publisher: 'MelissaGutierrez', version: '0.4.0' }) }), /expected Jerry/);
    assert.throws(() => validateCiArtifact({ ...input, expectedRunId: 456 }), /different CI run/);
    assert.throws(() => validateCiArtifact({ ...input, run: { ...run, conclusion: 'failure' } }), /successful Validate and package/);
    assert.throws(() => validateCiArtifact({ ...input, artifacts: [{ ...artifacts[0], expired: true }] }), /no unexpired Node 24/);
});

test('public verification retries processing delays but rejects different package bytes', async () => {
    const { verifyMarketplace } = await import('./verify-marketplace.mjs');
    const manifest = { publisher: 'MelissaGutierrez', name: 'jerrys-pixel-icons', version: '0.4.0' };
    const bytes = Buffer.from('tested artifact');
    let requests = 0;
    let waits = 0;
    await verifyMarketplace(manifest, bytes, {
        attempts: 2, log: () => {}, wait: async () => { waits++; },
        request: async url => {
            assert.ok(url.includes('/0.4.0/vspackage'));
            requests++;
            return requests === 1 ? { ok: false, status: 404 } : { ok: true, arrayBuffer: async () => bytes };
        },
    });
    assert.equal(requests, 2);
    assert.equal(waits, 1);
    await assert.rejects(verifyMarketplace(manifest, bytes, {
        attempts: 1, log: () => {}, request: async () => ({ ok: true, arrayBuffer: async () => Buffer.from('wrong artifact') }),
    }), /Public package not verified/);
    await assert.rejects(verifyMarketplace(manifest, bytes, {
        attempts: 1, log: () => {}, request: async () => { throw Error('timeout'); },
    }), /Public package not verified/);
});
