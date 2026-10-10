import test from 'node:test';
import assert from 'node:assert/strict';
import {compactJavaScript} from '../scripts/compact.js';
test('compaction preserves literals, regex escapes, templates and ASI',()=>{
 const source = 'const text = "https://example.com/a b";\nconst regex = /a\\/b/;\nconst template = `line  one\\nline two`;\n// comment\nfunction value() { return\n  text; }\nreturn [text, regex.source, template, value()];';
 assert.deepEqual(Function(compactJavaScript(source))(),Function(source)());
 assert.ok(compactJavaScript(source).length < source.length);
});


test('static build preloads each shared module exactly once with the current fingerprint', async () => {
  const { readFile, readdir } = await import('node:fs/promises');
  const html = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
  const hrefs = [...html.matchAll(/<link rel="modulepreload" href="([^"]+)">/g)].map(m => m[1]);
  const modules = await readdir(new URL('../src/', import.meta.url));
  assert.equal(hrefs.length, modules.length);
  assert.equal(new Set(hrefs).size, modules.length);
  for (const name of modules) assert.ok(hrefs.some(href => href.endsWith('/' + name)));
  for (const href of hrefs) assert.ok((await readFile(new URL('../dist' + href, import.meta.url))).length > 0);
});
