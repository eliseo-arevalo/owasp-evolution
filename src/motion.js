import { yearOf } from './editions.js';

// Script-driven timings; styles.css holds the matching transition durations.
export const MOTION = {
  entryRise: 320,
  entryStep: 65,
  entryCellStep: 18,
  entryConnectors: 500,
  draw: 300, // one connector drawing along its path
  drawStep: 60, // each edition further from the selected year starts one step later
  settle: 200,
  settleStep: 40,
  settleShift: 3,
  settleLimit: 6,
  layout: 200,
  family: 320,
  familyStep: 35,
  modal: 220,
};

export const EASE = 'cubic-bezier(.2, 0, 0, 1)';

// Frame-driven layout uses a decelerating curve close to EASE, with no overshoot.
export const easeOut = (t) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;

export const prefersReducedMotion = (view = globalThis) =>
  Boolean(view.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

const columnOrder = (years) => [...years].sort((a, b) => a - b);

// Connectors touching the selected edition draw first, and every stroke grows away from it.
export function drawPlan(edges, years, selectedYear) {
  const order = columnOrder(years);
  const anchor = order.indexOf(selectedYear);
  return new Map(edges.map((edge) => {
    const from = order.indexOf(yearOf(edge.from));
    const to = order.indexOf(yearOf(edge.to));
    const ring = Math.min(Math.abs(from - anchor), Math.abs(to - anchor));
    return [`${edge.from}>${edge.to}`, { delay: ring * MOTION.drawStep, reverse: to <= anchor }];
  }));
}

// Lineage rows settle outward from the selected row; keys arrive in document order.
export function settleDelays(keys, anchorKey, years) {
  const order = columnOrder(years);
  const anchor = order.indexOf(yearOf(anchorKey));
  const distance = (key) => Math.abs(order.indexOf(yearOf(key)) - anchor);
  const sorted = [...keys].sort((a, b) =>
    Number(b === anchorKey) - Number(a === anchorKey) || distance(a) - distance(b) || yearOf(a) - yearOf(b));
  return new Map(sorted.map((key, index) => [key, Math.min(index, MOTION.settleLimit) * MOTION.settleStep]));
}

// Columns that stay visible start where they were drawn; new columns have no offset.
export function layoutDeltas(before, after) {
  const deltas = new Map();
  for (const [year, box] of after) {
    const previous = before.get(year);
    if (previous && (previous.x !== box.x || previous.y !== box.y)) {
      deltas.set(year, { x: previous.x - box.x, y: previous.y - box.y });
    }
  }
  return deltas;
}
