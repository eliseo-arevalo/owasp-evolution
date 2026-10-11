// Local adapter for the generated Vercel routes, including headers and redirects.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, resolve, sep } from 'node:path';
export async function serveVercel(output) {
  const { routes } = JSON.parse(await readFile(join(output, 'config.json'), 'utf8'));
  const root = resolve(output, 'static');
  const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.png':'image/png', '.woff2':'font/woff2', '.xml':'application/xml', '.json':'application/json', '.webmanifest':'application/manifest+json', '.txt':'text/plain' };
  async function file(path) {
    const full = resolve(root, '.' + decodeURIComponent(path));
    if (!full.startsWith(root + sep) && full !== root) return null;
    try { if ((await stat(full)).isFile()) return { body: await readFile(full), type: types[extname(full)] || 'application/octet-stream' }; } catch {}
    return null;
  }
  const server = createServer(async (req,res) => {
    try {
      const url = new URL(req.url,'http://localhost');
      for (const route of routes) {
        if (route.handle === 'filesystem') {
          const found = await file(url.pathname);
          if (found) { res.setHeader('Content-Type',found.type); res.end(found.body); return; }
          continue;
        }
        const pattern = new RegExp(route.src), match = pattern.exec(url.pathname);
        if (!match) continue;
        for (const [key,value] of Object.entries(route.headers || {})) res.setHeader(key, url.pathname.replace(pattern, value));
        if (route.continue) continue;
        if (route.status) res.statusCode = route.status;
        if (route.status === 308) { res.setHeader('Location',res.getHeader('Location') + url.search); res.end(); return; }
        if (route.dest) {
          const found = await file(url.pathname.replace(pattern,route.dest));
          if (found) { res.setHeader('Content-Type',found.type); res.end(found.body); return; }
        }
      }
      res.statusCode=404; res.end();
    } catch (error) { res.statusCode=500; res.end(String(error)); }
  });
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  return { origin:`http://127.0.0.1:${server.address().port}`, close:() => new Promise(resolve => server.close(resolve)) };
}
