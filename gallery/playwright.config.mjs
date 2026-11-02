import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;

export default defineConfig({
    testDir: './tests',
    outputDir: '../dist/gallery-test-results',
    fullyParallel: true,
    forbidOnly: Boolean(process.env.CI),
    workers: 2,
    reporter: 'list',
    use: {
        baseURL: 'http://127.0.0.1:4183',
        browserName: 'chromium',
        launchOptions: executablePath ? { executablePath } : {},
        screenshot: 'only-on-failure',
        trace: 'retain-on-failure',
    },
    projects: [
        { name: 'desktop', use: { viewport: { width: 1440, height: 1000 } } },
        { name: 'mobile', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    ],
    webServer: {
        command: 'pnpm run gallery:build && node scripts/serve-gallery.mjs --port 4183',
        cwd: root,
        url: 'http://127.0.0.1:4183',
        reuseExistingServer: false,
        timeout: 30000,
    },
});
