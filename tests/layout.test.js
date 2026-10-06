import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const cssUrl = new URL('../styles.css', import.meta.url);
const htmlUrl = new URL('../index.html', import.meta.url);

function rule(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return css.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`))?.[1] ?? '';
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
  const dimmed = rule(css, '.has-lineage .connector-layer > path');
  const opacity = Number(dimmed.match(/opacity:\s*([\d.]+)/)[1]);
  assert.ok(opacity >= .15 && opacity <= .2);
  assert.match(dimmed, /stroke-width:\s*1;/);
  assert.match(rule(css, '.risk-card.is-dimmed'), /color:\s*var\(--quiet\)/);
  assert.doesNotMatch(rule(css, '.risk-card.is-dimmed'), /opacity/);
  assert.doesNotMatch(css, /path:not\(\.is-highlighted\)/);
  assert.match(rule(css, '.risk-card.is-anchor'), /var\(--ink\) 10%/);
  assert.match(rule(css, '.risk-card::before'), /background:\s*var\(--ink\)/);
});

test('CSS motion uses only the named durations and disappears for reduced-motion users', async () => {
  const css = await readFile(cssUrl, 'utf8');
  assert.match(css, /--motion:\s*200ms/);
  assert.match(css, /--motion-fast:\s*120ms/);
  assert.match(css, /--motion-bar:\s*180ms/);
  assert.match(css, /--motion-modal:\s*220ms/);
  for (const [, ms] of css.matchAll(/(\d+)ms/g)) assert.ok([0, 120, 180, 200, 220].includes(Number(ms)), `${ms}ms`);
  assert.doesNotMatch(css, /infinite|cubic-bezier\([^)]*,\s*1\.[1-9]|scale\((?!Y)|scaleY\(1\.|bounce/);
  const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
  for (const name of ['--motion', '--motion-fast', '--motion-bar', '--motion-modal']) {
    assert.match(reduced, new RegExp(`${name}:\\s*0ms`));
  }
  assert.match(reduced, /\*, \*::before, \*::after, ::backdrop/);
  assert.match(reduced, /animation:\s*none !important/);
  assert.match(reduced, /transition:\s*none !important/);
});

test('the selection bar grows from the top of the row and clears at once', async () => {
  const css = await readFile(cssUrl, 'utf8');
  const bar = rule(css, '.risk-card::before');
  assert.match(bar, /transform:\s*scaleY\(0\)/);
  assert.match(bar, /transform-origin:\s*top/);
  assert.doesNotMatch(bar, /transition|opacity/);
  const selected = rule(css, '.risk-card.is-selected::before');
  assert.match(selected, /transform:\s*scaleY\(1\)/);
  assert.match(selected, /transition:\s*transform var\(--motion-bar\) var\(--ease\)/);
});

test('previews fade faster than commits, and drawn strokes skip the fade', async () => {
  const css = await readFile(cssUrl, 'utf8');
  assert.match(rule(css, '.connector-layer > path'), /transition:\s*opacity var\(--motion\)/);
  assert.match(css, /\.is-previewing \.connector-layer > path,\s*\.is-previewing \.risk-card\s*\{\s*transition-duration:\s*var\(--motion-fast\)/);
  assert.match(rule(css, '.connector-layer > path.is-drawing'), /transition:\s*none/);
  // The draw mask lives inside the SVG, so connector styles must target direct children only.
  assert.doesNotMatch(css, /\.connector-layer path/);
  assert.match(rule(css, '.connector-draw'), /stroke-dasharray:\s*1 2/);
});

test('the modal rises 8px as it fades in and reverses on close, without bounce', async () => {
  const css = await readFile(cssUrl, 'utf8');
  assert.match(css, /@keyframes modal-in \{ from \{ opacity: 0; transform: translateY\(8px\); \} \}/);
  assert.match(css, /@keyframes modal-out \{ to \{ opacity: 0; transform: translateY\(8px\); \} \}/);
  assert.match(rule(css, '.detail-modal[open]'), /modal-in var\(--motion-modal\) var\(--ease\)/);
  assert.match(rule(css, '.detail-modal[open]::backdrop'), /soft-in 220ms/);
  assert.match(rule(css, '.detail-modal.is-closing'), /modal-out var\(--motion-modal\) var\(--ease-exit\) forwards/);
  assert.match(rule(css, '.detail-modal.is-closing::backdrop'), /soft-out 220ms/);
  // The exit curve is the entrance curve mirrored.
  assert.match(css, /--ease:\s*cubic-bezier\(\.2, 0, 0, 1\)/);
  assert.match(css, /--ease-exit:\s*cubic-bezier\(1, 0, \.8, 1\)/);
});

test('chrome stays neutral: color only on connections and lineage tints', async () => {
  const css = await readFile(cssUrl, 'utf8');
  const hexes = new Set([...css.matchAll(/#[0-9a-f]{3,8}\b/gi)].map(([hex]) => hex.toLowerCase()));
  const neutral = (hex) => {
    const digits = hex.slice(1, hex.length === 4 || hex.length === 5 ? 4 : 7);
    const channels = digits.length === 3 ? [...digits].map((c) => c + c) : digits.match(/../g);
    return new Set(channels).size === 1;
  };
  const colored = [...hexes].filter((hex) => !neutral(hex));
  assert.deepEqual(colored.sort(), ['#70d6b0', '#80bfff', '#f0bd70']);
  for (const selector of ['.risk-detail', '.detail-trigger', '.source-link', '.family-tab', '.edition-status']) {
    assert.doesNotMatch(rule(css, selector), /--continues|--renamed|--merged/);
  }
});

test('legend sits beside the edition filter and stays visible, compact, on narrow screens', async () => {
  const [css, html] = await Promise.all([readFile(cssUrl, 'utf8'), readFile(htmlUrl, 'utf8')]);
  const summary = html.slice(html.indexOf('class="toolbar"'), html.indexOf('class="explorer-shell"'));
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
  assert.match(rule(css, '.detail-modal'), /overflow:\s*hidden/);
  assert.match(rule(css, '.detail-body'), /overflow-y:\s*auto/);
  assert.match(rule(css, '.detail-page'), /max-height:\s*inherit/);
  assert.match(rule(css, '.detail-header'), /flex:\s*none/);
  assert.match(rule(css, '.detail-modal::backdrop'), /background:\s*rgb\(0 0 0 \/ 80%\)/);
  assert.match(rule(css, 'body.detail-open'), /overflow:\s*hidden/);
  assert.match(html, /<div id="matrix-page">/);
  assert.match(html, /<dialog[^>]*id="detail-modal"[^>]*aria-labelledby="detail-title"/);
  assert.match(html, /id="open-detail"[^>]*aria-haspopup="dialog"/);
  assert.doesNotMatch(html, /<aside/);
});

test('lineage summary reserves one fixed line with ellipsis, including hidden years', async () => {
  const css = await readFile(cssUrl, 'utf8');
  const help = rule(css, '.timeline-help');
  assert.match(help, /height:\s*28px/);
  assert.match(help, /overflow:\s*hidden/);
  assert.match(help, /text-overflow:\s*ellipsis/);
  assert.match(help, /white-space:\s*nowrap/);
  assert.doesNotMatch(css, /\.path-route\s*\{\s*white-space:\s*normal/);
});
test('search, segmented editions, legend and family share a wrapping control bar', async () => {
  const [css, html] = await Promise.all([readFile(cssUrl, 'utf8'), readFile(htmlUrl, 'utf8')]);
  const toolbar = html.slice(html.indexOf('class="toolbar"'), html.indexOf('class="explorer-shell"'));
  for (const id of ['risk-search', 'edition-options', 'family-nav']) assert.ok(toolbar.includes(`id="${id}"`));
  assert.match(toolbar, /class="legend"/);
  assert.match(rule(css, '.toolbar'), /flex-wrap:\s*wrap/);
  assert.match(css, /label:has\(input:checked\)/);
});
