import { readFileSync } from 'node:fs';
import { posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import yauzl from 'yauzl';
import { projectRoot } from './validate-theme.mjs';

export function readArchive(path) {
    return new Promise((resolveArchive, reject) => {
        yauzl.open(path, { lazyEntries: true }, (error, zip) => {
            if (error) {
                reject(error);
                return;
            }
            const files = new Map();
            let totalSize = 0;
            function fail(error) {
                zip.close();
                reject(error);
            }
            zip.on('error', fail);
            zip.on('end', () => resolveArchive(files));
            zip.on('entry', entry => {
                if (entry.fileName.endsWith('/')) {
                    zip.readEntry();
                    return;
                }
                totalSize += entry.uncompressedSize;
                if (files.has(entry.fileName) || totalSize > 50 * 1024 * 1024) {
                    fail(new Error('VSIX has duplicate entries or exceeds the 50 MiB verification limit.'));
                    return;
                }
                zip.openReadStream(entry, (error, stream) => {
                    if (error) {
                        fail(error);
                        return;
                    }
                    const chunks = [];
                    stream.on('error', fail);
                    stream.on('data', chunk => chunks.push(chunk));
                    stream.on('end', () => {
                        files.set(entry.fileName, Buffer.concat(chunks));
                        zip.readEntry();
                    });
                });
            });
            zip.readEntry();
        });
    });
}

export function validatePackage(files, root = projectRoot) {
    const errors = [];
    const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
    for (const required of ['[Content_Types].xml', 'extension.vsixmanifest', 'extension/package.json']) {
        if (!files.has(required)) {
            errors.push(`Missing package file: ${required}`);
        }
    }
    if (!files.has('extension/package.json')) {
        return errors;
    }
    let packedManifest;
    try {
        packedManifest = JSON.parse(files.get('extension/package.json').toString('utf8'));
    } catch {
        return [...errors, 'Packaged manifest is not valid JSON.'];
    }
    for (const field of ['name', 'version', 'publisher']) {
        if (packedManifest[field] !== manifest[field]) {
            errors.push(`Packaged ${field} does not match package.json.`);
        }
    }
    if (JSON.stringify(packedManifest.contributes) !== JSON.stringify(manifest.contributes)) {
        errors.push('Packaged contributions do not match package.json.');
    }
    const checked = new Set();
    function checkFile(relativePath) {
        const normalized = posix.normalize(relativePath.replaceAll('\\', '/'));
        if (normalized.startsWith('../') || posix.isAbsolute(normalized)) {
            errors.push(`Unsafe package path: ${relativePath}`);
            return;
        }
        if (checked.has(normalized)) {
            return;
        }
        checked.add(normalized);
        const packed = files.get(`extension/${normalized}`);
        if (!packed) {
            errors.push(`Missing package asset: ${normalized}`);
        } else if (!packed.equals(readFileSync(resolve(root, normalized)))) {
            errors.push(`Packaged asset differs from source: ${normalized}`);
        }
    }
    checkFile(manifest.icon);
    checkFile('ICON_NOTICES.txt');
    for (const contribution of manifest.contributes.iconThemes) {
        checkFile(contribution.path);
        const theme = JSON.parse(readFileSync(resolve(root, contribution.path), 'utf8'));
        for (const definition of Object.values(theme.iconDefinitions)) {
            checkFile(posix.join(posix.dirname(contribution.path), definition.iconPath));
        }
    }
    for (const name of files.keys()) {
        if (/^extension\/(scripts|catalog|gallery|dist|node_modules|\.github|\.vscode)\//.test(name) ||
            /^extension\/(pnpm-lock\.yaml|\.npmrc|\.gitattributes|CONTRIBUTING\.md)$/.test(name)) {
            errors.push(`Development file leaked into package: ${name}`);
        }
    }
    return errors;
}

export async function main(args = process.argv.slice(2), root = projectRoot) {
    try {
        if (args.length > 1) {
            throw new Error('Usage: node scripts/check-package.mjs [path.vsix]');
        }
        const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
        const archivePath = resolve(root, args[0] ?? `${manifest.name}-${manifest.version}.vsix`);
        const errors = validatePackage(await readArchive(archivePath), root);
        if (errors.length) {
            throw new Error(errors.join('\n'));
        }
        console.log('VSIX verified: manifest, generated theme, referenced icons and development-file exclusions.');
        return 0;
    } catch (error) {
        console.error(error.message);
        return 1;
    }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    process.exitCode = await main();
}
