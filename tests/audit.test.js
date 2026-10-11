import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { catalog } from '../src/data.js';
import { rowCues, visibleConnections } from '../src/editions.js';
import { lineageEditions } from '../src/lineage.js';
import { getLineage } from '../src/model.js';
import { getVisual, attackSectionHTML } from '../src/visuals.js';
import { translate, localizeCatalog } from '../src/i18n.js';
import { exportMarkdown } from '../src/export.js';
import { pathFor } from '../src/routes.js';
import { generateSeo } from '../scripts/seo.js';
import { securityHeaders, fingerprinted, immutable, revalidate } from '../scripts/security.js';

test('CA-001: initial editions are not introductions; later and explicit new entries are', () => {
  for (const family of Object.values(catalog.families)) {
    const edition = family.editions[0];
    for (const item of edition.items) {
      const node = lineageEditions(family, getLineage(catalog, family.id, edition.year, item.id), `${edition.year}:${item.id}`).flatMap(g => g.nodes).find(n => n.year === edition.year && n.id === item.id);
      assert.equal(node.isNew, false); assert.equal(node.firstEdition, true);
    }
  }
  const family = structuredClone(catalog.families.web);
  family.editions[0].items[0].isNew = true;
  assert.equal(rowCues(family, new Set([2013, 2021])).get('2013:A1').isNew, true);
  assert.equal(rowCues(family, new Set([2013, 2021])).get('2021:A04').isNew, true);
});
test('CA-002: all four audit paths preserve every hop and merge/rename meaning', () => {
  const family = catalog.families.web;
  const before = JSON.stringify(catalog);
  const edges = visibleConnections(family, new Set([2013, 2025]));
  for (const [from, to, type] of [['A4','A01','merged'],['A7','A01','merged'],['A3','A05','merged'],['A6','A04','renamed']]) {
    const edge = edges.find(e => e.from === `2013:${from}` && e.to === `2025:${to}`);
    assert.equal(edge.type, type); assert.equal(edge.path.length, 3);
    for (const part of edge.path) assert.ok(edge.note.includes(`${part.from} → ${part.to}: ${part.note}`));
    assert.notEqual(edge.note, edge.path.at(-1).note);
  }
  assert.equal(Object.values(catalog.families).reduce((n,f) => n + f.edges.length, 0), 38);
  assert.equal(JSON.stringify(catalog), before);
});
test('CA-003/006: Spanish prose and comments are localized in HTML and Markdown for every example', () => {
  const staticPages = generateSeo();
  for (const family of Object.values(catalog.families)) for (const edition of family.editions) for (const item of edition.items) {
    const visual = getVisual(family.id, edition.year, item.id);
    for (const language of ['es','en']) {
      const t = s => translate(s, language);
      const html = attackSectionHTML(family.id, edition.year, item.id, t);
      const text = html.match(/<pre><code>([\s\S]*?)<\/code>/)[1].replace(/<\/?mark>/g,'').replaceAll('&quot;','"').replaceAll('&#39;',"'").replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&amp;','&');
      const expected = t(visual.example).replaceAll('[[','').replaceAll(']]','');
      assert.equal(text, expected);
      const staticHtml = staticPages.get(pathFor({family: family.id, year: edition.year, id: item.id}, catalog, language).slice(1) + 'index.html');
      assert.ok(staticHtml.includes(html.match(/<pre><code>[\s\S]*?<\/code><\/pre>/)[0]));
      assert.ok(exportMarkdown(family, edition.year, item, language).includes(expected));
      if (language === 'es') assert.doesNotMatch(text, /Task:|Answer:|No such section|# (No |Unreviewed|Security|Personal|Response|Poisoned)/);
    }
  }
  const es = JSON.stringify(localizeCatalog(catalog, 'es'));
  assert.doesNotMatch(es, /[Rr]edactar|sin redactarlos/);
  assert.match(attackSectionHTML('llm', 2026, 'LLM03'), /redactar borrador/);
});
test('CA-005: SQL payload changes a query; binding keeps it as data in all four editions', () => {
  const payload = "' OR '1'='1";
  for (const [year,id] of [[2013,'A1'],[2017,'A1'],[2021,'A03'],[2025,'A05']]) {
    const visual = getVisual('web',year,id);
    assert.ok(visual.example.includes(payload)); assert.ok(visual.description.includes(payload));
    assert.match(visual.fix, /WHERE \w+ = \?/);
    assert.ok(attackSectionHTML('web',year,id).includes(payload.replaceAll("'", '&#39;')));
  }
  const result = execFileSync('python3', ['-c', `import sqlite3\nc=sqlite3.connect(':memory:')\nc.executescript("CREATE TABLE users(id,name); INSERT INTO users VALUES (1,'Alice'),(2,'Bob');")\np="' OR '1'='1"\nassert len(c.execute("SELECT id FROM users WHERE name = '"+p+"'").fetchall()) == 2\nassert c.execute('SELECT id FROM users WHERE name = ?', [p]).fetchall() == []\nprint('ok')`], {encoding:'utf8'});
  assert.equal(result.trim(), 'ok');
});
test('SEO: 126 concise canonical descriptions, locales, and history-derived lastmod dates', () => {
  const files = generateSeo(); let count = 0;
  for (const [path, html] of files) {
    if (!path.endsWith('index.html') || path.startsWith('en/')) continue;
    count++;
    const description = html.match(/name="description" content="([^"]*)"/)[1].replace(/&(?:amp|quot|#39|lt|gt);/g,'x');
    assert.ok(description.length <= 160, path);
    const es = path.startsWith('es/');
    assert.ok(html.includes(`property="og:locale" content="${es?'es_ES':'en_US'}"`));
    assert.ok(html.includes(`property="og:locale:alternate" content="${es?'en_US':'es_ES'}"`));
    assert.doesNotMatch(html, /New in 2013|Nueva en 2013|New in 2025.*Prompt Injection/);
  }
  assert.equal(count,126);
  const dates = [...files.get('sitemap.xml').matchAll(/<lastmod>([^<]+)<\/lastmod>/g)];
  assert.equal(dates.length,126);
  const date = execFileSync('git',['log','-1','--format=%cs','--','src/data.js','src/visuals.js','src/i18n.js','src/translations-en.js','src/lineage.js','scripts/seo.js'],{encoding:'utf8'}).trim();
  assert.ok(dates.every(([,d]) => d === date));
});
test('CSP hashes executable boot bytes, derives analytics origin, and cache rules only match hashes', () => {
  const html = readFileSync('dist/index.html','utf8');
  const headers = securityHeaders(html,{UMAMI_SCRIPT_URL:'https://metrics.example/script.js',UMAMI_WEBSITE_ID:'test'});
  const csp = headers['Content-Security-Policy'];
  assert.match(csp, /script-src 'self' https:\/\/metrics.example 'sha256-[^']+'/);
  assert.doesNotMatch(csp.match(/script-src[^;]+/)[0], /unsafe-inline|unsafe-eval/);
  assert.match(csp,/connect-src 'self' https:\/\/metrics.example/);
  assert.match(csp,/frame-ancestors 'none'/);
  assert.equal(headers['Cache-Control'],revalidate);
  assert.notEqual(securityHeaders(html.replace('booting','other'))['Content-Security-Policy'],securityHeaders(html)['Content-Security-Policy']);
  const pattern=new RegExp(fingerprinted);
  assert.ok(pattern.test('/assets/app-123456789abc/app.js')); assert.ok(pattern.test('/styles-123456789abc.css'));
  for(const path of ['/','/es/index.html','/assets/fonts/Geist-Regular.woff2','/assets/icon-32.png']) assert.ok(!pattern.test(path));
  assert.equal(immutable,'public, max-age=31536000, immutable');
});
