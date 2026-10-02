import test from 'node:test';
import assert from 'node:assert/strict';

import {
  focusResolved,
  resetScrollPosition,
  scheduleFocus,
  shouldRefocusWithin,
} from '../src/focus.js';

test('focusResolved uses the live replacement returned after a rerender', () => {
  let focused = '';
  const stale = { isConnected: false, focus: () => { focused = 'stale'; } };
  const replacement = { isConnected: true, focus: () => { focused = 'replacement'; } };

  const target = focusResolved(() => replacement, () => stale);

  assert.equal(target, replacement);
  assert.equal(focused, 'replacement');
});

test('focusResolved falls back when the preferred target was removed', () => {
  let focused = '';
  const removed = { isConnected: false, focus: () => { focused = 'removed'; } };
  const fallback = { isConnected: true, focus: () => { focused = 'fallback'; } };

  const target = focusResolved(() => removed, () => fallback);

  assert.equal(target, fallback);
  assert.equal(focused, 'fallback');
});

test('scheduleFocus resolves the target when the scheduled callback runs', () => {
  let current = null;
  let callback;
  let focused = false;

  scheduleFocus(
    () => current,
    () => null,
    (next) => { callback = next; },
  );
  current = { isConnected: true, focus: () => { focused = true; } };
  callback();

  assert.equal(focused, true);
});

test('shouldRefocusWithin preserves drawer focus across an open rerender', () => {
  const activeElement = {};
  const container = { contains: (candidate) => candidate === activeElement };

  assert.equal(shouldRefocusWithin(container, activeElement, true), true);
  assert.equal(shouldRefocusWithin(container, activeElement, false), false);
  assert.equal(shouldRefocusWithin(container, {}, true), false);
});

test('resetScrollPosition makes the replacement focus target visible', () => {
  const container = { scrollTop: 232 };

  resetScrollPosition(container);

  assert.equal(container.scrollTop, 0);
});
