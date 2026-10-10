import { readFileSync } from 'node:fs';
import { iconSVG, attackSectionHTML, getVisual } from '../src/visuals.js';
import { catalog } from '../src/data.js';
import { localizeCatalog, translate } from '../src/i18n.js';
import { pathFor } from '../src/routes.js';
import { getLineage } from '../src/model.js';
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function generateSeo(data = catalog) {
  const origin = new URL(process.env.SITE_URL || JSON.parse(readFileSync(new URL('../package.json', import.meta.url))).homepage).origin;
  const shell = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const files = new Map();
  const pages = [];
  const full = ['# OWASP Evolution'];
  for (const language of ['en', 'es']) {
    const localized = localizeCatalog(data, language);
    const t = text => translate(text, language);
    const definitions = [{ route: null }];
    for (const family of Object.values(localized.families)) {
      definitions.push({ route: { family: family.id }, family });
      for (const edition of family.editions) for (const item of edition.items) definitions.push({route:{family:family.id,year:edition.year,id:item.id}, family, edition, item});
    }
    for (const {route, family, edition, item} of definitions) {
      const path = pathFor(route, data, language);
      const title = item ? `${item.id}: ${item.name} · ${edition.year} · ${language.toUpperCase()} · OWASP Evolution` : family ? `${family.label} · ${language.toUpperCase()} · OWASP Evolution` : `OWASP Evolution · ${language === 'es' ? 'Evolución de riesgos' : 'Risk evolution'}`;
      const description = item ? `${item.id} (${edition.year}): ${item.summary}` : family ? family.description : t('Explorador interactivo de la evolución del OWASP Top 10 para aplicaciones web y sistemas GenAI/LLM.');
      const alternates = ['es','en'].map(lang => `<link rel="alternate" hreflang="${lang}" href="${origin}${pathFor(route,data,lang)}">`).join('\n') + `\n<link rel="alternate" hreflang="x-default" href="${origin}${pathFor(route,data,'en')}">`;
      let content = `<h1>${item ? iconSVG(family.id, edition.year, item.id, item.name) : ''}${escape(item ? `${item.id}: ${item.name} · ${edition.year}` : title)}</h1><p${item ? ' class="detail-summary"' : ''}>${escape(item ? item.summary.split('. ')[0] : description)}</p>`;
      if (item) {
        const rawCwes = item.cwes || item.cwe || [];
        const cwes = Array.isArray(rawCwes) ? rawCwes : [rawCwes];
        const hasAttack = Boolean(getVisual(family.id, edition.year, item.id));
        const nav = [['overview', 'Resumen'], ...(hasAttack ? [['attack', 'Ataque'], ['example', 'Ejemplo']] : []), ['prevention', 'Prevención'], ['lineage', 'Linaje'], ['sources', 'Fuentes']];
        content = `<header class="detail-header">${content}</header><nav class="detail-section-nav" aria-label="${t('Secciones del detalle')}"><div class="detail-tabs">${nav.map(([id, label]) => `<a href="#detail-${id}">${t(label)}</a>`).join('')}</div></nav><div class="detail-grid"><div class="detail-primary"><section id="detail-overview" class="detail-section detail-overview"><h2>${t('Resumen')}</h2><p>${escape(item.summary)}</p></section>${attackSectionHTML(family.id, edition.year, item.id, t)}</div><div class="detail-secondary">`;
        const lineage = getLineage(localized, family.id, edition.year, item.id);
        content += `<section id="detail-prevention" class="detail-section"><h2>${t('Prevención')}</h2><ul>${item.prevention.map(p=>`<li>${escape(p)}</li>`).join('')}</ul></section><section id="detail-lineage" class="detail-section"><h2>${t('Linaje')}</h2><ol>${lineage.nodes.map(n=>`<li><a href="${pathFor({family:family.id,year:n.year,id:n.id},data,language)}">${n.year} · ${n.id}: ${escape(n.name)}</a> ${escape(n.change)}</li>`).join('')}</ol><ul>${lineage.edges.map(e=>`<li>${escape(e.from)} → ${escape(e.to)}: ${escape(e.note)}</li>`).join('')}</ul></section><section id="detail-sources" class="detail-section"><h2>${t('Fuentes')}</h2><ul><li><a class="source-link" href="${escape(item.source)}">${t('Abrir fuente oficial ↗')}</a></li>${cwes.filter(c => /^(CWE-)?\d+$/.test(String(c))).map(c => `<li><a href="https://cwe.mitre.org/data/definitions/${String(c).replace(/^CWE-/, '')}.html">CWE-${String(c).replace(/^CWE-/, '')}</a></li>`).join('')}</ul></section></div></div>`;
      } else {
        for (const f of family ? [family] : Object.values(localized.families)) content += `<h2><a href="${pathFor({family:f.id},data,language)}">${escape(f.label)}</a></h2>${f.editions.map(e=>`<h3>${escape(e.label)}</h3><ul>${e.items.map(i=>`<li><a href="${pathFor({family:f.id,year:e.year,id:i.id},data,language)}">${i.id}: ${escape(i.name)}</a></li>`).join('')}</ul>`).join('')}`;
      }
      const breadcrumbs = [{ '@type':'ListItem',position:1,name:'OWASP Evolution',item:origin+pathFor(null,data,language)}];
      if(family) breadcrumbs.push({'@type':'ListItem',position:2,name:family.label,item:origin+pathFor({family:family.id},data,language)});
      if(item) breadcrumbs.push({'@type':'ListItem',position:3,name:`${item.id}: ${item.name} (${edition.year})`,item:origin+path});
      const structured = item ? [{'@context':'https://schema.org','@type':'DefinedTerm',name:item.name,termCode:item.id,description:item.summary,url:origin+path,inDefinedTermSet:item.source}, {'@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:breadcrumbs}] : {'@context':'https://schema.org','@type':family?'CollectionPage':'WebSite',name:title,url:origin+path,inLanguage:language};
      const image = `${origin}/assets/og-${family?.id || 'web'}-${language}.png`;
      let html = shell.replace('<html lang="es">',`<html lang="${language}">`).replace(/  <meta name="description"[^\n]*\n|  <meta property="og:[^\n]*\n|  <title>.*?<\/title>\n/g,'');
      html = html.replace('</head>',`<title>${escape(title)}</title><meta name="description" content="${escape(description)}"><link rel="canonical" href="${origin}${path}">${alternates}<meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}"><meta property="og:url" content="${origin}${path}"><meta property="og:type" content="${item?'article':'website'}"><meta property="og:image" content="${image}"><meta property="og:image:alt" content="OWASP Evolution"><meta name="twitter:image:alt" content="OWASP Evolution"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escape(title)}"><meta name="twitter:description" content="${escape(description)}"><meta name="twitter:image" content="${image}"><link rel="icon" href="/assets/favicon.svg" type="image/svg+xml"><link rel="icon" sizes="32x32" href="/assets/icon-32.png"><link rel="apple-touch-icon" sizes="180x180" href="/assets/icon-180.png"><link rel="manifest" href="/manifest.webmanifest"><script type="application/ld+json">${JSON.stringify(structured).replace(/</g,'\\u003c')}</script></head>`);
      html = html.replace('<main>', `<main><article id="prerender">${content}</article><noscript><p>${language==='es'?'Activa JavaScript para usar el explorador interactivo.':'Enable JavaScript to use the interactive explorer.'}</p></noscript>`).replaceAll('href="./styles.css"','href="/styles.css"').replaceAll('src="./src/app.js"','src="/src/app.js"');
      if(language==='en') html=html.replace(/>([^<>]+)</g,(match,text)=>t(text.trim()) === text.trim() ? match : `>${escape(t(text.trim()))}<`).replace(/(aria-label|placeholder)="([^"]+)"/g,(_,key,text)=>`${key}="${escape(t(text))}"`);
      html = html.replace(/(id="language-select" data-segment=")[01]/, `$1${language === 'en' ? 1 : 0}`);
      html = html.replace(/data-language="(es|en)" aria-checked="(?:true|false)" tabindex="-?\d"/g, (_, lang) => `data-language="${lang}" aria-checked="${lang === language}" tabindex="${lang === language ? 0 : -1}"`);
      html = html.replace('class="brand" href="/"', `class="brand" href="${pathFor(null,data,language)}"`);
      files.set(`${path.slice(1)}index.html`,html);
      // Legacy English URLs serve the same HTML and canonical metadata.
      if (language === 'en') files.set(`en/${path.slice(1)}index.html`, html);
      pages.push({path,route}); full.push(`## ${title}`,description, ...(item?.prevention || []),`URL: ${origin}${path}`,item?.source || '', ...(item ? getLineage(localized, family.id, edition.year, item.id).nodes.map(n => `${n.year} · ${n.id}: ${n.name} — ${n.change || ''}`) : []));
    }
  }
  files.set('sitemap.xml',`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${pages.map(({path,route})=>`<url><loc>${origin}${path}</loc>${['es','en','x-default'].map(l=>`<xhtml:link rel="alternate" hreflang="${l}" href="${origin}${pathFor(route,data,l==='x-default'?'en':l)}"/>`).join('')}</url>`).join('')}</urlset>`);
  files.set('robots.txt',`User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`);
  files.set('llms.txt',`# OWASP Evolution\n\nBilingual OWASP risk evolution explorer.\n\n- [Full reference](${origin}/llms-full.txt)\n- [Spanish](${origin}/es/)\n- [English](${origin}/)\n`);
  files.set('llms-full.txt',full.join('\n\n'));
  files.set('404.html',`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>404 · OWASP Evolution</title><link rel="stylesheet" href="/styles.css"><main style="padding:4rem"><h1>404</h1><p>Página no encontrada / Page not found</p><a href="/">Home</a> · <a href="/es/">Inicio</a></main></html>`);
  return files;
}
