import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
const source = html.match(/<script>([\s\S]*?)<\/script>/)[1];
test('theme is resolved before CSS, defaults to system and tolerates unavailable storage', () => {
  assert.ok(html.indexOf('<script>') < html.indexOf('rel="stylesheet"'));
  for (const saved of [null, 'system', 'dark', 'light', 'invalid', 'blocked']) {
    for (const dark of [true, false]) {
      const document = { documentElement: { dataset: {}, classList: { add() {} }, style: { setProperty() {} } }, querySelector: () => ({}) };
      vm.runInNewContext(source, { document, URLSearchParams, location: { pathname: '/', hash: '' }, localStorage: { getItem() { if (saved === 'blocked') throw Error(); return saved; } }, matchMedia: () => ({ matches: dark }) });
      const preference = ['dark', 'light'].includes(saved) ? saved : 'system';
      assert.equal(document.documentElement.dataset.themePreference, preference);
      assert.equal(document.documentElement.dataset.theme, preference === 'system' ? dark ? 'dark' : 'light' : preference);
    }
  }
});
function luminance(hex) {
  const c = hex.slice(1).match(/../g).map(v => parseInt(v,16)/255).map(v=>v <= .04045 ? v/12.92 : ((v+.055)/1.055)**2.4);
  return c[0]*.2126+c[1]*.7152+c[2]*.0722;
}
test('light connector hues meet AA 4.5:1 on both page and card surfaces', () => {
  const light = css.match(/:root\[data-theme='light'\] \{([^}]+)/)[1];
  const values = Object.fromEntries([...light.matchAll(/--([\w-]+):\s*(#[\da-f]+);/g)].map(([,key,value])=>[key,value]));
  for(const hue of ['continues','renamed','merged']) for(const bg of ['page','surface']) {
    const ratio = (luminance(values[bg])+.05)/(luminance(values[hue])+.05);
    assert.ok(ratio >= 4.5, `${hue}/${bg}: ${ratio}`);
  }
});
test('category accents meet AA on light page, example and tile surfaces', () => {
  const rules = [...css.matchAll(/:root\[data-theme='light'\] \{([^}]+)/g)].map(match => match[1]).join('');
  const values = Object.fromEntries([...rules.matchAll(/--([\w-]+):\s*(#[\da-f]+);/g)].map(([,key,value])=>[key,value]));
  for (const hue of ['visual-mint', 'visual-blue', 'visual-amber', 'visual-red']) for (const bg of ['page', 'surface', 'surface-hover']) {
    const ratio = (luminance(values[bg])+.05)/(luminance(values[hue])+.05);
    assert.ok(ratio >= 4.5, `${hue}/${bg}: ${ratio}`);
  }
});
