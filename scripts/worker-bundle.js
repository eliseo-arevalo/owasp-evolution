import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { detectLanguage, spanishCountries } from '../src/locale.js';

const PUBLIC_ASSETS = [
  ['index.html', 'text/html; charset=utf-8'],
  ['styles.css', 'text/css; charset=utf-8'],
  ['src/app.js', 'text/javascript; charset=utf-8'],
  ['src/data.js', 'text/javascript; charset=utf-8'],
  ['src/focus.js', 'text/javascript; charset=utf-8'],
  ['src/locale.js', 'text/javascript; charset=utf-8'],
  ['src/i18n.js', 'text/javascript; charset=utf-8'],
  ['src/editions.js', 'text/javascript; charset=utf-8'],
  ['src/translations-en.js', 'text/javascript; charset=utf-8'],
  ['src/model.js', 'text/javascript; charset=utf-8'],
  ['assets/fonts/Geist-Regular.ttf', 'font/ttf'],
  ['assets/fonts/Geist-Medium.ttf', 'font/ttf'],
  ['assets/fonts/Geist-SemiBold.ttf', 'font/ttf'],
  ['assets/fonts/GeistMono-Regular.ttf', 'font/ttf'],
  ['assets/fonts/GeistMono-Medium.ttf', 'font/ttf'],
];

function directoryUrl(input) {
  if (input instanceof URL) return input;
  return pathToFileURL(`${resolve(input)}/`);
}

export async function buildWorkerBundle(root) {
  const rootUrl = directoryUrl(root);
  const assets = {};

  for (const [relativePath, contentType] of PUBLIC_ASSETS) {
    const body = await readFile(new URL(relativePath, rootUrl));
    assets[`/${relativePath}`] = {
      contentType,
      body: body.toString('base64'),
    };
  }

  return `const spanishCountries = new Set(${JSON.stringify([...spanishCountries])});
const detectLanguage = ${detectLanguage.toString()};
const ASSETS = ${JSON.stringify(assets)};

const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
};

function responseFor(request, asset, isHtml = false) {
  const headers = new Headers({
    'Content-Type': asset.contentType,
    'Cache-Control': isHtml ? 'no-cache' : 'public, max-age=3600',
  });
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) headers.set(name, value);
  const bytes = Uint8Array.from(atob(asset.body), character => character.charCodeAt(0));
  let body = bytes;
  if (isHtml) {
    const language = detectLanguage({ country: request.headers.get('CF-IPCountry'), acceptLanguage: request.headers.get('Accept-Language') || '' });
    const html = new TextDecoder().decode(bytes).replace('<html lang="es">', '<html lang="' + language + '">').replace('<head>', '<head><meta name="owasp-language" content="' + language + '">');
    body = new TextEncoder().encode(html);
    headers.set('Vary', 'CF-IPCountry, Accept-Language');
    headers.set('Content-Language', language);
  }
  return new Response(request.method === 'HEAD' ? null : body, { status: 200, headers });
}

export default {
  async fetch(request) {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
    }

    const pathname = new URL(request.url).pathname;
    if (pathname === '/' || pathname === '/index.html') {
      return responseFor(request, ASSETS['/index.html'], true);
    }

    const asset = ASSETS[pathname];
    if (!asset) return new Response('Not Found', { status: 404 });
    return responseFor(request, asset);
  },
};
`;
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) {
  const projectRoot = new URL('../', import.meta.url);
  const outputDirectory = new URL('worker-dist/', projectRoot);
  await mkdir(outputDirectory, { recursive: true });
  const worker = await buildWorkerBundle(new URL('dist/', projectRoot));
  const outputFile = new URL('worker.js', outputDirectory);
  await writeFile(outputFile, worker);
  console.log(`Built ${fileURLToPath(outputFile)} (${Buffer.byteLength(worker)} bytes)`);
}
