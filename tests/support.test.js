import test from 'node:test';
import assert from 'node:assert/strict';
import { generateSeo } from '../scripts/seo.js';
import { hasIcon } from '../src/icons.js';

test('all prerendered EN/ES pages contain accessible plain support links', () => {
  assert.ok(hasIcon('coffee'));
  for (const [path, html] of generateSeo()) {
    if (!html.includes('rel="canonical"')) continue;
    const label = html.includes('<html lang="es">') ? 'Invítame un café' : 'Buy me a coffee';
    const links = [...html.matchAll(/<a\b[^>]*class="support-(?:button|link)"[^>]*>/g)].map(([link]) => link);
    assert.equal(links.length, 2, path);
    for (const link of links) {
      for (const attribute of ['href="https://ko-fi.com/oclazi"', 'target="_blank"', 'rel="noopener"', `aria-label="${label}"`]) assert.ok(link.includes(attribute), `${path}: ${attribute}`);
    }
    assert.ok(links[0].includes(`data-tooltip="${label}"`));
    assert.ok(html.includes('data-icon="coffee"'));
    assert.ok(html.includes(`>${label}</a>`));
    assert.doesNotMatch(html, /<(?:script|iframe)\b[^>]*ko-fi/);
    if (html.includes('id="detail-sources"')) assert.match(html, /id="detail-sources"[^]*class="detail-support"[^]*class="support-link"/);
  }
});
