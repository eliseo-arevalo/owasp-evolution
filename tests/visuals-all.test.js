import test from 'node:test';
import assert from 'node:assert/strict';
import { catalog } from '../src/data.js';
import { getVisual, iconSVG, diagramSVG, attackSectionHTML } from '../src/visuals.js';
import { hasIcon } from '../src/icons.js';
import { translate } from '../src/i18n.js';
import { generateSeo } from '../scripts/seo.js';
import { pathFor } from '../src/routes.js';

const entries = Object.values(catalog.families).flatMap(family => family.editions.flatMap(edition => edition.items.map(item => ({family: family.id, year: edition.year, ...item}))));
test('100% catalog coverage, one unique layout per concept and fully bilingual accessible examples', () => {
  const layouts = new Map(), concepts = new Map();
  assert.equal(entries.length, 60);
  for (const {family, year, id} of entries) {
    const v = getVisual(family, year, id), key = `${family}/${year}/${id}`;
    assert.ok(v, key);
    assert.ok(v.concept && v.layout && v.icon && v.accent, key);
    if (layouts.has(v.layout)) assert.equal(layouts.get(v.layout), v.concept, key);
    if (concepts.has(v.concept)) assert.equal(concepts.get(v.concept), v.layout, key);
    layouts.set(v.layout, v.concept); concepts.set(v.concept, v.layout);
    assert.ok(hasIcon(v.icon), key);
    assert.match(iconSVG(family, year, id, id), /icon-secondary/);
    assert.ok(v.example.split('\n').length <= 4, key);
    assert.match(v.example, /\[\[[^]+?\]\]/, key);
    assert.notEqual(translate(v.description, 'en'), v.description, key);
    assert.notEqual(translate(v.fix, 'en'), v.fix, key);
    for (const language of ['en', 'es']) {
      const t = x => translate(x, language);
      const svg = diagramSVG(family, year, id, t);
      assert.match(svg, /<title>[^]+?<\/title><desc>[^]+?<\/desc>/, key);
      assert.match(svg, /class="attack-node"/, key);
      assert.doesNotMatch(svg, /undefined|NaN/);
      const section = attackSectionHTML(family, year, id, t);
      assert.match(section, /<pre><code>[^]+?<mark>[^]+?<\/mark>[^]*?<\/code><\/pre>/, key);
    }

  }
  assert.equal(concepts.size, 30);
});
test('all 120 canonical category pages prerender icon, diagram, example, fix and six navigable sections', () => {
  const files = generateSeo();
  for (const language of ['en', 'es']) for (const {family, year, id} of entries) {
    const html = files.get(pathFor({family, year, id}, catalog, language).slice(1) + 'index.html');
    const article = html.match(/<article id="prerender">([^]*?)<\/article>/)[1];
    assert.match(article, /class="risk-icon /);
    assert.match(article, /class="attack-diagram /);
    assert.match(article, /<pre><code>/);
    assert.match(article, /class="attack-fix"/);
    for (const section of ['overview','attack','example','prevention','lineage','sources']) assert.ok(article.includes(`href="#detail-${section}"`));
  }
});
