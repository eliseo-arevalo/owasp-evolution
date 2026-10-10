import { compactJavaScript } from './compact.js';
import { createHash } from 'node:crypto';
import { cp, mkdir, rm, writeFile, readFile, readdir } from 'node:fs/promises';
import { generateSeo } from './seo.js';

const output = new URL('../dist/', import.meta.url);
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const entry of ['index.html', 'styles.css', 'src', 'assets', 'manifest.webmanifest', 'LICENSES']) {
  await cp(new URL(`../${entry}`, import.meta.url), new URL(entry, output), { recursive: true });
}

for (const [path, content] of generateSeo()) {
  const target = new URL(path, output);
  await mkdir(new URL('./', target), { recursive: true });
  await writeFile(target, content, 'utf8');
}

// A directory fingerprint versions the complete module graph, including its relative imports.
const modules = (await readdir(new URL('src/', output))).sort();
const moduleText = (await Promise.all(modules.map(name => readFile(new URL(`src/${name}`, output), 'utf8')))).join('');
const version = createHash('sha256').update(moduleText).digest('hex').slice(0, 12);
await cp(new URL('src/', output), new URL(`assets/app-${version}/`, output), { recursive: true });
for (const name of modules) {
  const target = new URL(`assets/app-${version}/${name}`, output);
  const text = await readFile(target, 'utf8');
  // Conservative whitespace compaction preserves literals, regular expressions and ASI.
  await writeFile(target, compactJavaScript(text));
}
const css = (await readFile(new URL('styles.css', output), 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').replace(/\s*([{};])\s*/g, '$1').replaceAll('./assets/', '/assets/');
const cssName = `styles-${createHash('sha256').update(css).digest('hex').slice(0,12)}.css`;
await writeFile(new URL(cssName, output), css);
async function rewrite(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const target = new URL(entry.name + (entry.isDirectory() ? '/' : ''), dir);
    if (entry.isDirectory()) await rewrite(target);
    else if (entry.name.endsWith('.html')) await writeFile(target, (await readFile(target, 'utf8')).replaceAll('/styles.css', `/${cssName}`).replaceAll('/src/app.js', `/assets/app-${version}/app.js`));
  }
}
await rewrite(output);
await rm(new URL('src/', output), { recursive: true });
await rm(new URL('styles.css', output));
console.log('Built static site in dist/');
