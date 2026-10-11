import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDock, readDockPreferences } from '../src/dock.js';

test('migrates stored bottom docking to left, preserving width and discarding obsolete heights', () => {
  for (const saved of [
    { 'owasp-dock': 'bottom' },
    { 'owasp-dock-layout': JSON.stringify({ desktop: { side: 'bottom', width: 420, height: 600 }, mobile: { height: 700 } }) },
  ]) {
    const values = new Map(Object.entries(saved));
    const storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
    const preferences = readDockPreferences(storage);
    assert.equal(preferences.desktop.side, 'left');
    assert.equal(preferences.desktop.width, saved['owasp-dock-layout'] ? 420 : 380);
    assert.equal(values.get('owasp-dock'), 'left');
    assert.deepEqual(JSON.parse(values.get('owasp-dock-layout')), preferences);
    assert.ok(!('height' in preferences.desktop));
  }
});
test('URL bottom docking migrates to left; valid sides and unavailable storage work', () => {
  const storage = { getItem: () => null, setItem() {} };
  assert.equal(readDockPreferences(storage, '?dock=bottom').desktop.side, 'left');
  assert.equal(readDockPreferences(storage, '?dock=right').desktop.side, 'right');
  assert.equal(normalizeDock('bottom'), 'left');
  assert.equal(normalizeDock('right'), 'right');
  assert.deepEqual(readDockPreferences({ getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } }), { desktop: { side: 'left', width: 380 } });
});
