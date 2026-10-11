import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { securityHeaders, immutable, fingerprinted } from './security.js';

// Build Output API lets response headers use hashes and analytics hosts from this build.
// dist remains the portable static output and is still consumed by the optional worker.
const root = new URL('../', import.meta.url);
const source = process.env.BUILD_OUTPUT_DIR ? pathToFileURL(resolve(process.env.BUILD_OUTPUT_DIR) + sep) : new URL('dist/', root);
const output = process.env.VERCEL_OUTPUT_DIR ? pathToFileURL(resolve(process.env.VERCEL_OUTPUT_DIR) + sep) : new URL('.vercel/output/', root);
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(source, new URL('static/', output), { recursive: true });
const headers = securityHeaders(await readFile(new URL('index.html', source), 'utf8'));
const routes = [
  { src: '/(.*)', headers, continue: true },
  { src: '^/en/?$', headers: { Location: '/' }, status: 308 },
  { src: '^/en/(.*)$', headers: { Location: '/$1' }, status: 308 },
  { src: fingerprinted, headers: { 'Cache-Control': immutable }, continue: true },
];
async function indexes(dir, prefix = '') {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) await indexes(new URL(`${entry.name}/`, dir), `${prefix}${entry.name}/`);
    else if (entry.name === 'index.html') {
      const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (prefix) routes.push({ src: `^/${escaped.slice(0, -1)}$`, headers: { Location: `/${prefix}` }, status: 308 });
      routes.push({ src: `^/${escaped}$`, dest: `/${prefix}index.html` });
    }
  }
}
await indexes(source);
routes.push({ handle: 'filesystem' }, { src: '/(.*)', dest: '/404.html', status: 404 });
await writeFile(new URL('config.json', output), JSON.stringify({ version: 3, routes }, null, 2) + '\n');
console.log('Built Vercel output with CSP hashes, cache rules, redirects and 404 routing');
