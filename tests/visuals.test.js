import test from 'node:test';
import assert from 'node:assert/strict';
import { visuals, getVisual, iconSVG, diagramSVG, attackSectionHTML } from '../src/visuals.js';
import { catalog } from '../src/data.js';
import { translate } from '../src/i18n.js';
import { generateSeo } from '../scripts/seo.js';
import { pathFor } from '../src/routes.js';
import { exportMarkdown } from '../src/export.js';

const pilot = catalog.families.web.editions.find(edition => edition.year === 2025).items;
test('every Web 2025 category has a unique consistent hand-authored glyph and four-node attack', () => {
  assert.deepEqual(Object.keys(visuals.web[2025]), pilot.map(item => item.id));
  assert.equal(new Set(pilot.map(item => getVisual('web', 2025, item.id).glyph)).size, 10);
  for (const { id, name } of pilot) {
    const visual = getVisual('web', 2025, id);
    assert.equal(visual.nodes.length, 4);
    const icon = iconSVG('web', 2025, id, name);
    assert.match(icon, /viewBox="0 0 24 24"/);
    assert.match(icon, /stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/);
    assert.match(icon, /role="img"/);
    assert.ok(icon.includes(`<title>${name.replaceAll('&', '&amp;')}</title>`));
    assert.match(iconSVG('web', 2025, id), /aria-hidden="true"/);
    assert.doesNotMatch(icon, /#[0-9a-f]{3,8}\b/i);
  }
});

test('all diagram labels, roles, titles and accessible descriptions translate to English', () => {
  for (const { id } of pilot) {
    const visual = getVisual('web', 2025, id);
    for (const text of [...visual.nodes, visual.description, 'Entrada', 'Fallo', 'Impacto']) {
      assert.notEqual(translate(text, 'en'), text, `${id}: missing English for ${text}`);
    }
    for (const language of ['en', 'es']) {
      const t = text => translate(text, language);
      const svg = diagramSVG('web', 2025, id, t);
      assert.match(svg, /role="img"/);
      assert.match(svg, /viewBox="0 0 320 160"/);
      assert.ok(svg.includes(`<title>${id} · ${t('Cómo funciona el ataque')}</title>`));
      assert.ok(svg.includes(`<desc>${t(visual.description)}</desc>`));
      assert.equal((svg.match(/class="attack-node"/g) || []).length, 4);
      assert.equal((svg.match(/class="attack-path"/g) || []).length, 3);
      for (const label of visual.nodes) assert.ok(svg.includes(t(label)));
    }
  }
});

test('every pilot category prerenders accessible SVG and explanatory text before prevention in both languages', () => {
  const files = generateSeo();
  for (const language of ['en', 'es']) for (const { id } of pilot) {
    const html = files.get(pathFor({ family: 'web', year: 2025, id }, catalog, language).slice(1) + 'index.html');
    const article = html.match(/<article id="prerender">([^]*?)<\/article>/)[1];
    const t = text => translate(text, language);
    assert.equal((article.match(/<svg /g) || []).length, 2);
    assert.ok(article.includes(`<desc>${t(getVisual('web', 2025, id).description)}</desc>`));
    assert.ok(article.indexOf(t('Cómo funciona el ataque')) < article.indexOf(t('Prevención prioritaria')));
    assert.match(article, /<p class="attack-description">/);
  }
  for (const family of Object.values(catalog.families)) for (const edition of family.editions) {
    if (family.id === 'web' && edition.year === 2025) continue;
    for (const { id } of edition.items) {
      assert.equal(getVisual(family.id, edition.year, id), undefined);
      assert.equal(iconSVG(family.id, edition.year, id), '');
      assert.equal(diagramSVG(family.id, edition.year, id), '');
      assert.equal(attackSectionHTML(family.id, edition.year, id), '');
      assert.doesNotMatch(files.get(pathFor({ family: family.id, year: edition.year, id }, catalog).slice(1) + 'index.html'), /attack-diagram|risk-icon/);
    }
  }
});

test('Markdown export remains textual without diagram or icon markup', () => {
  for (const item of pilot) assert.doesNotMatch(exportMarkdown(catalog.families.web, 2025, item, 'en'), /<svg|attack-diagram|How the attack works/);
});

test('build compaction preserves every localized SVG byte for byte', async () => {
  const { readFile } = await import('node:fs/promises');
  const { compactJavaScript } = await import('../scripts/compact.js');
  const source = await readFile(new URL('../src/visuals.js', import.meta.url), 'utf8');
  const built = await import(`data:text/javascript;base64,${Buffer.from(compactJavaScript(source)).toString('base64')}`);
  for (const language of ['en', 'es']) for (const { id, name } of pilot) {
    const t = text => translate(text, language);
    assert.equal(built.iconSVG('web', 2025, id, name), iconSVG('web', 2025, id, name));
    assert.equal(built.attackSectionHTML('web', 2025, id, t), attackSectionHTML('web', 2025, id, t));
  }
});
