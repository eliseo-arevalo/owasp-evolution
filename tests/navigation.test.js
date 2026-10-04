import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { formatRoute } from '../src/model.js';

const app = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');
const navigation = app.slice(app.indexOf('function navigate('), app.indexOf('function renderFamilyNav('));
function setup() {
  let renders = 0;
  let backs = 0;
  const context = vm.createContext({
    location: { hash: '#/llm/2026/LLM03' },
    currentRoute: { family: 'llm', year: 2026, id: 'LLM03' },
    matrixReturnHash: null,
    window: { scrollY: 230 }, elements: { openDetailButton: {} }, formatRoute,
    render: () => renders++,
    history: {
      state: null,
      pushState(state, _, hash) { this.state = state; context.location.hash = hash; },
      back() { backs++; },
      replaceState(state, _, hash) { this.state = state; context.location.hash = hash; },
    },
  });
  vm.runInContext(navigation, context);
  return { context, renders: () => renders, backs: () => backs };
}

test('single row selection navigates to a matrix route', () => {
  const { context } = setup();
  vm.runInContext("navigate({family: 'web', year: 2025, id: 'A02'});", context);
  assert.equal(context.location.hash, '#/web/2025/A02');
});

test('opening the modal saves the matrix hash; returning uses history', () => {
  const { context, renders, backs } = setup();
  vm.runInContext('openDetail();', context);
  assert.equal(context.location.hash, '#/llm/2026/LLM03/detalle');
  assert.equal(context.matrixReturnHash, '#/llm/2026/LLM03');
  assert.equal(renders(), 1);
  vm.runInContext('returnToMatrix();', context);
  assert.equal(backs(), 1);
});

test('shared detail links return to their category without going to another website', () => {
  const { context, backs } = setup();
  context.currentRoute.detail = true;
  context.location.hash += '/detalle';
  vm.runInContext('returnToMatrix();', context);
  assert.equal(context.location.hash, '#/llm/2026/LLM03');
  assert.equal(backs(), 0);
});

