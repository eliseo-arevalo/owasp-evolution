import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const app = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');

test('connector preview restores selection, ignores touch, and clicks commit once', () => {
  const handlers = new Map();
  const calls = [];
  const context = vm.createContext({
    hit: { addEventListener: (type, fn) => handlers.set(type, fn) },
    hoverKey: null, selectedKey: '2025:A01',
    edge: { to: '2021:A03' }, currentRoute: { family: 'web' },
    yearOf: () => 2021, idOf: () => 'A03',
    updateEmphasis: () => calls.push(context.hoverKey ?? context.selectedKey),
    navigate: (route) => calls.push(`${route.year}:${route.id}`),
    openDetail: () => calls.push(`detail ${context.currentRoute.year}:${context.currentRoute.id}`),
  });
  const start = app.indexOf("      hit.addEventListener('pointerenter'");
  vm.runInContext(app.slice(start, app.indexOf("\n    }", start)), context);
  handlers.get('pointerenter')({ pointerType: 'mouse' });
  handlers.get('pointerleave')();
  handlers.get('pointerenter')({ pointerType: 'touch' });
  assert.deepEqual(calls, ['2021:A03', '2025:A01']);
  handlers.get('click')({ detail: 1 });
  handlers.get('click')({ detail: 2 });
  handlers.get('dblclick')();
  assert.deepEqual(calls.slice(2), ['2021:A03', 'detail 2021:A03']);
});

test('hit strokes remain solid, wide, unmasked, and geometry follows visible paths', async () => {
  const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
  const hit = css.match(/\.connector-layer > \.connector-hit \{([^}]+)\}/)[1];
  assert.match(hit, /stroke-width: 12/);
  assert.match(hit, /stroke: transparent/);
  assert.match(hit, /pointer-events: stroke/);
  assert.doesNotMatch(hit, /dasharray|opacity|transition/);
  assert.match(app, /path.hitArea.setAttribute\('d', d\)/);
  assert.match(app, /stale.hitArea.remove\(\)/);
  assert.match(css, /\.timeline-grid \{\s*pointer-events: none/);
  assert.match(css, /\.edition-column \{\s*pointer-events: auto/);
});

test('connector endpoint emphasis includes every lineage year and segment', async () => {
  const { catalog } = await import('../src/data.js');
  const { getLineage } = await import('../src/model.js');
  const { visibleConnections, lineageKinds, yearOf, idOf } = await import('../src/editions.js');
  const family = catalog.families.web;
  const years = new Set([2017, 2021, 2025]);
  const classes = () => ({ values: new Set(), toggle(name, on) { if (on) this.values.add(name); else this.values.delete(name); } });
  const cards = family.editions.filter(e => years.has(e.year)).flatMap(e => e.items.map(item => ({
    dataset: { key: `${e.year}:${item.id}` }, classList: classes(), style: { setProperty() {}, removeProperty() {} },
  })));
  const paths = visibleConnections(family, years).map(edge => ({ dataset: { edge: `${edge.from}>${edge.to}` }, classList: classes() }));
  const context = vm.createContext({
    catalog, currentRoute: { family: 'web' }, yearFilters: new Map([['web', years]]),
    getLineage, visibleConnections, lineageKinds, yearOf, idOf,
    edgeKey: edge => `${edge.from}>${edge.to}`, selectedKey: '2025:A01',
    connectorPaths: () => paths, stopReveal() {},
    elements: { timelineStage: { classList: classes() }, timelineGrid: { querySelectorAll: () => cards } },
  });
  vm.runInContext(app.slice(app.indexOf('function applyEmphasis('), app.indexOf('// Lineage rows settle')), context);
  vm.runInContext("applyEmphasis('2021:A02', 'preview');", context);
  assert.deepEqual(cards.filter(c => c.classList.values.has('is-anchor') || c.classList.values.has('is-related')).map(c => c.dataset.key).sort(), ['2017:A3', '2021:A02', '2025:A04']);
  assert.deepEqual(paths.filter(p => p.classList.values.has('is-highlighted')).map(p => p.dataset.edge).sort(), ['2017:A3>2021:A02', '2021:A02>2025:A04']);
  assert.ok(cards.some(c => c.classList.values.has('is-dimmed')));
});
