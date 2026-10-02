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
    '/src/model.js',
    '/assets/fonts/Geist-Regular.ttf',
    '/assets/fonts/GeistMono-Regular.ttf',
  ]) {
    assert.match(script, new RegExp(JSON.stringify(path).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  assert.match(script, /export default/);
  assert.match(script, /Content-Security-Policy/);
  assert.ok(Buffer.byteLength(script) < 3_000_000, 'Worker bundle must fit the free-plan script limit');
});
