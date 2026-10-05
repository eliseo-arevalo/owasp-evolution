import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWorkerBundle } from '../scripts/worker-bundle.js';

test('bundles every public asset into a deployable Worker module', async () => {
  const script = await buildWorkerBundle(new URL('../dist/', import.meta.url));

  for (const path of [
    '/index.html',
    '/styles.css',
    '/src/app.js',
    '/src/data.js',
    '/src/focus.js',
    '/src/model.js',
    '/src/motion.js',
    '/assets/fonts/Geist-Regular.ttf',
    '/assets/fonts/GeistMono-Regular.ttf',
  ]) {
    assert.match(script, new RegExp(JSON.stringify(path).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  assert.match(script, /export default/);
  assert.match(script, /Content-Security-Policy/);
  assert.ok(Buffer.byteLength(script) < 3_000_000, 'Worker bundle must fit the free-plan script limit');
});

test('Worker detects request language, varies HTML and serves all localization modules', async () => {
  const script = await buildWorkerBundle(new URL('../dist/', import.meta.url));
  const { default: worker } = await import(`data:text/javascript;base64,${Buffer.from(script).toString('base64')}`);
  for (const [headers, expected] of [
    [{ 'CF-IPCountry': 'SV', 'Accept-Language': 'en-US' }, 'es'],
    [{ 'CF-IPCountry': 'US', 'Accept-Language': 'es' }, 'en'],
    [{ 'Accept-Language': 'es-MX, en;q=0.5' }, 'es'],
    [{ 'Accept-Language': 'fr-FR' }, 'en'],
  ]) {
    const response = await worker.fetch(new Request('https://example.com/', { headers }));
    assert.equal(response.headers.get('Content-Language'), expected);
    assert.equal(response.headers.get('Vary'), 'CF-IPCountry, Accept-Language');
    assert.match(await response.text(), new RegExp(`<meta name="owasp-language" content="${expected}">`));
  }
  for (const name of ['i18n', 'locale', 'editions', 'translations-en']) {
    const response = await worker.fetch(new Request(`https://example.com/src/${name}.js`));
    assert.equal(response.status, 200);
    assert.match(response.headers.get('Content-Type'), /javascript/);
  }
  const head = await worker.fetch(new Request('https://example.com/', { method: 'HEAD', headers: { 'CF-IPCountry': 'ES' } }));
  assert.equal(head.headers.get('Content-Language'), 'es');
  assert.equal(await head.text(), '');
});
