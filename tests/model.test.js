import test from 'node:test';
import assert from 'node:assert/strict';

import { latestEdition, firstCategory } from '../src/editions.js';
import { catalog } from '../src/data.js';
import {
  flattenCatalog,
  searchRisks,
  getRisk,
  getLineage,
  parseRoute,
  formatRoute,
  resolveRouteState,
} from '../src/model.js';

test('every edition contains exactly ten uniquely identified categories', () => {
  for (const family of Object.values(catalog.families)) {
    for (const edition of family.editions) {
      assert.equal(edition.items.length, 10, `${family.id} ${edition.year}`);
      assert.equal(new Set(edition.items.map((item) => item.id)).size, 10);
    }
  }
});

test('all category sources are official OWASP URLs', () => {
  for (const risk of flattenCatalog(catalog)) {
    assert.match(new URL(risk.source).hostname, /(^|\.)owasp\.org$|(^|\.)github\.com$/);
  }
});

test('all ten LLM 2026 sources use rendered GitHub pages for their category', () => {
  const files = [
    'LLM01_PromptInjection',
    'LLM02_SensitiveInformationDisclosure',
    'LLM03_ExcessiveAgency',
    'LLM04_SupplyChain',
    'LLM05_DataModelPoisoning',
    'LLM06_UnboundedConsumption',
    'LLM07_Misinformation',
    'LLM08_HiddenContextExposure',
    'LLM09_VectorAndEmbeddingWeaknesses',
    'LLM10_ImproperOutputHandling',
  ];
  const edition = catalog.families.llm.editions.find(({ year }) => year === 2026);
  assert.deepEqual(edition.items.map(({ source }) => source), files.map(file =>
    `https://github.com/GenAI-Security-Project/GenAI-LLM-Top10/blob/main/2026/final/${file}.md`));
});

test('all lineage edges reference existing adjacent-edition categories', () => {
  for (const family of Object.values(catalog.families)) {
    const keys = new Set(flattenCatalog({ families: { [family.id]: family } }).map((item) => item.key));
    const editions = new Map(family.editions.map((edition, index) => [edition.year, index]));

    for (const edge of family.edges) {
      assert.ok(keys.has(edge.from), `missing source ${edge.from}`);
      assert.ok(keys.has(edge.to), `missing target ${edge.to}`);
      const fromYear = Number(edge.from.split(':')[0]);
      const toYear = Number(edge.to.split(':')[0]);
      assert.equal(editions.get(toYear), editions.get(fromYear) + 1, `${edge.from} → ${edge.to} must be adjacent`);
    }
  }
});

test('search is accent-insensitive and matches identifiers, names and Spanish summaries', () => {
  assert.ok(searchRisks(catalog, 'inyeccion').some((risk) => risk.name === 'Injection'));
  assert.ok(searchRisks(catalog, 'LLM01').some((risk) => risk.id === 'LLM01'));
  assert.ok(searchRisks(catalog, 'autorizacion').some((risk) => risk.name === 'Broken Access Control'));
});

test('risk lookup and lineage return the selected node plus connected history', () => {
  const risk = getRisk(catalog, 'web', 2025, 'A01');
  assert.equal(risk.name, 'Broken Access Control');
  const lineage = getLineage(catalog, 'web', 2025, 'A01');
  assert.ok(lineage.nodes.some((node) => node.year === 2021 && node.id === 'A01'));
  assert.ok(lineage.edges.every((edge) => lineage.nodes.some((node) => node.key === edge.from) && lineage.nodes.some((node) => node.key === edge.to)));
});

test('hash routes round-trip and reject unavailable entries with safe defaults', () => {
  const route = { family: 'llm', year: 2026, id: 'LLM03' };
  assert.deepEqual(parseRoute(formatRoute(route), catalog), route);
  assert.deepEqual(parseRoute('#/unknown/1900/nope', catalog), {
    family: catalog.defaultFamily,
    year: latestEdition(catalog.families[catalog.defaultFamily]).year,
    id: firstCategory(latestEdition(catalog.families[catalog.defaultFamily])).id,
  });
});

test('route state decodes segments and canonicalizes invalid hashes', () => {
  const encoded = resolveRouteState('#/web/2025/A%30%31', catalog);
  assert.deepEqual(encoded.route, { family: 'web', year: 2025, id: 'A01' });
  assert.equal(encoded.canonicalHash, '#/web/2025/A01');
  assert.equal(encoded.changed, true);

  const invalid = resolveRouteState('#/unknown/1900/nope', catalog);
  assert.equal(invalid.canonicalHash, formatRoute(invalid.route));
  assert.equal(invalid.changed, true);
});

 test('detail URLs round-trip for both families and preserve matrix routes', () => {
  for (const route of [{ family: 'web', year: 2025, id: 'A01' }, { family: 'llm', year: 2026, id: 'LLM03' }]) {
    const detail = { ...route, detail: true };
    const hash = `${formatRoute(route)}/detalle`;
    assert.equal(formatRoute(detail), hash);
    assert.deepEqual(parseRoute(hash, catalog), detail);
    assert.equal(resolveRouteState(hash, catalog).changed, false);
    assert.deepEqual(parseRoute(formatRoute(route), catalog), route);
  }
});
