import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { parseDocument } from 'yaml';
import { nextVersion, prepareRelease } from './prepare-release.mjs';

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

test('release workflows are manual and master-only with pinned actions', () => {
    for (const name of ['prepare-release', 'publish']) {
        const config = workflow(name);
        assert.deepEqual(Object.keys(config.on), ['workflow_dispatch']);
        assert.deepEqual(config.permissions, { contents: 'read' });
        assert.equal(config.concurrency['cancel-in-progress'], false);
        for (const [id, job] of Object.entries(config.jobs)) {
            assert.equal(job.if, "github.ref == 'refs/heads/master'");
            for (const step of job.steps) {
                if (step.uses) { assert.match(step.uses, /^[\w-]+\/[\w-]+@[a-f0-9]{40}$/); }
                if (step.uses?.startsWith('actions/checkout@')) { assert.equal(step.with['persist-credentials'], false); }
            }
            if (name === 'publish' && id !== 'publish') { assert.notEqual(job.permissions?.['id-token'], 'write'); }
        }
    }
});

test('publishing uses an approved, verified artifact and no long-lived secret', () => {
    const { jobs } = workflow('publish');
    assert.equal(jobs.publish.needs, 'validate');
    assert.equal(jobs.publish.environment.name, 'marketplace');
    assert.deepEqual(jobs.publish.permissions, { contents: 'read', 'id-token': 'write' });
    const commands = jobs.publish.steps.map(step => step.run).filter(Boolean);
    assert.ok(commands.indexOf('pnpm run package:check') < commands.findIndex(cmd => cmd.includes('vsce publish')));
    assert.ok(commands.some(cmd => cmd.includes('--oidc --packagePath')));
    assert.equal(commands.at(-1), 'pnpm run release:verify');
    assert.doesNotMatch(JSON.stringify(jobs.publish), /secrets\.|--skip-duplicate|vsce publish (minor|patch|major)/);
    assert.ok(jobs.validate.steps.some(step => step.run === 'pnpm run test:gallery'));
    assert.ok(jobs.publish.steps.some(step => step.uses?.startsWith('actions/download-artifact@')));
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
