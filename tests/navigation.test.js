import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { pathFor } from '../src/routes.js';
import { catalog } from '../src/data.js';
import { formatRoute } from '../src/model.js';

const app = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');
const navigation = app.slice(app.indexOf('function navigate('), app.indexOf('function renderFamilyNav('));
function setup() {
  let renders = 0;
  let backs = 0;
  const context = vm.createContext({
    location: { hash: '#/llm/2026/LLM03' },
    currentRoute: { family: 'llm', year: 2026, id: 'LLM03' },
    matrixReturnHash: null, pathFor, catalog, language: 'es',
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
  assert.equal(context.location.hash, pathFor({family:'web',year:2025,id:'A02'},catalog,'es'));
});

test('opening the modal saves the matrix hash; returning uses history', () => {
  const { context, renders, backs } = setup();
  vm.runInContext('openDetail();', context);
  assert.equal(context.location.hash, pathFor(context.currentRoute,catalog,'es'));
  assert.equal(context.matrixReturnHash, '/es/genai/');
  assert.equal(renders(), 1);
  vm.runInContext('returnToMatrix();', context);
  assert.equal(backs(), 1);
});

test('shared detail links return to their category without going to another website', () => {
  const { context, backs } = setup();
  context.currentRoute.detail = true;
  context.location.hash += '/detalle';
  vm.runInContext('returnToMatrix();', context);
  assert.equal(context.location.hash, '/es/genai/');
  assert.equal(backs(), 0);
});

test('detail buttons and row double click open the modal', () => {
  assert.match(app, /detail.addEventListener\('click', openDetail/);
  assert.match(app, /button.addEventListener\('dblclick', openDetail\)/);
  assert.match(app, /if \(event.detail > 1\) return/);
  assert.doesNotMatch(app, /setInspectorOpen/);
  assert.match(app, /if \(signature !== matrixSignature\)/);
});


test('docked detail closes with Back and Escape, and restores row focus', () => {
  assert.match(app, /actionButton\('close', 'x', 'Cerrar detalle', 'Esc', returnToMatrix\)/);
  assert.match(app, /detailModal.addEventListener\('cancel'/);
  assert.match(app, /if \(fullscreen\) toggleFullscreen\(\);\s*else returnToMatrix\(\)/);
  assert.match(app, /command === 'escape'[\s\S]*?returnToMatrix\(\)/);
  assert.match(app, /const resolveDetailReturn = .*is-selected .risk-focus/);
  assert.match(app, /dismissModal\(\(\) => \{\s*scheduleFocus\(resolveDetailReturn\)/);
  assert.match(app, /modal\.close\(\);\s*done\(\);/);
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
    applyStaticLanguage() {}, language: 'es', matrixSignature: '', structureSignature: '', wasDetail: false, detailSignature: '', fullscreen: false, reducedMotion: () => true,
    syncThemeLabel() {}, updateEmphasis() {}, t: text => text,
    document: { querySelectorAll: () => [], querySelector: () => ({}), body: { classList: { toggle() {} } } },
    elements: {
      search: { setAttribute() {} },
      matrixPage: { hidden: false },
      detailModal: { show: () => calls.push('open') },
      detailPage: { contains: () => false, querySelector: () => ({}) },
      familyDescription: {}, timelineTitle: {}, timelineHelp: {}, detailTriggerLabel: {},
    },
    captureFamily() { return {}; }, crossfadeFamily() {}, renderFamilyNav() {}, renderEditionFilter() {}, visibleEditions: () => [2021, 2025],
    renderTimeline: () => calls.push('matrix'), renderDetail: () => calls.push('detail'),
    renderLineageSummary() {}, applySelection() {},
    scheduleFocus: (resolve) => calls.push(resolve() === row ? 'row focus' : 'modal focus'),
    resolveDetailReturn: () => row, scheduleConnections() {},
    shell: { classList: { add() {} } }, updateDock() {}, followDockLayout() {},
    keepModal() {}, dismissModal: (done) => { calls.push('close'); done(); },
  });
  const renderSource = app.slice(app.indexOf('function render()'), app.indexOf("elements.detailModal.addEventListener('cancel'"));
  Object.assign(context, { updateMetadata() {}, languageOf: () => context.language, localizeCatalog: () => context.catalog, sourceCatalog: {}, routeFrom: () => context.resolveRouteState().route, history: { state: null, replaceState() {} }, pathFor: () => '/' });
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
    applyStaticLanguage() {}, language: 'es', matrixSignature: '', structureSignature: '', wasDetail: false, detailSignature: '', fullscreen: false, reducedMotion: () => true,
    syncThemeLabel() {}, updateEmphasis() {}, t: text => text,
    document: { querySelectorAll: () => [], querySelector: () => ({}), body: { classList: { toggle() {} } } },
    elements: { search: { setAttribute() {} }, detailTriggerLabel: {}, familyDescription: {}, timelineTitle: {} },
    captureFamily() { return {}; }, crossfadeFamily() {}, renderFamilyNav() {}, renderEditionFilter() {},
    renderTimeline: () => calls.push('matrix'), renderLineageSummary: () => calls.push('path'),
    applySelection: (key) => calls.push(`select ${key}`),
  });
  const renderSource = app.slice(app.indexOf('function render()'), app.indexOf("elements.detailModal.addEventListener('cancel'"));
  Object.assign(context, { updateMetadata() {}, languageOf: () => context.language, localizeCatalog: () => context.catalog, sourceCatalog: {}, routeFrom: () => context.resolveRouteState().route, history: { state: null, replaceState() {} }, pathFor: () => '/' });
  vm.runInContext(renderSource + '\nrender();', context);
  route = { family: 'web', year: 2025, id: 'A05' };
  vm.runInContext('render();', context);
  assert.deepEqual(calls, ['matrix', 'select 2025:A01', 'select 2025:A05']);
});

test('hover and focus preview without navigating; arrows move between rows', () => {
  const preview = app.slice(app.indexOf("addEventListener('pointerover'"), app.indexOf("window.addEventListener('hashchange'"));
  assert.doesNotMatch(preview, /navigate\(|location\.hash|history\./);
  assert.match(app, /const emphasisKey = \(\) => currentRoute.detail \? selectedKey : hoverKey \?\? focusKey \?\? selectedKey/);
  assert.match(app, /applyEmphasis\(emphasisKey\(\), mode\)/);
  for (const key of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) assert.match(app, new RegExp(`'${key}'`));
  assert.match(app, /primaryNeighbor\(activeEdges, card\.dataset\.key/);
  assert.match(app, /button\.addEventListener\('click', \(event\) =>/);
});

test('row tooltips start with the full official name and the counter never says nodes', () => {
  assert.match(app, /button\.title = \[risk\.name,/);
  assert.doesNotMatch(app, /nodos|lineage nodes/);
});

function renderHarness(route) {
  const calls = [];
  const context = vm.createContext({
    location: { hash: '' },
    resolveRouteState: () => ({ route: route() }),
    currentRoute: null, catalog: { families: { web: { id: 'web', description: '', label: '' }, llm: { id: 'llm', description: '', label: '' } } },
    yearFilters: new Map([['web', new Set([2021, 2025])], ['llm', new Set([2025])]]),
    getRisk: () => ({ id: route().id, name: '' }),
    getLineage: () => ({ nodes: [] }),
    applyStaticLanguage() {}, language: 'es', matrixSignature: '', structureSignature: '', wasDetail: false, detailSignature: '', fullscreen: false, reducedMotion: () => true,
    syncThemeLabel() {}, updateEmphasis() {}, t: text => text,
    document: { querySelectorAll: () => [], querySelector: () => ({}), body: { classList: { toggle() {} } } },
    elements: { search: { setAttribute() {} }, detailTriggerLabel: {}, familyDescription: {}, timelineTitle: {} },
    captureFamily() { return {}; }, crossfadeFamily() {}, renderFamilyNav() {}, renderEditionFilter() {}, renderLineageSummary() {},
    renderTimeline: (family, ease) => calls.push(`matrix ${family.id} ease=${ease}`),
    applySelection: (key, { motion }) => calls.push(`select ${key} motion=${motion}`),
  });
  const renderSource = app.slice(app.indexOf('function render()'), app.indexOf("elements.detailModal.addEventListener('cancel'"));
  Object.assign(context, { updateMetadata() {}, languageOf: () => context.language, localizeCatalog: () => context.catalog, sourceCatalog: {}, routeFrom: () => context.resolveRouteState().route, history: { state: null, replaceState() {} }, pathFor: () => '/' });
  vm.runInContext(renderSource, context);
  return { context, calls };
}

test('changing visible years eases the layout and skips the commit draw; other changes do not ease', () => {
  let route = { family: 'web', year: 2025, id: 'A01' };
  const { context, calls } = renderHarness(() => route);
  vm.runInContext('render();', context);
  context.yearFilters.get('web').add(2017);
  vm.runInContext('render();', context);
  route = { family: 'web', year: 2025, id: 'A05' };
  vm.runInContext('render();', context);
  route = { family: 'llm', year: 2025, id: 'LLM01' };
  vm.runInContext('render();', context);
  context.language = 'en';
  vm.runInContext('render();', context);
  assert.deepEqual(calls, [
    'matrix web ease=false', 'select 2025:A01 motion=true',
    'matrix web ease=true', 'select 2025:A01 motion=false',
    'select 2025:A05 motion=true',
    'matrix llm ease=false', 'select 2025:LLM01 motion=false',
    'matrix llm ease=false', 'select 2025:LLM01 motion=true',
  ]);
});

test('only a committed selection draws and settles; previews only fade', () => {
  const select = app.slice(app.indexOf('function applySelection('), app.indexOf('// Previews fade quickly'));
  assert.match(select, /const committed = motion && key !== selectedKey/);
  assert.match(select, /updateEmphasis\('commit'\);\s*if \(committed\) \{\s*settleLineage\(\);\s*pendingReveal = true;/);
  const preview = app.slice(app.indexOf("addEventListener('pointerover'"), app.indexOf("window.addEventListener('hashchange'"));
  assert.doesNotMatch(preview, /revealLineage|settleLineage|pendingReveal|'commit'/);
  assert.match(app, /classList\.toggle\('is-previewing', mode === 'preview'\)/);
  assert.match(app, /if \(key !== selectedKey\) stopReveal\(\)/);
});

test('hover leaving a row, even into a gap, returns to the committed selection', () => {
  const over = app.slice(app.indexOf("addEventListener('pointerover'"), app.indexOf("elements.timelineGrid.addEventListener('pointerleave'"));
  assert.match(over, /closest\('\.risk-card'\)\?\.dataset\.key \?\? null/);
  assert.doesNotMatch(over, /if \(!key/);
});

test('reduced motion skips every scripted draw, settle, layout ease and modal exit', () => {
  for (const name of ['revealLineage', 'settleLineage', 'dismissModal']) {
    const body = app.slice(app.indexOf(`function ${name}(`), app.indexOf('\n}\n', app.indexOf(`function ${name}(`)));
    assert.match(body, /reducedMotion\(\)/, name);
  }
  assert.match(app, /const before = ease && !reducedMotion\(\) \? columnBoxes\(\) : null/);
  assert.match(app, /if \(created && layoutEasing && !reducedMotion\(\)\)/);
  assert.match(app, /const reducedMotion = \(\) => prefersReducedMotion\(window\)/);
});

test('connectors are redrawn from the same transformed boxes each frame while columns ease', () => {
  const ease = app.slice(app.indexOf('function easeColumns('), app.indexOf('// Selection only moves classes'));
  assert.match(ease, /column\.style\.transform = /);
  assert.match(ease, /drawConnections\(\);/);
  assert.doesNotMatch(ease, /scheduleConnections|transition/);
  assert.match(app, /reveals\.get\(key\)\?\.stroke\.setAttribute\('d', d\)/);
});

test('dismissModal closes after the exit animation, or at once with reduced motion', () => {
  const source = app.slice(app.indexOf('function dismissModal('), app.indexOf('function render()'));
  const run = (reduced) => {
    const events = [];
    let timer;
    const classes = new Set();
    const context = vm.createContext({
      MOTION: { modal: 220 }, modalExit: 0, shell: { classList: { remove() {} } }, followDockLayout() {},
      reducedMotion: () => reduced,
      setTimeout: (callback, ms) => { timer = { callback, ms }; return 1; },
      clearTimeout() {},
      elements: { detailModal: { classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c) }, close: () => events.push('close') } },
    });
    vm.runInContext(source, context);
    context.done = () => events.push('done');
    vm.runInContext('dismissModal(done);', context);
    return { events, timer, classes };
  };
  const reduced = run(true);
  assert.deepEqual(reduced.events, ['close', 'done']);
  assert.equal(reduced.timer, undefined);
  const animated = run(false);
  assert.deepEqual(animated.events, []);
  assert.ok(animated.classes.has('is-closing'));
  assert.equal(animated.timer.ms, 220);
  animated.timer.callback();
  assert.deepEqual(animated.events, ['close', 'done']);
  assert.ok(!animated.classes.has('is-closing'));
});

test('double click selects once and opens detail; keyboard click still selects', () => {
  const handlers = new Map();
  const calls = [];
  const source = app.slice(app.indexOf("button.addEventListener('click', (event)"), app.indexOf('      card.append(button);'));
  vm.runInNewContext(source, {
    button: { addEventListener: (type, handler) => handlers.set(type, handler) },
    family: { id: 'web' }, edition: { year: 2025 }, risk: { id: 'A02' },
    navigate: (route) => calls.push(`select ${route.year}:${route.id}`),
    openDetail: () => calls.push('detail'),
  });
  handlers.get('click')({ detail: 1 });
  handlers.get('click')({ detail: 2 });
  handlers.get('dblclick')();
  assert.deepEqual(calls, ['select 2025:A02', 'detail']);
  handlers.get('click')({ detail: 0 });
  assert.equal(calls.at(-1), 'select 2025:A02');
});


test('single selection preserves an open detail and pushes the new category URL', () => {
  const { context, renders, backs } = setup();
  context.currentRoute.detail = true;
  vm.runInContext("navigate({family: 'web', year: 2025, id: 'A03'});", context);
  assert.equal(context.history.state.route.detail, true);
  assert.equal(context.location.hash, pathFor({family:'web',year:2025,id:'A03'},catalog,'es'));
  assert.equal(renders(), 1); assert.equal(backs(), 0);
});
