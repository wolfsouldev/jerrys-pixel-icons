import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';

const digest = buffer => createHash('sha256').update(buffer).digest('hex');

export async function verifyMarketplace(manifest, bytes, { request = fetch, wait = setTimeout, attempts = 20, log = console.log } = {}) {
    const expected = digest(bytes);
    const url = `https://marketplace.visualstudio.com/_apis/public/gallery/publishers/${encodeURIComponent(manifest.publisher)}/vsextensions/${encodeURIComponent(manifest.name)}/${encodeURIComponent(manifest.version)}/vspackage`;
    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            const response = await request(url, { signal: AbortSignal.timeout(20000) });
            if (!response.ok) { throw new Error(`HTTP ${response.status}`); }
            const published = Buffer.from(await response.arrayBuffer());
            if (digest(published) !== expected) { throw new Error('Published VSIX differs from the tested artifact.'); }
            log(`Marketplace verified: ${manifest.publisher}.${manifest.name} ${manifest.version}; SHA-256 ${expected}`);
            return;
        } catch (error) {
            log(`Marketplace verification ${attempt}/${attempts}: ${error.message}`);
            if (attempt < attempts) { await wait(15000); }
        }
    }
    throw new Error('Public package not verified. Check Marketplace processing status; do not bump or republish blindly.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    try {
        const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
        await verifyMarketplace(manifest, readFileSync(`${manifest.name}-${manifest.version}.vsix`));
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    }
}
