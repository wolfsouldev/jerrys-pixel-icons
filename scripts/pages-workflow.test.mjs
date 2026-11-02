import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseDocument } from 'yaml';

const document = parseDocument(readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8'));
assert.deepEqual(document.errors, []);
const workflow = document.toJS();
const { jobs } = workflow;
const guard = "github.ref == 'refs/heads/master' && (github.event_name == 'push' || github.event_name == 'workflow_dispatch')";

test('CI still validates pushes and PRs, with manual runs but no privileged PR trigger', () => {
    assert.deepEqual(Object.keys(workflow.on).sort(), ['pull_request', 'push', 'workflow_dispatch']);
    assert.deepEqual(jobs['validate-and-package'].strategy.matrix.node, [22, 24]);
    assert.deepEqual(workflow.permissions, { contents: 'read' });
});

test('Pages preparation waits for the complete test matrix and browser checks', () => {
    assert.deepEqual(jobs['pages-artifact'].needs, ['validate-and-package', 'gallery-browser']);
    assert.equal(jobs['gallery-browser'].needs, 'validate-and-package');
    assert.equal(jobs['pages-artifact'].if, guard);
    assert.equal(jobs['deploy-pages'].if, guard);
    assert.equal(jobs['deploy-pages'].needs, 'pages-artifact');
});

test('only the deployment job can write Pages or request an OIDC token', () => {
    assert.deepEqual(jobs['deploy-pages'].permissions, { pages: 'write', 'id-token': 'write' });
    for (const [name, job] of Object.entries(jobs)) {
        if (name !== 'deploy-pages') {
            assert.notEqual(job.permissions?.pages, 'write');
            assert.notEqual(job.permissions?.['id-token'], 'write');
        }
    }
    assert.equal(jobs['pages-artifact'].permissions.pages, 'read');
    assert.equal(jobs['deploy-pages'].environment.name, 'github-pages');
});

test('Pages uses its dedicated artifact action and only the generated gallery directory', () => {
    const steps = jobs['pages-artifact'].steps;
    const build = steps.findIndex(step => step.run === 'pnpm run gallery:build');
    const upload = steps.findIndex(step => step.uses?.startsWith('actions/upload-pages-artifact@'));
    assert.ok(build >= 0 && upload > build);
    assert.equal(steps[upload].with.path, 'dist/gallery');
    assert.ok(steps.some(step => step.uses?.startsWith('actions/configure-pages@')));
    assert.equal(jobs['deploy-pages'].steps.length, 1);
    assert.ok(jobs['deploy-pages'].steps[0].uses.startsWith('actions/deploy-pages@'));
});

test('all actions are pinned, checkouts use the tested commit and no PAT is embedded', () => {
    for (const job of Object.values(jobs)) {
        for (const step of job.steps) {
            if (step.uses) {
                assert.match(step.uses, /^[\w-]+\/[\w-]+@[a-f0-9]{40}$/);
            }
            if (step.uses?.startsWith('actions/checkout@')) {
                assert.equal(step.with['persist-credentials'], false);
                assert.equal(step.with.ref, undefined);
            }
        }
    }
    assert.doesNotMatch(JSON.stringify(workflow), /secrets\./);
});

test('the active master workflow and deployment are not cancelled by newer pushes', () => {
    assert.equal(workflow.concurrency['cancel-in-progress'], "${{ github.ref != 'refs/heads/master' }}");
    assert.equal(jobs['deploy-pages'].concurrency.group, 'github-pages');
    assert.equal(jobs['deploy-pages'].concurrency['cancel-in-progress'], false);
});

test('deployment success is followed by source-matching public HTTP verification', () => {
    assert.equal(jobs['verify-pages'].needs, 'deploy-pages');
    const check = jobs['verify-pages'].steps.find(step => step.run?.includes('pnpm run gallery:verify'));
    assert.ok(check);
    assert.equal(check.env.GALLERY_URL, '${{ needs.deploy-pages.outputs.page_url }}');
    assert.equal(check.run, 'pnpm run gallery:verify --url "$GALLERY_URL"');
    assert.equal(jobs['deploy-pages'].outputs.page_url, '${{ steps.deployment.outputs.page_url }}');
});
