import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { generateSeo } from './seo.js';

const output = new URL('../dist/', import.meta.url);
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const entry of ['index.html', 'styles.css', 'src', 'assets', 'robots.txt']) {
  await cp(new URL(`../${entry}`, import.meta.url), new URL(entry, output), { recursive: true });
}

for (const [path, content] of generateSeo()) {
  const target = new URL(path, output);
  await mkdir(new URL('./', target), { recursive: true });
  await writeFile(target, content, 'utf8');
}

console.log('Built static site in dist/');
