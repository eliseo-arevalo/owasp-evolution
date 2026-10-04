import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { generateSeo } from '../scripts/seo.js';

test('SEO documents and built category pages include Web 2025 and LLM 2026', async () => {
  const files = generateSeo();
  for (const route of ['/web/2025/A01/', '/llm/2026/LLM01/']) {
    assert.ok(files.get('sitemap.xml').includes(`<loc>${route}</loc>`));
    assert.ok(files.get('llms-full.txt').includes(`URL de la ficha: ${route}`));
    const page = await readFile(new URL(`../dist${route}index.html`, import.meta.url), 'utf8');
    assert.ok(page.includes('<html lang="es">'));
    assert.ok(page.includes(`href="/#${route.slice(0, -1)}"`));
    assert.ok(page.includes('<h1>'));
  }
  for (const name of ['robots.txt', 'sitemap.xml', 'llms.txt', 'llms-full.txt']) {
    assert.ok((await readFile(new URL(`../dist/${name}`, import.meta.url), 'utf8')).length);
  }
});
