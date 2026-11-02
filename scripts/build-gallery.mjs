import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildTheme } from './generate-theme.mjs';
import { projectRoot, validateTheme } from './validate-theme.mjs';

export function buildGalleryData(catalog, manifest) {
    const theme = buildTheme(catalog);
    const entries = [];
    for (const [group, type] of [['files', 'file'], ['folders', 'folder']]) {
        for (const entry of catalog[group]) {
            const iconPath = id => posix.normalize(posix.join('themes', theme.iconDefinitions[id].iconPath));
            entries.push({
                key: `${type}/${entry.id}`,
                id: entry.id,
                label: entry.label ?? entry.id,
                type,
                icon: iconPath(entry.id),
                ...(type === 'folder' ? { openIcon: iconPath(entry.expandedId ?? `${entry.id}_open`),
                    openId: entry.expandedId ?? `${entry.id}_open` } : {}),
                names: [...(entry.names ?? [])],
                extensions: [...(entry.extensions ?? [])],
                tags: [...(entry.tags ?? [])],
                isDefault: catalog.defaults[type] === entry.id,
            });
        }
    }
    const assets = new Set(Object.values(theme.iconDefinitions).map(item => item.iconPath));
    return {
        version: manifest.version,
        assetCount: assets.size,
        fileCount: catalog.files.length,
        folderCount: catalog.folders.length,
        entries,
    };
}

export function buildGallery(root = projectRoot) {
    const catalog = JSON.parse(readFileSync(resolve(root, 'catalog/icons.json'), 'utf8'));
    const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
    const theme = buildTheme(catalog);
    const errors = validateTheme(theme, resolve(root, 'themes'));
    if (errors.length) {
        throw new Error(`Cannot build gallery:\n${errors.join('\n')}`);
    }
    const data = buildGalleryData(catalog, manifest);
    const output = resolve(root, 'dist/gallery');
    // This directory is generated, gitignored and never used as a source.
    rmSync(output, { recursive: true, force: true });
    mkdirSync(output, { recursive: true });
    function copy(source, destination = source) {
        const target = resolve(output, destination);
        mkdirSync(dirname(target), { recursive: true });
        copyFileSync(resolve(root, source), target);
    }
    for (const filename of ['index.html', 'styles.css', 'app.mjs', 'model.mjs']) {
        copy(`gallery/${filename}`, filename);
    }
    copy('assets/logo.png', 'assets/logo.png');
    copy('LICENSE', 'LICENSE.txt');
    for (const path of new Set(data.entries.flatMap(entry => [entry.icon, entry.openIcon].filter(Boolean)))) {
        copy(path);
    }
    writeFileSync(resolve(output, 'data.json'), `${JSON.stringify(data, null, 2)}\n`);
    return { output, data };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try {
        const { output, data } = buildGallery();
        console.log(`Gallery built: ${output} (${data.entries.length} entries, ${data.assetCount} SVG assets).`);
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    }
}
