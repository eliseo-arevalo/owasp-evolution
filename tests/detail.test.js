import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { catalog } from '../src/data.js';
import { getEdition, getLineage, getRisk, relationshipLabel } from '../src/model.js';
import { relationKind, rowCues } from '../src/editions.js';

const app = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');
const source = app.slice(app.indexOf('function renderDetail('), app.indexOf('function scheduleConnections('));
function node(tag, className = '', text = '') {
  return {
    tag, className, text, children: [], attributes: {},
    classList: { add(value) { className += ` ${value}`; }, contains(value) { return className.split(' ').includes(value); } },
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = children; },
    setAttribute(key, value) { this.attributes[key] = value; },
    addEventListener() {},
  };
}
const flatten = (entry) => [entry, ...entry.children.flatMap(flatten)];

test('detail retains every official lineage title, including isolated categories, and marks hidden years and relation strokes', () => {
  const detailPage = node('article');
  const context = { node, catalog, getEdition, relationshipLabel, relationKind, rowCues,
    t: (text) => text, returnToMatrix() {}, elements: { detailPage },
    document: { createTextNode: (text) => node('text', '', text) },
    yearFilters: new Map(),
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  for (const family of Object.values(catalog.families)) {
    context.yearFilters.set(family.id, new Set([family.editions.at(-1).year]));
    for (const edition of family.editions) for (const item of edition.items) {
      const risk = { ...getRisk(catalog, family.id, edition.year, item.id), year: edition.year, key: `${edition.year}:${item.id}` };
      const lineage = getLineage(catalog, family.id, edition.year, item.id);
      context.renderDetail(family, risk, lineage);
      assert.deepEqual(detailPage.children.map((entry) => entry.className), ['detail-header', 'detail-body']);
      const all = flatten(detailPage);
      const rows = all.filter((entry) => entry.className === 'lineage-item');
      assert.equal(rows.length, lineage.nodes.length);
      rows.forEach((row, index) => {
        const item = lineage.nodes[index];
        assert.equal(row.classList.contains('is-hidden-year'), item.year !== family.editions.at(-1).year);
        assert.ok(flatten(row).some((entry) => entry.text === ` · ${item.name}`));
        for (const edge of lineage.edges.filter((edge) => edge.to === item.key)) {
          assert.ok(flatten(row).some((entry) => entry.className === `legend-line line-${relationKind(edge.type)}`));
        }
      });
      const link = all.find((entry) => entry.className === 'source-link');
      assert.equal(link.href, risk.source);
      assert.equal(link.rel, 'noopener noreferrer');
    }
  }
});
