import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { buildGalleryData } from '../../scripts/build-gallery.mjs';

const catalog = JSON.parse(readFileSync(new URL('../../catalog/icons.json', import.meta.url), 'utf8'));
const manifest = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
const data = buildGalleryData(catalog, manifest);
const total = data.entries.length;

test('loads all entries, decodes every SVG and has no script errors or horizontal overflow', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/');
    await expect(page.locator('.icon-card')).toHaveCount(total);
    const failures = await page.evaluate(async entries => {
        const paths = [...new Set(entries.flatMap(entry => [entry.icon, entry.openIcon].filter(Boolean)))];
        return (await Promise.all(paths.map(path => new Promise(resolve => {
            const image = new Image();
            image.onload = () => resolve(null);
            image.onerror = () => resolve(path);
            image.src = path;
        })))).filter(Boolean);
    }, data.entries);
    expect(failures).toEqual([]);
    expect(errors).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('searches friendly labels, filenames and extensions; preserves URL state', async ({ page }) => {
    await page.goto('/');
    const search = page.getByRole('searchbox');
    await search.fill('JavaScript');
    await expect(page.locator('.icon-card[data-key="file/js"]')).toBeVisible();
    await search.fill('package.json');
    await expect(page.locator('.icon-card')).toHaveCount(1);
    await expect(page.locator('.card-label')).toHaveText('Node.js · paquetes');
    await search.fill('.py');
    await expect(page.locator('.icon-card[data-key="file/py"]')).toBeVisible();
    await expect(page).toHaveURL(/q=\.py/);
    await page.reload();
    await expect(search).toHaveValue('.py');
    await expect(page.locator('.icon-card[data-key="file/py"]')).toBeVisible();
});

test('filters folders, toggles their images and keeps both states in the detail', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /^Carpetas / }).click();
    await expect(page.locator('.icon-card')).toHaveCount(catalog.folders.length);
    const card = page.locator('.icon-card[data-key="folder/src"]');
    await page.getByLabel('Carpetas abiertas', { exact: true }).check();
    await expect(card.locator('img')).toHaveAttribute('src', 'icons/folders/src-open.svg');
    await card.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.locator('#detail-image')).toHaveAttribute('src', 'icons/folders/src-open.svg');
    await expect(page.locator('#detail-id')).toHaveText('src_open');
    await page.getByRole('button', { name: 'Cerrada', exact: true }).click();
    await expect(page.locator('#detail-image')).toHaveAttribute('src', 'icons/folders/src.svg');
    await expect(page.locator('#detail-id')).toHaveText('src');
    await expect(page.locator('#detail-names')).toHaveText('src');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(card).toBeFocused();
});

test('shows exact associations, copies an ID and downloads the original SVG', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/?q=javascript&type=file');
    await page.locator('.icon-card[data-key="file/js"]').click();
    await expect(page.locator('#detail-extensions')).toContainText('.js');
    await page.getByRole('button', { name: 'Copiar ID' }).click();
    await expect(page.locator('#copy-status')).toContainText('copiado');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('js');
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('link', { name: 'Descargar SVG' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('js.svg');
    await page.getByRole('button', { name: 'Cerrar detalle' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('shows an empty state safely and resets filters', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('searchbox').fill('<img src=x onerror=alert(1)>');
    await expect(page.locator('.icon-card')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Ningún píxel por aquí.' })).toBeVisible();
    await expect(page.locator('#results-count')).toContainText('<img src=x');
    await expect(page.locator('img[src="x"]')).toHaveCount(0);
    await page.getByRole('button', { name: 'Limpiar búsqueda y filtros' }).click();
    await expect(page.locator('.icon-card')).toHaveCount(total);
    await expect(page.getByRole('searchbox')).toHaveValue('');
});

test('supports keyboard search and persists theme preference', async ({ page }) => {
    await page.goto('/');
    await page.locator('#search-fields').waitFor({ state: 'visible' });
    await page.keyboard.press('/');
    await expect(page.getByRole('searchbox')).toBeFocused();
    await page.keyboard.type('python');
    await expect(page.locator('.icon-card[data-key="file/py"]')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('searchbox')).toHaveValue('');
    await page.evaluate(() => localStorage.setItem('jerry-gallery-theme', 'light'));
    await page.reload();
    await page.getByRole('button', { name: 'Cambiar a modo oscuro' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('recovers from an unavailable catalog', async ({ page }) => {
    await page.route('**/data.json', route => route.fulfill({ status: 503, body: 'unavailable' }));
    await page.goto('/');
    await expect(page.locator('#load-error')).toBeVisible();
    await expect(page.getByRole('searchbox')).toBeDisabled();
    await page.unroute('**/data.json');
    await page.getByRole('button', { name: 'Volver a intentar' }).click();
    await expect(page.locator('.icon-card')).toHaveCount(total);
    await expect(page.locator('#load-error')).toBeHidden();
});

test('captures light, dark and collection previews', async ({ page }, testInfo) => {
    await page.goto('/');
    await expect(page.locator('.icon-card')).toHaveCount(total);
    await page.evaluate(() => localStorage.setItem('jerry-gallery-theme', 'light'));
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(page.locator('.hero-icon img').first()).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('gallery-light.png') });
    await page.getByRole('button', { name: 'Cambiar a modo oscuro' }).click();
    await page.screenshot({ path: testInfo.outputPath('gallery-dark.png') });
    await page.locator('#collection').scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath('gallery-collection.png') });
});

test('the extra pack is searchable, displays original SVGs and exposes its credits', async ({ page }) => {
    await page.goto('/');
    for (const [id, query] of [['pdf', '.pdf'], ['archive', '.zip'], ['font', '.woff2'],
        ['jupyter', '.ipynb'], ['angular', 'angular.json'], ['nuxt', 'nuxt.config.ts'],
        ['vitest', 'vitest.config.mts'], ['playwright', 'playwright.config.mjs'],
        ['kubernetes', 'k8s.yaml'], ['terraform', '.tf.json']]) {
        await page.getByRole('searchbox').fill(query);
        const card = page.locator(`.icon-card[data-key="file/${id}"]`);
        await expect(card).toBeVisible();
        await expect(card.locator('img')).toHaveAttribute('src', `icons/files/${id}.svg`);
        await card.click();
        await expect(page.locator('#download-icon')).toHaveAttribute('href', `icons/files/${id}.svg`);
        await expect(page.locator('#detail-id')).toHaveText(id);
        await page.keyboard.press('Escape');
    }
    const response = await page.request.get('/ICON_NOTICES.txt');
    expect(response.status()).toBe(200);
    expect(await response.text()).toContain('CC BY 4.0');
    await expect(page.getByRole('link', { name: 'Créditos de iconos' })).toHaveAttribute('href', './ICON_NOTICES.txt');
});
