import test from 'node:test';
import assert from 'node:assert/strict';
import { catalog } from '../src/data.js';
import { defaultVisibleYears, visibleEditions, visibleConnections } from '../src/editions.js';
import { getLineage } from '../src/model.js';

test('Web defaults hide only 2013 and new editions automatically enter the filter', () => {
  const family = catalog.families.web;
  assert.deepEqual(defaultVisibleYears(family), [2017, 2021, 2025]);
  assert.deepEqual(defaultVisibleYears({ ...family, editions: [...family.editions, { year: 2029 }] }), [2017, 2021, 2025, 2029]);
  assert.deepEqual(visibleEditions(family, new Set([2013, 2025])).map((e) => e.year), [2013, 2025]);
  assert.ok(!family.editions.some((e) => e.year === 2010));
});

test('all visible connections survive selection, with only the selected lineage highlighted', () => {
  const family = catalog.families.web;
  const years = new Set(defaultVisibleYears(family));
  const expected = family.edges.filter((e) => years.has(Number(e.from.split(':')[0])) && years.has(Number(e.to.split(':')[0])));
  for (const id of ['A01', 'A05', 'A10']) {
    const lineage = getLineage(catalog, 'web', 2025, id);
    const edges = visibleConnections(family, years, lineage.edges);
    assert.equal(edges.length, expected.length);
    assert.ok(edges.some((e) => !e.highlighted));
    assert.equal(edges.filter((e) => e.highlighted).length, lineage.edges.filter((e) => expected.includes(e)).length);
  }
});

test('hidden intermediate editions preserve documented paths and isolated years have no connectors', () => {
  const family = catalog.families.web;
  const lineage = getLineage(catalog, 'web', 2025, 'A05');
  const edges = visibleConnections(family, new Set([2017, 2025]), lineage.edges);
  assert.ok(edges.some((e) => e.from === '2017:A1' && e.to === '2025:A05' && e.highlighted));
  assert.ok(edges.every((e) => e.from.startsWith('2017:') && e.to.startsWith('2025:')));
  assert.deepEqual(visibleConnections(family, new Set([2025]), lineage.edges), []);
});
