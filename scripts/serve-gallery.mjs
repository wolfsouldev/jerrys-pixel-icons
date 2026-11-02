import { readFileSync, realpathSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, relative, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { projectRoot } from './validate-theme.mjs';

const types = { '.html': 'text/html', '.css': 'text/css', '.mjs': 'text/javascript',
    '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.txt': 'text/plain' };

// Local-only static preview. No API, uploads, directory listing or workspace serving.
export function createGalleryServer(directory = resolve(projectRoot, 'dist/gallery')) {
    const root = realpathSync(directory);
    return createServer((request, response) => {
        const headers = {
            'X-Content-Type-Options': 'nosniff',
            'Referrer-Policy': 'no-referrer',
            'Cache-Control': 'no-store',
            'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
        };
        if (!['GET', 'HEAD'].includes(request.method)) {
            response.writeHead(405, { ...headers, Allow: 'GET, HEAD' }).end();
            return;
        }
        try {
            const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
            const path = realpathSync(resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`));
            const fromRoot = relative(root, path);
            if (fromRoot === '..' || fromRoot.startsWith(`..${sep}`) || !statSync(path).isFile()) {
                response.writeHead(404, headers).end('Not found');
                return;
            }
            const content = readFileSync(path);
            response.writeHead(200, { ...headers,
                'Content-Type': `${types[extname(path)] ?? 'application/octet-stream'}; charset=utf-8`,
                'Content-Length': content.length,
            });
            response.end(request.method === 'HEAD' ? undefined : content);
        } catch {
            response.writeHead(404, headers).end('Not found');
        }
    });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try {
        const { values } = parseArgs({ options: { port: { type: 'string', default: '4173' } } });
        const port = Number(values.port);
        if (!Number.isInteger(port) || port < 1 || port > 65535) {
            throw new Error('Port must be an integer between 1 and 65535.');
        }
        const server = createGalleryServer();
        server.on('error', error => { console.error(error.message); process.exitCode = 1; });
        server.listen(port, '127.0.0.1', () => console.log(`Gallery: http://127.0.0.1:${port}`));
        for (const signal of ['SIGTERM', 'SIGINT']) {
            process.on(signal, () => server.close());
        }
    } catch (error) {
        console.error(`${error.message}\nBuild first with pnpm run gallery:build.`);
        process.exitCode = 1;
    }
}
