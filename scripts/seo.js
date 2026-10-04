import { catalog } from '../src/data.js';

const description = 'Proyecto que documenta la evolución de las categorías del OWASP Top 10 para aplicaciones web y sistemas GenAI/LLM.';
const escape = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);

// Site-relative URLs keep the generated documents independent of the host.
export function generateSeo(data = catalog) {
  const files = new Map();
  const urls = ['/', '/llms.txt'];
  const full = ['# OWASP Evolution', '', description, ''];

  for (const [familyId, family] of Object.entries(data.families)) {
    full.push(`## ${family.label}`, '');
    for (const edition of family.editions) {
      full.push(`### ${edition.label}`, `Año: ${edition.year}`, '');
      for (const item of edition.items) {
        const route = `/${familyId}/${edition.year}/${item.id}/`;
        const interactive = `/#/${familyId}/${edition.year}/${item.id}`;
        const title = `${item.id}: ${item.name} · ${edition.year} · OWASP Evolution`;
        const summary = item.summary || `${item.name}, categoría ${item.id} de ${edition.label}.`;
        urls.push(route);
        full.push(`#### ${item.id}: ${item.name}`, `Identificador: ${item.id}`,
          `Nombre oficial: ${item.name}`, `Año: ${edition.year}`,
          ...(item.summary ? [`Resumen: ${item.summary}`] : []),
          `URL de la ficha: ${route}`, `Fuente oficial: ${item.source}`, '');
        files.set(`${route.slice(1)}index.html`, `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escape(title)}</title>
  <meta name="description" content="${escape(summary)}">
</head>
<body>
  <main>
    <p>${escape(family.label)} · ${escape(edition.year)} · ${escape(item.id)}</p>
    <h1>${escape(item.name)}</h1>
    ${item.summary ? `<p>${escape(item.summary)}</p>` : ''}
    <nav aria-label="Enlaces de la categoría">
      <p><a href="${escape(interactive)}">Ver categoría en el explorador interactivo</a></p>
      <p><a href="${escape(item.source)}">Fuente oficial de OWASP</a></p>
      <p><a href="/">Inicio de OWASP Evolution</a></p>
    </nav>
  </main>
</body>
</html>
`);
      }
    }
  }

  files.set('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => `  <url><loc>${escape(url)}</loc></url>`).join('\n')}
</urlset>
`);
  files.set('llms.txt', `# OWASP Evolution

> ${description}

## Documentación completa

- [Contenido completo en texto](/llms-full.txt): Familias, ediciones y categorías con nombres oficiales, resúmenes, fichas y fuentes de OWASP.
`);
  files.set('llms-full.txt', `${full.join('\n')}\n`);
  return files;
}
