import test from 'node:test';
import assert from 'node:assert/strict';
import { catalog } from '../src/data.js';
import {
  defaultVisibleYears,
  visibleEditions,
  visibleConnections,
  lineageKinds,
  primaryNeighbor,
  rowCues,
  lineagePath,
  formatLineagePath,
} from '../src/editions.js';
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

test('each lineage node takes the stroke of the connection that joins it to the path', () => {
  const family = catalog.families.web;
  const years = new Set(defaultVisibleYears(family));
  const lineage = getLineage(catalog, 'web', 2025, 'A01');
  const kinds = lineageKinds(visibleConnections(family, years, lineage.edges), '2025:A01');
  assert.deepEqual(Object.fromEntries(kinds), { '2021:A01': 'continues', '2021:A10': 'merged', '2017:A5': 'continues' });
  const injection = getLineage(catalog, 'web', 2021, 'A03');
  const fromInjection = lineageKinds(visibleConnections(family, years, injection.edges), '2021:A03');
  assert.equal(fromInjection.get('2017:A1'), 'continues');
  assert.equal(fromInjection.get('2017:A7'), 'merged');
  assert.ok(!fromInjection.has('2021:A03'));
});

test('left and right resolve the primary predecessor or successor across merges', () => {
  const family = catalog.families.web;
  const connections = visibleConnections(family, new Set(defaultVisibleYears(family)));
  assert.equal(primaryNeighbor(connections, '2021:A03', 'previous'), '2017:A1');
  assert.equal(primaryNeighbor(connections, '2025:A01', 'previous'), '2021:A01');
  assert.equal(primaryNeighbor(connections, '2017:A7', 'next'), '2021:A03');
  assert.equal(primaryNeighbor(connections, '2021:A04', 'previous'), null);
  assert.equal(primaryNeighbor(connections, '2025:A01', 'next'), null);
});

test('rows mark new and leaving categories and only hint at hidden predecessors', () => {
  const family = catalog.families.web;
  const cues = rowCues(family, new Set(defaultVisibleYears(family)));
  assert.equal(cues.get('2021:A04').isNew, true);
  assert.equal(cues.get('2017:A1').isNew, false);
  assert.equal(cues.get('2017:A1').hiddenBefore, 2013);
  assert.equal(cues.get('2017:A4').hiddenBefore, null);
  assert.equal(cues.get('2025:A01').hiddenBefore, null);
  assert.ok(!cues.has('2013:A8'));
  const withHistory = rowCues(family, new Set([2013, 2017, 2021, 2025]));
  assert.equal(withHistory.get('2013:A8').leaves, 2017);
  assert.equal(withHistory.get('2013:A1').isNew, false);
  assert.equal(withHistory.get('2025:A01').leaves, null);
  assert.equal(rowCues(family, new Set([2017, 2021])).get('2021:A01').hiddenAfter, 2025);
});

test('the lineage path lists visible years and counts hidden ones', () => {
  const family = catalog.families.web;
  const years = new Set(defaultVisibleYears(family));
  const lineage = getLineage(catalog, 'web', 2017, 'A5');
  assert.deepEqual(formatLineagePath(lineagePath(lineage.nodes, years)), {
    route: '2017 A5 → 2021 A01 + A10 → 2025 A01',
    hidden: ['+2 en 2013'],
  });
  assert.deepEqual(formatLineagePath(lineagePath(lineage.nodes, years), 'in').hidden, ['+2 in 2013']);
  const single = getLineage(catalog, 'web', 2025, 'A10');
  assert.deepEqual(formatLineagePath(lineagePath(single.nodes, years)), { route: '2025 A10', hidden: [] });
});

