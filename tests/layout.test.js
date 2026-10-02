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

test('category details use a closeable overlay drawer instead of consuming table width', async () => {
  const [css, html] = await Promise.all([
    readFile(cssUrl, 'utf8'),
    readFile(htmlUrl, 'utf8'),
  ]);

  assert.match(rule(css, '.inspector'), /position:\s*fixed/);
  assert.match(css, /\.inspector\.is-open\s*\{/);
  assert.match(html, /<button[^>]*id="open-inspector"[^>]*aria-controls="inspector"[^>]*aria-expanded="false"/);
  assert.match(html, /<aside[^>]*id="inspector"[^>]*role="dialog"[^>]*aria-labelledby="inspector-title"/);
});
