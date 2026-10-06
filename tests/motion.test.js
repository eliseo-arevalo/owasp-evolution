import test from 'node:test';
import assert from 'node:assert/strict';
import { catalog } from '../src/data.js';
import { visibleConnections } from '../src/editions.js';
import { getLineage } from '../src/model.js';
import {
  MOTION,
  EASE,
  easeOut,
  prefersReducedMotion,
  drawPlan,
  settleDelays,
  layoutDeltas,
} from '../src/motion.js';

test('timings stay inside the agreed ranges', () => {
  assert.equal(MOTION.settleStep, 40);
  assert.ok(MOTION.settleShift >= 2 && MOTION.settleShift <= 4);
  assert.ok(MOTION.settle >= 180 && MOTION.settle <= 220);
  assert.equal(MOTION.layout, 200);
  assert.equal(MOTION.modal, 220);
  assert.ok(MOTION.draw >= 280 && MOTION.draw <= 420);
  assert.equal(EASE, 'cubic-bezier(.2, 0, 0, 1)');
});

test('the layout curve decelerates into place without overshoot', () => {
  assert.equal(easeOut(0), 0);
  assert.equal(easeOut(1), 1);
  let previous = 0;
  for (let step = 1; step <= 20; step++) {
    const value = easeOut(step / 20);
    assert.ok(value >= previous && value <= 1);
    previous = value;
  }
  assert.ok(easeOut(.5) > .5);
  assert.equal(easeOut(1.4), 1);
});

test('reduced motion is read from the media query', () => {
  const view = (matches) => ({ matchMedia: (query) => ({ matches: matches && query === '(prefers-reduced-motion: reduce)' }) });
  assert.equal(prefersReducedMotion(view(true)), true);
  assert.equal(prefersReducedMotion(view(false)), false);
  assert.equal(prefersReducedMotion({}), false);
});

test('connectors draw outward from the selected year, in order and away from it', () => {
  const edges = [
    { from: '2017:A1', to: '2021:A1' },
    { from: '2021:A1', to: '2025:A1' },
    { from: '2025:A1', to: '2029:A1' },
    { from: '2013:A1', to: '2017:A1' },
  ];
  const plan = drawPlan(edges, new Set([2013, 2017, 2021, 2025, 2029]), 2021);
  assert.deepEqual(plan.get('2017:A1>2021:A1'), { delay: 0, reverse: true });
  assert.deepEqual(plan.get('2021:A1>2025:A1'), { delay: 0, reverse: false });
  assert.deepEqual(plan.get('2025:A1>2029:A1'), { delay: MOTION.drawStep, reverse: false });
  assert.deepEqual(plan.get('2013:A1>2017:A1'), { delay: MOTION.drawStep, reverse: true });
});

test('hidden editions collapse into one step, and every real lineage draws within 280–420ms', () => {
  const plan = drawPlan([{ from: '2017:A1', to: '2025:A1' }], new Set([2017, 2025]), 2025);
  assert.deepEqual(plan.get('2017:A1>2025:A1'), { delay: 0, reverse: true });
  for (const family of Object.values(catalog.families)) {
    const years = new Set(family.editions.map((edition) => edition.year));
    for (const edition of family.editions) {
      for (const item of edition.items) {
        const lineage = getLineage(catalog, family.id, edition.year, item.id);
        const lit = visibleConnections(family, years, lineage.edges).filter((edge) => edge.highlighted);
        if (!lit.length) continue;
        const delays = [...drawPlan(lit, years, edition.year).values()].map((step) => step.delay);
        assert.equal(Math.min(...delays), 0);
        const total = Math.max(...delays) + MOTION.draw;
        assert.ok(total >= 280 && total <= 420, `${family.id} ${edition.year} ${item.id}: ${total}ms`);
      }
    }
  }
});

test('lineage rows settle 40ms apart, starting at the selected row and moving outward', () => {
  const keys = ['2017:A1', '2017:A4', '2021:A1', '2025:A2', '2013:A3'];
  const delays = settleDelays(keys, '2021:A1', new Set([2013, 2017, 2021, 2025]));
  assert.equal(delays.get('2021:A1'), 0);
  assert.equal(delays.get('2017:A1'), 40);
  assert.equal(delays.get('2017:A4'), 80);
  assert.equal(delays.get('2025:A2'), 120);
  assert.equal(delays.get('2013:A3'), 160);
});

test('long lineages cap the settle stagger', () => {
  const keys = Array.from({ length: 12 }, (_, index) => `2025:A${index + 1}`);
  const delays = settleDelays(keys, '2025:A1', new Set([2025]));
  assert.equal(Math.max(...delays.values()), MOTION.settleLimit * MOTION.settleStep);
});

test('columns kept across a year change ease from their old slot; new columns have no offset', () => {
  const before = new Map([[2021, { x: 0, y: 0 }], [2025, { x: 400, y: 0 }]]);
  const after = new Map([[2017, { x: 0, y: 0 }], [2021, { x: 300, y: 0 }], [2025, { x: 600, y: 0 }]]);
  const deltas = layoutDeltas(before, after);
  assert.deepEqual(deltas.get(2021), { x: -300, y: 0 });
  assert.deepEqual(deltas.get(2025), { x: -200, y: 0 });
  assert.equal(deltas.has(2017), false);
  assert.equal(layoutDeltas(after, after).size, 0);
});

test('page entry finishes under 1.2 seconds, including cell and connector staggers', () => {
  for (const family of Object.values(catalog.families)) {
    const lastColumn = family.editions.length - 1;
    const lastRow = Math.max(...family.editions.map((edition) => edition.items.length)) - 1;
    assert.ok(lastColumn * MOTION.entryStep + lastRow * MOTION.entryCellStep + MOTION.entryRise < 1200);
    assert.ok(MOTION.entryConnectors + Math.max(0, lastColumn - 1) * MOTION.entryStep + MOTION.draw < 1200);
  }
});
