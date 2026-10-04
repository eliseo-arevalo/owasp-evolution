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
  assert.match(rule(css, '.risk-card'), /height:\s*var\(--risk-row-height\)/);
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
