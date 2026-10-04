import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const cssUrl = new URL('../styles.css', import.meta.url);
const htmlUrl = new URL('../index.html', import.meta.url);

function rule(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))?.[1] ?? '';
}

test('desktop timeline is a compact fluid matrix without horizontal scrolling', async () => {
  const css = await readFile(cssUrl, 'utf8');

  assert.match(css, /--risk-row-height:\s*clamp\(/);
  assert.match(rule(css, '.explorer-shell'), /display:\s*block/);
  assert.match(rule(css, '.timeline-scroll'), /overflow:\s*visible/);
  assert.match(rule(css, '.timeline-stage'), /min-width:\s*0/);
  assert.match(
    rule(css, '.timeline-grid'),
    /grid-template-columns:\s*repeat\(var\(--edition-count\),\s*minmax\(0,\s*1fr\)\)/,
  );
  assert.match(rule(css, '.risk-card'), /min-height:\s*var\(--risk-row-height\)/);
});

test('long names wrap to two lines and the Detail button overlays a fade', async () => {
  const css = await readFile(cssUrl, 'utf8');
  assert.match(rule(css, '.risk-name'), /-webkit-line-clamp:\s*2/);
  assert.match(rule(css, '.risk-name'), /font-size:\s*12px/);
  assert.match(rule(css, '.risk-detail-wrap'), /position:\s*absolute/);
  assert.match(rule(css, '.risk-detail-wrap'), /linear-gradient\(90deg, transparent/);
  assert.match(rule(css, '.risk-detail'), /min-height:\s*24px/);
  assert.doesNotMatch(css, /is-selected \.risk-focus\s*\{[^}]*padding-right/);
});

test('secondary text is at least 11px', async () => {
  const css = await readFile(cssUrl, 'utf8');
  const sizes = [...css.matchAll(/font-size:\s*(\d+)px/g)].map((match) => Number(match[1]));
  assert.ok(sizes.every((size) => size >= 11), `found ${sizes.filter((size) => size < 11)}`);
});

test('unrelated connectors recede to a thin stroke and dimmed rows use quiet text', async () => {
  const css = await readFile(cssUrl, 'utf8');
  const dimmed = rule(css, '.has-lineage .connector-layer path');
  const opacity = Number(dimmed.match(/opacity:\s*([\d.]+)/)[1]);
  assert.ok(opacity >= .15 && opacity <= .2);
  assert.match(dimmed, /stroke-width:\s*1;/);
  assert.match(rule(css, '.risk-card.is-dimmed'), /color:\s*var\(--quiet\)/);
  assert.doesNotMatch(rule(css, '.risk-card.is-dimmed'), /opacity/);
  assert.doesNotMatch(css, /path:not\(\.is-highlighted\)/);
  assert.match(rule(css, '.risk-card.is-anchor'), /var\(--ink\) 10%/);
  assert.match(rule(css, '.risk-card::before'), /background:\s*var\(--ink\)/);
});

test('motion stays within 180–240ms and disappears for reduced-motion users', async () => {
  const css = await readFile(cssUrl, 'utf8');
  assert.match(css, /--motion:\s*200ms/);
  for (const [, ms] of css.matchAll(/(\d+)ms/g)) assert.ok(Number(ms) === 0 || (ms >= 180 && ms <= 240), `${ms}ms`);
  assert.doesNotMatch(css, /infinite|cubic-bezier\([^)]*,\s*1\.[1-9]/);
  const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
  assert.match(reduced, /--motion:\s*0ms/);
  assert.match(reduced, /animation:\s*none !important/);
  assert.match(reduced, /transition:\s*none !important/);
});

test('legend sits beside the edition filter and stays visible, compact, on narrow screens', async () => {
  const [css, html] = await Promise.all([readFile(cssUrl, 'utf8'), readFile(htmlUrl, 'utf8')]);
  const summary = html.slice(html.indexOf('class="timeline-summary"'), html.indexOf('class="timeline-meta"'));
  assert.match(summary, /id="edition-filter"[\s\S]*class="legend"/);
  assert.equal(html.match(/class="legend"/g).length, 1);
  assert.equal(html.match(/class="legend-short"/g).length, 3);
  assert.doesNotMatch(css, /\.legend\s*\{\s*display:\s*none/);
});

test('category details are a centered reading modal over the visible matrix', async () => {
  const [css, html] = await Promise.all([readFile(cssUrl, 'utf8'), readFile(htmlUrl, 'utf8')]);
  assert.match(rule(css, '.detail-modal'), /max-width:\s*760px/);
  assert.match(rule(css, '.detail-modal'), /margin:\s*auto/);
  assert.match(rule(css, '.detail-modal'), /max-height:\s*calc/);
  assert.match(rule(css, '.detail-modal'), /overflow-y:\s*auto/);
  assert.match(rule(css, '.detail-modal::backdrop'), /background:\s*rgb\(0 0 0 \/ 80%\)/);
  assert.match(rule(css, 'body.detail-open'), /overflow:\s*hidden/);
  assert.match(html, /<div id="matrix-page">/);
  assert.match(html, /<dialog[^>]*id="detail-modal"[^>]*aria-labelledby="detail-title"/);
  assert.match(html, /id="open-detail"[^>]*aria-haspopup="dialog"/);
  assert.doesNotMatch(html, /<aside/);
});
