import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const cssUrl = new URL('../styles.css', import.meta.url);
const htmlUrl = new URL('../index.html', import.meta.url);

function rule(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return css.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`))?.[1] ?? '';
}

test('timeline uses fluid columns with scrolling confined to the matrix', async () => {
  const css = await readFile(cssUrl, 'utf8');

  assert.match(css, /--risk-row-height:\s*clamp\(/);
  assert.match(css, /\.explorer-shell\s*\{[^}]*display:\s*grid/);
  assert.match(rule(css, '.timeline-scroll'), /overflow:\s*auto/);
  assert.match(rule(css, '.timeline-stage'), /min-width:\s*calc\(var\(--edition-count/);
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
  const dimmed = rule(css, '.has-lineage .connector-layer > path:not(.connector-hit)');
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
  assert.match(rule(css, '.connector-layer > path:not(.connector-hit)'), /transition:\s*opacity var\(--motion\)/);
  assert.match(css, /\.is-previewing \.connector-layer > path:not\(\.connector-hit\),\s*\.is-previewing \.risk-card\s*\{\s*transition-duration:\s*var\(--motion-fast\)/);
  assert.match(rule(css, '.connector-layer > path:not(.connector-hit).is-drawing'), /transition:\s*none/);
  // The draw mask lives inside the SVG, so connector styles must target direct children only.
  assert.doesNotMatch(css, /\.connector-layer path/);
  assert.match(rule(css, '.connector-draw'), /stroke-dasharray:\s*1 2/);
});

test('docked detail slides in its dock direction and reverses on close', async () => {
  const css = await readFile(cssUrl, 'utf8');
  assert.match(css, /@keyframes dock-in.*transform: translate/);
  assert.match(css, /@keyframes dock-out.*transform: translate/);
  assert.match(rule(css, '.detail-modal[open]'), /dock-in var\(--motion-modal\)/);
  assert.match(rule(css, '.detail-modal.is-closing'), /dock-out var\(--motion-modal\)/);
  assert.doesNotMatch(css, /\.detail-modal::backdrop/);
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
  assert.deepEqual(colored.sort(), ['#197454', '#286ca8', '#70d6b0', '#80bfff', '#895b16', '#f0bd70']);
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

test('detail is a docked reading panel in the matrix layout with inner scroll', async () => {
  const [css, html] = await Promise.all([readFile(cssUrl, 'utf8'), readFile(htmlUrl, 'utf8')]);
  assert.match(rule(css, '.detail-modal'), /position:\s*relative/);
  assert.match(rule(css, '.detail-modal'), /overflow:\s*hidden/);
  assert.match(rule(css, '.detail-body'), /overflow-y:\s*auto/);
  assert.match(html, /class="explorer-shell"[\s\S]*<dialog[^>]*id="detail-modal"[\s\S]*<\/dialog>[\s\S]*<\/section>/);
  assert.match(css, /grid-template-rows: minmax\(0, 1fr\) var\(--dock-size\)/);
  assert.match(css, /grid-template-columns: var\(--dock-size\) minmax\(0, 1fr\)/);
  assert.match(css, /grid-template-columns: minmax\(0, 1fr\) var\(--dock-size\)/);
});

test('primary family selector follows the title, with fixed secondary filter geometry', async () => {
  const [css, html] = await Promise.all([readFile(cssUrl, 'utf8'), readFile(htmlUrl, 'utf8')]);
  const header = html.slice(html.indexOf('<header'), html.indexOf('</header>'));
  const toolbar = html.slice(html.indexOf('class="toolbar"'), html.indexOf('class="explorer-shell"'));
  assert.match(header, /OWASP Evolution[\s\S]*id="family-nav"/);
  for (const id of ['risk-search', 'language-select', 'theme-select']) assert.ok(header.includes(`id="${id}"`));
  assert.ok(toolbar.includes('id="edition-options"'));
  assert.doesNotMatch(toolbar, /id="family-nav"/);
  assert.match(css, /#edition-options \{[^}]*height: 32px;[^}]*flex-wrap: nowrap/);
  assert.doesNotMatch(html, /family-description|timeline-heading|<footer|class="method"|<kbd|brand-mark/);
});
