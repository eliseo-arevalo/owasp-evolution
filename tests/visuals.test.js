import test from 'node:test';
import assert from 'node:assert/strict';
import { iconPaths } from '../src/icons.js';
import { visuals, getVisual, iconSVG, diagramSVG, attackSectionHTML } from '../src/visuals.js';
import { catalog } from '../src/data.js';
import { translate } from '../src/i18n.js';
import { generateSeo } from '../scripts/seo.js';
import { pathFor } from '../src/routes.js';
import { exportMarkdown } from '../src/export.js';

const pilot = catalog.families.web.editions.find(edition => edition.year === 2025).items;
test('every Web 2025 category has distinct Phosphor duotone paths and attack topology', () => {
  assert.deepEqual(Object.keys(visuals.web[2025]), pilot.map(item => item.id));
  assert.equal(new Set(pilot.map(item => iconPaths(getVisual('web', 2025, item.id).icon))).size, 10);
  assert.equal(new Set(pilot.map(item => getVisual('web', 2025, item.id).layout)).size, 10);
  assert.equal(new Set(pilot.map(item => diagramSVG('web', 2025, item.id).replace(/<title>[^]*?<\/desc>/, ''))).size, 10);
  for (const { id, name } of pilot) {
    const icon = iconSVG('web', 2025, id, name);
    assert.match(icon, /viewBox="0 0 256 256"/);
    assert.match(icon, /class="icon-secondary"/);
    assert.match(icon, /class="icon-tile"/);
    assert.match(icon, /role="img"/);
    assert.ok(icon.includes(`<title>${name.replaceAll('&', '&amp;')}</title>`));
    assert.match(iconSVG('web', 2025, id), /aria-hidden="true"/);
    assert.doesNotMatch(icon, /#[0-9a-f]{3,8}\b/i);
  }
});

test('every pilot has bilingual explanations and fixes with short selectable vulnerable code', () => {
  for (const { id, source } of pilot) {
    const visual = getVisual('web', 2025, id);
    assert.ok(visual.example.split('\n').length <= 4, id);
    assert.match(visual.example, /\[\[[^]+?\]\]/);
    assert.notEqual(translate(visual.description, 'en'), visual.description);
    assert.notEqual(translate(visual.fix, 'en'), visual.fix);
    for (const language of ['en', 'es']) {
      const t = text => translate(text, language);
      const svg = diagramSVG('web', 2025, id, t);
      assert.doesNotMatch(svg, />undefined<|>null<|>NaN</);
      assert.match(svg, /role="img"/);
      assert.match(svg, /viewBox="0 0 320 196"/);
      assert.ok(svg.includes(`data-layout="${visual.layout}"`));
      assert.ok(svg.includes(`<title>${id} · ${t('Cómo funciona el ataque')}</title>`));
      assert.ok(svg.includes(`<desc>${t(visual.description).replaceAll("'", '&#39;')}</desc>`));
      const section = attackSectionHTML('web', 2025, id, t);
      assert.match(section, /<pre><code>[^]*<mark>[^]+?<\/mark>[^]*<\/code><\/pre>/);
      assert.ok(section.includes(`<h2>${t('Ejemplo')}</h2>`));
      assert.ok(section.includes(t('Corrección:')));
      assert.ok(section.includes(t(visual.fix).replaceAll('"', '&quot;')));
      assert.match(source, new RegExp(`owasp.org/Top10/2025/${id}_2025-`));
    }

  }
});

test('Phosphor attribution and complete MIT license ship with the build', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = path => readFile(new URL(path, import.meta.url), 'utf8');
  assert.match(await read('../README.md'), /Phosphor Icons[^]*licencia MIT/);
  const note = await read('../LICENSES/third-party.md');
  for (const visual of Object.values(visuals.web[2025])) assert.ok(note.includes(`\`${visual.icon}\``));
  assert.match(note, /2b75f3ad12b420c9504ef05df8d2564a28f8500e/);
  const license = await read('../LICENSES/phosphor-icons-MIT.txt');
  assert.match(license, /Copyright \(c\) 2023 Phosphor Icons/);
  assert.match(license, /Permission is hereby granted, free of charge/);
  assert.equal(await read('../dist/LICENSES/phosphor-icons-MIT.txt'), license);
});

test('every pilot category prerenders accessible SVG and explanatory text before prevention in both languages', () => {
  const files = generateSeo();
  for (const language of ['en', 'es']) for (const { id } of pilot) {
    const html = files.get(pathFor({ family: 'web', year: 2025, id }, catalog, language).slice(1) + 'index.html');
    const article = html.match(/<article id="prerender">([^]*?)<\/article>/)[1];
    const t = text => translate(text, language);
    assert.equal((article.match(/role="img"/g) || []).length, 2);
    assert.ok(article.includes(`<desc>${t(getVisual('web', 2025, id).description).replaceAll("'", '&#39;')}</desc>`));
    assert.ok(article.indexOf(`<h2>${t('Cómo funciona el ataque')}</h2>`) < article.indexOf(`<h2>${t('Prevención')}</h2>`));
    assert.match(article, /<p class="attack-description">/);
    assert.match(article, /<pre><code>[^]*<mark>/);
    assert.ok(article.includes(t('Corrección:')));
    assert.ok(article.includes(t(getVisual('web', 2025, id).fix).replaceAll('"', '&quot;')));
    assert.ok(article.includes(pilot.find(item => item.id === id).source));
  }

});

test('Markdown embeds attack diagrams as data images without raw SVG markup', () => {
  for (const item of pilot) {
    const md = exportMarkdown(catalog.families.web, 2025, item, 'en');
    assert.match(md, /data:image\/svg\+xml;base64,/);
    assert.match(md, /How the attack works/);
    assert.doesNotMatch(md, /<svg|attack-diagram/);
  }
});

test('build compaction preserves every localized SVG byte for byte', async () => {
  const { readFile } = await import('node:fs/promises');
  const { compactJavaScript } = await import('../scripts/compact.js');
  const source = await readFile(new URL('../src/visuals.js', import.meta.url), 'utf8');
  const built = await import(`data:text/javascript;base64,${Buffer.from(compactJavaScript(source.replace('./icons.js', new URL('../src/icons.js', import.meta.url).href))).toString('base64')}`);
  for (const language of ['en', 'es']) for (const { id, name } of pilot) {
    const t = text => translate(text, language);
    assert.equal(built.iconSVG('web', 2025, id, name), iconSVG('web', 2025, id, name));
    assert.equal(built.attackSectionHTML('web', 2025, id, t), attackSectionHTML('web', 2025, id, t));
  }
});