test('only explicit detail buttons open the modal; no double click or side panel', () => {
  assert.match(app, /detail.addEventListener\('click', openDetail/);
  assert.match(app, /elements.openDetailButton.addEventListener\('click', \(\) => openDetail/);
  assert.doesNotMatch(app, /dblclick|setInspectorOpen/);
  assert.match(app, /if \(signature !== matrixSignature\)/);
});


test('modal closes with Back, Escape and backdrop, and restores row focus', () => {
  assert.match(app, /close.addEventListener\('click', returnToMatrix\)/);
  assert.match(app, /detailModal.addEventListener\('cancel'/);
  assert.match(app, /event.preventDefault\(\);\s*returnToMatrix\(\)/);
  assert.match(app, /event.key === 'Escape'[\s\S]*?returnToMatrix\(\)/);
  assert.match(app, /event.target === elements.detailModal/);
  assert.match(app, /event.clientX < bounds.left/);
  assert.match(app, /event.clientY > bounds.bottom/);
  assert.match(app, /const resolveDetailReturn = .*is-selected .risk-focus/);
  assert.match(app, /elements.detailModal.close\(\);\s*scheduleFocus\(resolveDetailReturn\)/);
  assert.doesNotMatch(app, /matrixPage.hidden = detail|window.scrollTo/);
});


test('rendering a shared detail keeps the matrix and years, then closes to the selected row', () => {
  const row = {};
  const calls = [];
  const years = new Set([2021, 2025]);
  const context = vm.createContext({
    location: { hash: '#/web/2025/A01/detalle' },
    resolveRouteState: () => ({ route: { family: 'web', year: 2025, id: 'A01', detail: true } }),
    currentRoute: null, catalog: { families: { web: { id: 'web', description: '', label: '' } } },
    yearFilters: new Map([['web', years]]),
    getRisk: () => ({ id: 'A01', name: 'Access control' }),
    getLineage: () => ({ nodes: [] }),
    applyStaticLanguage() {}, language: 'es', matrixSignature: '', structureSignature: '', wasDetail: false,
    document: { querySelector: () => ({}), body: { classList: { toggle() {} } } },
    elements: {
      matrixPage: { hidden: false },
      detailModal: { showModal: () => calls.push('open'), close: () => calls.push('close') },
      detailPage: { querySelector: () => ({}) },
      familyDescription: {}, timelineTitle: {}, timelineHelp: {}, detailTriggerLabel: {},
    },
    renderFamilyNav() {}, renderEditionFilter() {}, visibleEditions: () => [2021, 2025],
    renderTimeline: () => calls.push('matrix'), renderDetail: () => calls.push('detail'),
    renderLineageSummary() {}, applySelection() {},
    scheduleFocus: (resolve) => calls.push(resolve() === row ? 'row focus' : 'modal focus'),
    resolveDetailReturn: () => row, scheduleConnections() {},
  });
  const renderSource = app.slice(app.indexOf('function render()'), app.indexOf("elements.detailModal.addEventListener('cancel'"));
  vm.runInContext(renderSource + '\nrender();', context);
  assert.deepEqual(calls, ['matrix', 'detail', 'open', 'modal focus']);
  assert.equal(context.elements.matrixPage.hidden, false);
  assert.deepEqual([...years], [2021, 2025]);
  context.resolveRouteState = () => ({ route: { family: 'web', year: 2025, id: 'A01' } });
  vm.runInContext('render();', context);
  assert.deepEqual(calls.slice(-2), ['close', 'row focus']);
  assert.equal(calls.filter((call) => call === 'matrix').length, 1);
  assert.deepEqual([...years], [2021, 2025]);
});

test('selecting another row keeps the matrix and only moves the selection', () => {
  const calls = [];
  let route = { family: 'web', year: 2025, id: 'A01' };
  const context = vm.createContext({
    location: { hash: '' },
    resolveRouteState: () => ({ route }),
    currentRoute: null, catalog: { families: { web: { id: 'web', description: '', label: '' } } },
    yearFilters: new Map([['web', new Set([2025])]]),
    getRisk: () => ({ id: route.id, name: '' }),
    getLineage: () => ({ nodes: [] }),
    applyStaticLanguage() {}, language: 'es', matrixSignature: '', structureSignature: '', wasDetail: false,
    document: { querySelector: () => ({}), body: { classList: { toggle() {} } } },
    elements: { detailTriggerLabel: {}, familyDescription: {}, timelineTitle: {} },
    renderFamilyNav() {}, renderEditionFilter() {},
    renderTimeline: () => calls.push('matrix'), renderLineageSummary: () => calls.push('path'),
    applySelection: (key) => calls.push(`select ${key}`),
  });
  const renderSource = app.slice(app.indexOf('function render()'), app.indexOf("elements.detailModal.addEventListener('cancel'"));
  vm.runInContext(renderSource + '\nrender();', context);
  route = { family: 'web', year: 2025, id: 'A05' };
  vm.runInContext('render();', context);
  assert.deepEqual(calls, ['matrix', 'path', 'select 2025:A01', 'path', 'select 2025:A05']);
});

test('hover and focus preview without navigating; arrows move between rows', () => {
  const preview = app.slice(app.indexOf("addEventListener('pointerover'"), app.indexOf("window.addEventListener('hashchange'"));
  assert.doesNotMatch(preview, /navigate\(|location\.hash|history\./);
  assert.match(app, /applyEmphasis\(hoverKey \?\? focusKey \?\? selectedKey\)/);
  for (const key of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) assert.match(app, new RegExp(`'${key}'`));
  assert.match(app, /primaryNeighbor\(activeEdges, card\.dataset\.key/);
  assert.match(app, /button\.addEventListener\('click', \(\) => navigate\(/);
});

test('row tooltips start with the full official name and the counter never says nodes', () => {
  assert.match(app, /button\.title = \[risk\.name,/);
  assert.doesNotMatch(app, /nodos|lineage nodes/);
});

