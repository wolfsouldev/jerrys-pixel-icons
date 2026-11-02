import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { projectRoot, validateTheme } from './validate-theme.mjs';

const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const sorted = mapping => Object.fromEntries(Object.entries(mapping).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));

function requireObject(value, allowed, location) {
    if (!isObject(value)) {
        throw new Error(`${location} must be an object.`);
    }
    for (const key of Object.keys(value)) {
        if (!allowed.includes(key)) {
            throw new Error(`${location}: unknown field "${key}".`);
        }
    }
}

function requireId(value, location) {
    if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(value)) {
        throw new Error(`${location} must be a nonempty icon identifier.`);
    }
}

export function buildTheme(catalog) {
    requireObject(catalog, ['$schema', 'version', 'defaults', 'files', 'folders'], 'catalog');
    if (catalog.version !== 1) {
        throw new Error('catalog.version must be 1.');
    }
    if (Object.hasOwn(catalog, '$schema') && typeof catalog.$schema !== 'string') {
        throw new Error('catalog.$schema must be a string.');
    }
    requireObject(catalog.defaults, ['file', 'folder'], 'defaults');
    for (const group of ['files', 'folders']) {
        if (!Array.isArray(catalog[group]) || catalog[group].length === 0) {
            throw new Error(`catalog.${group} must be a nonempty array.`);
        }
    }
    const definitions = Object.create(null);
    const fileExtensions = Object.create(null);
    const fileNames = Object.create(null);
    const folderNames = Object.create(null);
    const folderNamesExpanded = Object.create(null);
    const folderPairs = new Map();
    const fileIds = new Set();

    function addDefinition(id, iconPath) {
        requireId(id, 'icon id');
        if (Object.hasOwn(definitions, id)) {
            throw new Error(`Duplicate icon id "${id}".`);
        }
        definitions[id] = { iconPath };
    }

    function addAliases(aliases, mapping, id, location) {
        if (aliases === undefined) {
            return;
        }
        if (!Array.isArray(aliases)) {
            throw new Error(`${location} must be an array.`);
        }
        for (const alias of aliases) {
            if (typeof alias !== 'string' || !alias || /[*?]/.test(alias)) {
                throw new Error(`${location}: use nonempty exact names or compound extensions, not glob patterns.`);
            }
            // VS Code compares these associations case-insensitively.
            const key = alias.toLowerCase();
            if (Object.hasOwn(mapping, key)) {
                throw new Error(`${location}: duplicate association "${alias}".`);
            }
            mapping[key] = id;
        }
    }

    for (const [group, entries] of [['files', catalog.files], ['folders', catalog.folders]]) {
        for (const entry of entries) {
            const fields = group === 'files' ? ['id', 'icon', 'extensions', 'names', 'label', 'tags'] :
                ['id', 'icon', 'expandedId', 'names', 'label', 'tags'];
            requireObject(entry, fields, group);
            requireId(entry.id, `${group}.id`);
            if (Object.hasOwn(entry, 'label') && (typeof entry.label !== 'string' || !entry.label.trim())) {
                throw new Error(`${entry.id}.label must be a nonempty string.`);
            }
            if (Object.hasOwn(entry, 'tags') && (!Array.isArray(entry.tags) ||
                entry.tags.some(tag => typeof tag !== 'string' || !tag.trim()))) {
                throw new Error(`${entry.id}.tags must be an array of nonempty strings.`);
            }
            const icon = Object.hasOwn(entry, 'icon') ? entry.icon : entry.id;
            // Asset basenames only: no arbitrary filesystem paths in the catalog.
            if (typeof icon !== 'string' || !/^[a-z0-9][a-z0-9_-]*$/.test(icon)) {
                throw new Error(`${entry.id}: icon must be a lowercase asset basename without a path or extension.`);
            }
            addDefinition(entry.id, `../icons/${group}/${icon}.svg`);
            if (group === 'files') {
                fileIds.add(entry.id);
                addAliases(entry.extensions, fileExtensions, entry.id, `${entry.id}.extensions`);
                addAliases(entry.names, fileNames, entry.id, `${entry.id}.names`);
            } else {
                const expandedId = Object.hasOwn(entry, 'expandedId') ? entry.expandedId : `${entry.id}_open`;
                addDefinition(expandedId, `../icons/folders/${icon}-open.svg`);
                folderPairs.set(entry.id, expandedId);
                addAliases(entry.names, folderNames, entry.id, `${entry.id}.names`);
                addAliases(entry.names, folderNamesExpanded, expandedId, `${entry.id}.names`);
            }
        }
    }
    if (!fileIds.has(catalog.defaults.file)) {
        throw new Error('defaults.file must reference a file entry.');
    }
    if (!folderPairs.has(catalog.defaults.folder)) {
        throw new Error('defaults.folder must reference a folder entry.');
    }
    return {
        iconDefinitions: sorted(definitions),
        file: catalog.defaults.file,
        folder: catalog.defaults.folder,
        folderExpanded: folderPairs.get(catalog.defaults.folder),
        fileExtensions: sorted(fileExtensions),
        fileNames: sorted(fileNames),
        folderNames: sorted(folderNames),
        folderNamesExpanded: sorted(folderNamesExpanded),
    };
}

export const serializeTheme = theme => `${JSON.stringify(theme, null, 2)}\n`;

export function main(args = process.argv.slice(2), root = projectRoot) {
    try {
        if (args.length > 1 || (args.length === 1 && args[0] !== '--check')) {
            throw new Error('Usage: node scripts/generate-theme.mjs [--check]');
        }
        const catalog = JSON.parse(readFileSync(resolve(root, 'catalog/icons.json'), 'utf8'));
        const theme = buildTheme(catalog);
        const outputPath = resolve(root, 'themes/icon-theme.json');
        const errors = validateTheme(theme, dirname(outputPath));
        if (errors.length) {
            throw new Error(`Cannot generate an invalid theme:\n${errors.map(error => `- ${error}`).join('\n')}`);
        }
        const expected = serializeTheme(theme);
        if (args[0] === '--check') {
            let actual;
            try {
                actual = readFileSync(outputPath, 'utf8');
            } catch (error) {
                if (error.code !== 'ENOENT') {
                    throw error;
                }
            }
            if (actual !== expected) {
                throw new Error('Generated theme is missing or out of date. Run pnpm run generate and commit themes/icon-theme.json.');
            }
            console.log('Generated theme is up to date.');
        } else {
            writeFileSync(outputPath, expected);
            console.log('Generated themes/icon-theme.json from catalog/icons.json.');
        }
        return 0;
    } catch (error) {
        console.error(error.message);
        return 1;
    }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    process.exitCode = main();
}
