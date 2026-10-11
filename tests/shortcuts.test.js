import test from 'node:test';
import assert from 'node:assert/strict';
import { shortcutCommand, shortcutRows } from '../src/shortcuts.js';
test('complete keyboard map and modifier handling', () => {
  const expected = { ArrowUp:'move:ArrowUp', ArrowDown:'move:ArrowDown', ArrowLeft:'move:ArrowLeft', ArrowRight:'move:ArrowRight', j:'move:ArrowDown', J:'move:ArrowDown', k:'move:ArrowUp', '[':'move:ArrowLeft', ']':'move:ArrowRight', Enter:'open', Escape:'escape', '/':'search', f:'fullscreen', '1':'dock:left', '2':'dock:right', '3':null, '?':'help', Home:'move:Home', End:'move:End' };
  for (const [key, command] of Object.entries(expected)) assert.equal(shortcutCommand({key}), command, key);
  assert.equal(shortcutCommand({key:'K',ctrlKey:true}), 'search');
  assert.equal(shortcutCommand({key:'k',metaKey:true}), 'search');
  assert.equal(shortcutCommand({key:'?',shiftKey:true}), 'help');
  for (const modifiers of [{altKey:true},{ctrlKey:true},{metaKey:true},{shiftKey:true}]) assert.equal(shortcutCommand({key:'ArrowDown',...modifiers}), null);
  assert.ok(shortcutRows.every(([keys, es, en]) => keys && es && en && es !== en));
});
