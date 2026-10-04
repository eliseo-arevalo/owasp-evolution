import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { formatRoute } from '../src/model.js';

const app = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');
const navigateSource = app.slice(app.indexOf('function navigate('), app.indexOf('function renderFamilyNav('));

for (const initiallyOpen of [false, true]) {
  test(`category navigation preserves inspector state (${initiallyOpen ? 'open' : 'closed'}) and updates the route`, () => {
    const context = vm.createContext({
      inspectorOpen: initiallyOpen,
      focusInspectorAfterRender: false,
      location: { hash: '#/web/2025/A01' },
      formatRoute,
      render: () => {},
      route: { family: 'web', year: 2025, id: 'A02' },
    });
    vm.runInContext(`${navigateSource}\nnavigate(route);`, context);
    assert.equal(context.location.hash, '#/web/2025/A02');
    assert.equal(context.inspectorOpen, initiallyOpen);
  });
}

test('reselecting the current category refreshes content without opening the inspector', () => {
  let renders = 0;
  const context = vm.createContext({
    inspectorOpen: false,
    focusInspectorAfterRender: false,
    location: { hash: '#/web/2025/A01' },
    formatRoute,
    render: () => { renders++; },
  });
  vm.runInContext(`${navigateSource}\nnavigate({ family: 'web', year: 2025, id: 'A01' });`, context);
  assert.equal(renders, 1);
  assert.equal(context.inspectorOpen, false);
});

test('row and search selection preserve panel state; only selected rows offer a separate detail button', () => {
  const rows = app.slice(app.indexOf('function renderTimeline('), app.indexOf('function renderEditionFilter('));
  const search = app.slice(app.indexOf('function renderSearchResults('), app.indexOf('function hideSearchResults('));
  assert.doesNotMatch(rows, /openInspector: true/);
  assert.doesNotMatch(search, /openInspector: true|aria-haspopup/);
  assert.match(rows, /if \(risk.key === selectedKey\) \{[\s\S]*const detail = node\('button', 'risk-detail'/);
  assert.match(rows, /detail.addEventListener\('click', \(\) => setInspectorOpen\(true/);
  assert.match(app, /elements.openInspector.addEventListener\('click', \(\) => setInspectorOpen\(!inspectorOpen/);
});
