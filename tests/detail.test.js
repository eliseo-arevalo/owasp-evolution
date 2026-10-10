import test from 'node:test';
import assert from 'node:assert/strict';
import { catalog } from '../src/data.js';
import { getLineage } from '../src/model.js';
import { lineageEditions } from '../src/lineage.js';

test('edition groups retain every official lineage node and chronological years for Web and LLM', () => {
  for (const family of Object.values(catalog.families)) for (const edition of family.editions) for (const item of edition.items) {
    const selectedKey = `${edition.year}:${item.id}`;
    const lineage = getLineage(catalog, family.id, edition.year, item.id);
    const groups = lineageEditions(family, lineage, selectedKey);
    assert.deepEqual(groups.flatMap(group => group.nodes.map(node => node.key)), lineage.nodes.map(node => node.key));
    assert.deepEqual(groups.map(group => group.year), [...new Set(groups.map(group => group.year))].sort((a,b) => a-b));
    assert.equal(groups.flatMap(group => group.nodes).filter(node => node.selected).length, 1);
    for (const node of groups.flatMap(group => group.nodes)) {
      assert.equal(node.isNew, !lineage.edges.some(edge => edge.to === node.key));
      assert.equal(node.delta, node.previous ? node.previous.rank - node.rank : null);
    }
  }
});

test('A01 groups merged predecessors under 2017 and preserves movement and consolidation in 2025', () => {
  const family = catalog.families.web;
  const groups = lineageEditions(family, getLineage(catalog, 'web', 2025, 'A01'), '2025:A01');
  const merge = groups.find(group => group.year === 2017).nodes[0];
  assert.deepEqual(merge.merges.map(node => node.key), ['2013:A4', '2013:A7']);
  assert.equal(groups.find(group => group.year === 2021).nodes[0].delta, 4);
  assert.equal(groups.at(-1).nodes[0].delta, 0);
  assert.deepEqual(groups.at(-1).nodes[0].merges.map(node => node.key), ['2021:A10']);
});

test('A03 preserves renamed/expanded connections, rank gains and same-rank transitions', () => {
  const family = catalog.families.web;
  const nodes = lineageEditions(family, getLineage(catalog, 'web', 2025, 'A03'), '2025:A03').flatMap(group => group.nodes);
  assert.deepEqual(nodes.map(node => node.delta), [null, 0, 3, 3]);
  assert.deepEqual(nodes.map(node => node.relations), [[], ['continues'], ['renamed'], ['expanded']]);
  assert.deepEqual(nodes.at(-1).merges, []);
});

test('an isolated category records a new state and a departure in the following edition', () => {
  const family = catalog.families.web;
  const groups = lineageEditions(family, getLineage(catalog, 'web', 2013, 'A8'), '2013:A8');
  assert.equal(groups[0].nodes[0].isNew, true);
  assert.equal(groups.at(-1).year, 2017);
  assert.equal(groups.at(-1).departures[0].id, 'A8');
});
