import { readFileSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { XMLParser, XMLValidator } from 'fast-xml-parser';

export const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const associationGroups = ['fileExtensions', 'fileNames', 'folderNames', 'folderNamesExpanded',
    'rootFolderNames', 'rootFolderNamesExpanded', 'languageIds'];
const defaults = ['file', 'folder', 'folderExpanded', 'rootFolder', 'rootFolderExpanded'];

// Project policy: all named folders must have an explicit expanded counterpart.
// VS Code itself allows that mapping to be omitted, but this theme ships both artworks.
export function validateTheme(theme, themeDirectory) {
    const errors = [];
    if (!isObject(theme) || !isObject(theme.iconDefinitions)) {
        return ['iconDefinitions must be an object.'];
    }
    const definitions = theme.iconDefinitions;
    const checkedAssets = new Set();
    const parser = new XMLParser({ ignoreAttributes: false, processEntities: false,
        ignoreDeclaration: true, ignorePiTags: true });

    for (const [id, definition] of Object.entries(definitions)) {
        if (!isObject(definition) || typeof definition.iconPath !== 'string' || !definition.iconPath) {
            errors.push(`iconDefinitions.${id}: iconPath must be a nonempty string.`);
            continue;
        }
        const assetPath = resolve(themeDirectory, definition.iconPath);
        if (checkedAssets.has(assetPath)) {
            continue;
        }
        checkedAssets.add(assetPath);
        try {
            const content = readFileSync(assetPath, 'utf8');
            if (extname(assetPath).toLowerCase() !== '.svg') {
                errors.push(`${id}: expected an SVG asset (${definition.iconPath}).`);
                continue;
            }
            const result = XMLValidator.validate(content);
            if (result !== true) {
                errors.push(`${id}: invalid SVG XML: ${result.err.msg}`);
                continue;
            }
            const document = parser.parse(content);
            if (!isObject(document) || Object.keys(document).length !== 1 ||
                !isObject(document.svg) || document.svg['@_xmlns'] !== 'http://www.w3.org/2000/svg') {
                errors.push(`${id}: expected a single <svg> root with the SVG namespace.`);
            }
        } catch (error) {
            errors.push(`${id}: cannot read or parse ${definition.iconPath}: ${error.message}`);
        }
    }

    function checkReference(id, location) {
        if (typeof id !== 'string' || !Object.hasOwn(definitions, id)) {
            errors.push(`${location}: undefined icon "${id}".`);
        }
    }

    function checkAssociations(associations, prefix = '') {
        for (const key of defaults) {
            if (Object.hasOwn(associations, key)) {
                checkReference(associations[key], `${prefix}${key}`);
            }
        }
        for (const group of associationGroups) {
            if (!Object.hasOwn(associations, group)) {
                continue;
            }
            const mapping = associations[group];
            if (!isObject(mapping)) {
                errors.push(`${prefix}${group} must be an object.`);
                continue;
            }
            const seen = new Set();
            for (const [key, id] of Object.entries(mapping)) {
                const location = `${prefix}${group}.${key}`;
                const normalized = group === 'languageIds' ? key : key.toLowerCase();
                if (!key || /[*?]/.test(key)) {
                    errors.push(`${location}: use exact names or compound extensions, not glob patterns.`);
                }
                if (seen.has(normalized)) {
                    errors.push(`${location}: duplicate case-insensitive association.`);
                }
                seen.add(normalized);
                checkReference(id, location);
            }
        }
    }

    checkAssociations(theme);
    for (const variant of ['light', 'highContrast']) {
        if (Object.hasOwn(theme, variant)) {
            if (isObject(theme[variant])) {
                checkAssociations(theme[variant], `${variant}.`);
            } else {
                errors.push(`${variant} must be an object.`);
            }
        }
    }
    for (const key of ['file', 'folder', 'folderExpanded']) {
        if (!Object.hasOwn(theme, key)) {
            errors.push(`Missing default ${key} association.`);
        }
    }
    if (isObject(theme.folderNames) && isObject(theme.folderNamesExpanded)) {
        const closed = new Set(Object.keys(theme.folderNames).map(key => key.toLowerCase()));
        const expanded = new Set(Object.keys(theme.folderNamesExpanded).map(key => key.toLowerCase()));
        for (const key of closed) {
            if (!expanded.has(key)) {
                errors.push(`folderNamesExpanded: missing expanded association for "${key}".`);
            }
        }
        for (const key of expanded) {
            if (!closed.has(key)) {
                errors.push(`folderNames: missing collapsed association for "${key}".`);
            }
        }
    } else {
        errors.push('folderNames and folderNamesExpanded must both be objects.');
    }
    return errors;
}

export function validateThemeFile(themePath) {
    try {
        const theme = JSON.parse(readFileSync(themePath, 'utf8'));
        return { theme, errors: validateTheme(theme, dirname(themePath)) };
    } catch (error) {
        return { errors: [`Cannot load theme JSON: ${error.message}`] };
    }
}

export function main(root = projectRoot) {
    try {
        const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
        const themes = manifest.contributes?.iconThemes;
        if (!Array.isArray(themes) || themes.length === 0) {
            throw new Error('package.json must contribute at least one icon theme.');
        }
        let failed = false;
        for (const contribution of themes) {
            const { theme, errors } = validateThemeFile(resolve(root, contribution.path));
            if (errors.length) {
                failed = true;
                console.error(`${contribution.id}: validation failed:\n${errors.map(error => `- ${error}`).join('\n')}`);
            } else {
                console.log(`${contribution.id}: valid (${Object.keys(theme.iconDefinitions).length} definitions, ` +
                    `${Object.keys(theme.folderNames).length} folder associations).`);
            }
        }
        return failed ? 1 : 0;
    } catch (error) {
        console.error(error.message);
        return 1;
    }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    process.exitCode = main();
}
