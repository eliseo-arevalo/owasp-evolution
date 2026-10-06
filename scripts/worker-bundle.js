import { mkdir, writeFile } from 'node:fs/promises';
// Optional asset worker: language belongs to the URL; static HTML is never rewritten.
export async function buildWorkerBundle() {
  return `export default { async fetch(request, env) { return env.ASSETS.fetch(request); } };\n`;
}
if (process.argv[1]?.endsWith('/worker-bundle.js')) {
  await mkdir(new URL('../worker-dist/', import.meta.url), { recursive: true });
  await writeFile(new URL('../worker-dist/worker.js', import.meta.url), await buildWorkerBundle());
}
