import test from 'node:test';
import assert from 'node:assert/strict';
import { exportFilename, exportRows, exportCSV, exportJSON, exportMarkdown } from '../src/export.js';
import { catalog } from '../src/data.js';
const family = catalog.families.web;
test('export filename sorts years and identifies family and format', () => {
  assert.equal(exportFilename('web', [2025, 2017, 2021], 'png'), 'owasp-evolution-web-2017-2021-2025.png');
  assert.equal(exportFilename('llm', new Set([2025]), 'json'), 'owasp-evolution-llm-2025.json');
});
test('JSON exports only visible years with the agreed schema and links', () => {
  const rows = JSON.parse(exportJSON(family, [2017, 2021]));
  assert.equal(rows.length, 20);
  assert.deepEqual(Object.keys(rows[0]), ['family', 'year', 'code', 'name', 'position', 'lineage_type', 'linked_to']);
  assert.ok(rows.every((row) => [2017, 2021].includes(row.year)));
  assert.ok(rows.some((row) => row.linked_to && row.lineage_type));
  assert.ok(rows.every((row) => !row.linked_to.includes('2025:') && !row.linked_to.includes('2013:')));
  assert.deepEqual(exportRows(family, []), []);
});
test('CSV escapes quotes, commas and newlines', () => {
  const sample = { id: 'web', edges: [], editions: [{ year: 2025, items: [{ id: 'A01', rank: 1, name: 'Name, "quoted"\nnext' }] }] };
  assert.equal(exportCSV(sample, [2025]), 'family,year,code,name,position,lineage_type,linked_to\r\n"web","2025","A01","Name, ""quoted""\nnext","1","",""\r\n');
});
test('Markdown includes selected detail, prevention, relationships and source in both languages', () => {
  const item = family.editions.find((edition) => edition.year === 2021).items[0];
  const es = exportMarkdown(family, 2021, item, 'es');
  assert.ok(es.includes(item.summary));
  assert.ok(es.includes(item.source));
  assert.ok(es.includes('## Prevención prioritaria'));
  assert.ok(es.includes('2017:'));
  assert.ok(exportMarkdown(family, 2021, item, 'en').includes('## Priority prevention'));
  assert.throws(() => exportMarkdown(family, 2021, null, 'es'));
});
