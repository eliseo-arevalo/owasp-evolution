import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { catalog } from '../src/data.js';
import { pathFor } from '../src/routes.js';

const enabled = Boolean(process.env.MOTION_PLAYWRIGHT);
const shot = (page, name) => page.screenshot({ path: `/workspace/tmp/owasp-v5-${name}.png` });
async function setup(port) {
  const { chromium } = await import(process.env.MOTION_PLAYWRIGHT);
  const server = spawn('python3', ['-m', 'http.server', String(port), '-d', 'dist'], { stdio: 'ignore' });
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  return { browser, server, origin: `http://localhost:${port}` };
}
async function ready(page, url) {
  await page.goto(url);
  await page.locator('.risk-focus').first().waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(700);
}
async function editionCount(page, count) {
  while (await page.locator('.edition-toggle[aria-pressed="true"]').count() > count) {
    await page.locator('.edition-toggle[aria-pressed="true"]').first().click();
    await page.waitForTimeout(250);
  }
  while (await page.locator('.edition-toggle[aria-pressed="true"]').count() < count) {
    await page.locator('.edition-toggle[aria-pressed="false"]').first().click();
    await page.waitForTimeout(250);
  }
}
async function geometry(page) {
  return page.evaluate(() => {
    const rect = selector => document.querySelector(selector).getBoundingClientRect();
    const stage = rect('#timeline-stage'), area = rect('.timeline-scroll');
    const columns = [...document.querySelectorAll('#timeline-grid > .edition-column')].map(column => column.getBoundingClientRect());
    let connectorError = 0;
    for (const path of document.querySelectorAll('#connector-layer > path[data-edge]')) {
      const [from, to] = path.dataset.edge.split('>');
      const a = rect(`.risk-card[data-key="${from}"]`), b = rect(`.risk-card[data-key="${to}"]`);
      const n = path.getAttribute('d').match(/-?[\d.]+/g).map(Number);
      connectorError = Math.max(connectorError, Math.abs(n[0] - (a.right - stage.left)), Math.abs(n[1] - (a.top + a.height / 2 - stage.top)), Math.abs(n[6] - (b.left - stage.left)), Math.abs(n[7] - (b.top + b.height / 2 - stage.top)));
    }
    return {
      cardWidth: columns[0].width, cardHeight: columns[0].height,
      balance: Math.abs(columns[0].left - stage.left - (stage.right - columns.at(-1).right)),
      verticalBalance: stage.height <= area.height ? Math.abs(stage.top - area.top - (area.bottom - stage.bottom)) : 0,
      connectorError, connectors: document.querySelectorAll('#connector-layer > path[data-edge]').length,
      gap: columns[1] ? columns[1].left - columns[0].right : 0,
      overflow: document.documentElement.scrollWidth - innerWidth,
      chrome: ['.topbar', '.toolbar', '#family-nav', '#language-select'].map(selector => {
        const { x, y, width, height } = rect(selector); return { x, y, width, height };
      }),
    };
  });
}

test('Chrome v5: sliding language radiogroup, click anywhere, keyboard and preserved routes', { skip: !enabled }, async () => {
  const { browser, server, origin } = await setup(4205);
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
    page.on('pageerror', error => errors.push(error.message));
    await ready(page, origin + '/');
    const group = page.locator('#language-select');
    const selected = () => group.locator('[aria-checked="true"]');
    assert.equal(await group.getAttribute('role'), 'radiogroup');
    assert.equal(await group.locator('[role="radio"]').count(), 2);
    assert.equal(await selected().getAttribute('data-language'), 'en');
    assert.equal(await group.locator('[tabindex="0"]').count(), 1);
    assert.equal((await group.boundingBox()).height, 32);
    const enTransform = await group.evaluate(el => getComputedStyle(el, '::before').transform);
    await shot(page, 'language-en-dark');
    // Clicking the selected half still toggles the entire control.
    await selected().click();
    assert.equal(new URL(page.url()).pathname, '/es/');
    assert.equal(await selected().getAttribute('data-language'), 'es');
    assert.equal(await page.evaluate(() => document.activeElement.dataset.language), 'es');
    await page.waitForTimeout(180);
    const esTransform = await group.evaluate(el => getComputedStyle(el, '::before').transform);
    assert.notEqual(enTransform, esTransform);
    assert.equal(await group.evaluate(el => getComputedStyle(el, '::before').transitionDuration), '0.16s');
    await shot(page, 'language-es-dark');
    await page.keyboard.press('ArrowRight');
    assert.equal(new URL(page.url()).pathname, '/');
    await page.keyboard.press('ArrowLeft');
    assert.equal(new URL(page.url()).pathname, '/es/');
    await page.keyboard.press('Space');
    assert.equal(new URL(page.url()).pathname, '/');
    await group.click({ position: { x: 1, y: 1 } });
    assert.equal(new URL(page.url()).pathname, '/es/');
    for (const route of [{ family: 'web', year: 2025, id: 'A05' }, { family: 'llm', year: 2025, id: 'LLM01' }]) {
      await ready(page, origin + pathFor(route, catalog, 'en'));
      const selectedKey = await page.locator('.risk-card.is-selected').getAttribute('data-key');
      const years = await page.locator('.edition-toggle[aria-pressed="true"]').allTextContents();
      await group.locator('[data-language="es"]').click();
      assert.equal(new URL(page.url()).pathname, pathFor(route, catalog, 'es'));
      assert.equal(await page.locator('.risk-card.is-selected').getAttribute('data-key'), selectedKey);
      assert.deepEqual(await page.locator('.edition-toggle[aria-pressed="true"]').allTextContents(), years);
      assert.equal(await page.locator('#detail-modal').evaluate(el => el.open), true);
      await page.keyboard.press('ArrowDown');
      assert.equal(new URL(page.url()).pathname, pathFor(route, catalog, 'en'));
      await page.goBack();
      assert.equal(await selected().getAttribute('data-language'), 'es');
    }
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await selected().click();
    assert.equal(await group.evaluate(el => getComputedStyle(el, '::before').transitionDuration), '0s');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#detail-page [data-action=close]').click();
    await page.waitForFunction(() => !document.querySelector('#detail-modal').open);
    await selected().focus();
    await page.emulateMedia({ colorScheme: 'light' });
    assert.equal(await group.evaluate(el => el.getBoundingClientRect().right <= innerWidth), true);
    await page.keyboard.press('Space');
    assert.equal(await group.locator('[tabindex="0"]').count(), 1);
    assert.equal(await selected().getAttribute('data-language'), 'es');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); server.kill(); }
});

test('Chrome v5: consistent section headers, sober scroll tabs and two-line lineage names', { skip: !enabled }, async () => {
  const { browser, server, origin } = await setup(4206);
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce', colorScheme: 'dark' });
    page.on('pageerror', error => errors.push(error.message));
    for (const language of ['en', 'es']) {
      await ready(page, origin + pathFor({ family: 'web', year: 2025, id: 'A05' }, catalog, language));
      const labels = language === 'en' ? ['Summary', 'How the attack works', 'Example', 'Prevention', 'Lineage', 'Sources'] : ['Resumen', 'Cómo funciona el ataque', 'Ejemplo', 'Prevención', 'Linaje', 'Fuentes'];
      for (const [index, id] of ['overview', 'attack', 'example', 'prevention', 'lineage', 'sources'].entries()) {
        assert.equal(await page.locator(`#detail-page #detail-${id} h2`).textContent(), labels[index]);
      }
      assert.equal(await page.locator('#detail-example .example-chip').textContent(), language === 'en' ? 'Vulnerable · Pseudocode' : 'Vulnerable · Pseudocódigo');
      assert.equal(await page.locator('#detail-page .attack-fix strong').textContent(), language === 'en' ? 'Fix:' : 'Corrección:');
      const tabs = page.locator('#detail-page .detail-section-nav');
      assert.equal(await tabs.evaluate(el => getComputedStyle(el).position), 'sticky');
      assert.equal(await tabs.locator('a[aria-current]').evaluate(el => getComputedStyle(el).borderBottomWidth), '2px');
      assert.equal(await tabs.locator('a[aria-current]').evaluate(el => getComputedStyle(el).backgroundColor), 'rgba(0, 0, 0, 0)');
      assert.equal(await tabs.evaluate(el => el.scrollWidth > el.clientWidth), false);
      await tabs.locator('a[href="#detail-example"]').click();
      await page.waitForFunction(() => document.querySelector('#detail-page .detail-section-nav a[aria-current]').hash === '#detail-example');
      if (language === 'en') await shot(page, 'detail-a05-tabs-example-dark');
      await page.locator('#detail-page .detail-body').evaluate(el => el.scrollTop = 0);
      await page.waitForFunction(() => document.querySelector('#detail-page .detail-section-nav a[aria-current]').hash === '#detail-overview');
      await tabs.locator('a[href="#detail-sources"]').click();
      await page.waitForFunction(() => document.querySelector('#detail-page .detail-section-nav a[aria-current]').hash === '#detail-sources');
      assert.equal(await tabs.evaluate(el => el.scrollWidth > el.clientWidth), false);
      assert.equal(await tabs.evaluate(el => el.classList.contains('has-right-overflow')), false);
    }
    await ready(page, origin + pathFor({ family: 'web', year: 2025, id: 'A03' }, catalog, 'en'));
    // Resize the left panel to a narrow 330px reading width.
    await page.locator('#dock-resizer').focus();
    for (let n = 0; n < 5; n++) await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(100);
    await page.locator('#detail-page .detail-section-nav a[href="#detail-lineage"]').click();
    await page.waitForTimeout(100);
    const names = await page.locator('#detail-page .lineage-title').evaluateAll(nodes => nodes.map(el => ({
      text: el.textContent, lines: el.clientHeight / parseFloat(getComputedStyle(el).lineHeight),
      clipped: el.scrollHeight > el.clientHeight + 1, tooltip: el.closest('.lineage-link').dataset.tooltip,
    })));
    assert.ok(names.some(name => name.lines > 1.5));
    assert.ok(names.every(name => name.lines <= 2.1));
    for (const name of names) assert.equal(name.tooltip, name.clipped ? name.text : undefined);
    await shot(page, 'timeline-a03-narrow-dark');
    await page.locator('#dock-resizer').focus();
    for (let n = 0; n < 9; n++) await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(100);
    const clipped = page.locator('#detail-page .lineage-link[data-tooltip]').first();
    assert.ok(await clipped.count(), 'names exceeding two lines get a full-name tooltip');
    const fullName = await clipped.locator('.lineage-title').textContent();
    await clipped.hover();
    await page.locator('#shared-tooltip').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#shared-tooltip span').textContent(), fullName);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); server.kill(); }
});

test('Chrome v5: 1/2/3/4 edition widths, docking, centering and connectors during width FLIP', { skip: !enabled }, async () => {
  const { browser, server, origin } = await setup(4207);
  const results = [], errors = [];
  try {
    for (const width of [1440, 1024, 390]) for (const docked of [false, true]) {
      const page = await browser.newPage({ viewport: { width, height: width === 390 ? 844 : 900 }, colorScheme: width === 390 ? 'light' : 'dark' });
      page.on('pageerror', error => errors.push(error.message));
      if (!docked) await page.addInitScript(() => localStorage.setItem('owasp-detail-open', 'false'));
      const route = docked ? pathFor({ family: 'web', year: 2025, id: 'A05' }, catalog, 'en') : '/';
      await ready(page, origin + route);
      const chrome = (await geometry(page)).chrome;
      for (const count of [4, 3, 2, 1]) {
        if (width <= 640 && docked) {
          await page.locator('#detail-page [data-action=close]').click();
          await page.waitForFunction(() => !document.querySelector('#detail-modal').open);
        }
        await editionCount(page, count);
        if (width <= 640 && docked) await page.locator('.risk-detail').click();
        const m = await geometry(page);
        assert.equal(m.overflow, 0);
        assert.ok(m.balance < 2, JSON.stringify({ width, docked, count, ...m }));
        assert.ok(m.verticalBalance < 2);
        assert.ok(m.connectorError < 1);
        assert.deepEqual(m.chrome, chrome, '0px chrome shift');
        assert.equal(m.connectors > 0, count > 1);
        if (count >= 3) assert.ok(m.cardWidth <= 260.1);
        if (width === 1440 && count === 1) assert.ok(m.cardWidth > 550 && m.cardWidth <= 560.1);
        if (width === 1440 && count === 2) assert.ok(m.cardWidth >= 420 && m.cardWidth <= 480.1);
        if (count === 2) assert.ok(m.gap >= 43);
        if (count === 1) assert.equal(await page.locator('.risk-summary').first().isVisible(), true);
        results.push({ width, docked, count, ...m });
        if (width === 1440 && !docked && count <= 2) await shot(page, `${count}-editions-1440-dark`);
        if (width === 390 && docked && count === 1) {
          await page.locator('#detail-page .detail-section-nav a[href="#detail-example"]').click();
          await page.waitForFunction(() => document.querySelector('#detail-page .detail-section-nav a[aria-current]').hash === '#detail-example');
          await page.waitForTimeout(300);
          await shot(page, '390-light');
        }
      }
      if (width <= 640 && docked) {
        await page.locator('#detail-page [data-action=close]').click();
        await page.waitForFunction(() => !document.querySelector('#detail-modal').open);
      }
      // Record the actual painted width and endpoints on every frame of 1 → 2.
      const frames = await page.evaluate(async () => {
        const column = document.querySelector('#timeline-grid > .edition-column');
        const samples = [];
        document.querySelector('.edition-toggle[aria-pressed="false"]').click();
        await new Promise(resolve => {
          const start = performance.now();
          const sample = () => {
            const stage = document.querySelector('#timeline-stage').getBoundingClientRect();
            let error = 0;
            for (const path of document.querySelectorAll('#connector-layer > path[data-edge]')) {
              const [from, to] = path.dataset.edge.split('>');
              const a = document.querySelector(`.risk-card[data-key="${from}"]`).getBoundingClientRect();
              const b = document.querySelector(`.risk-card[data-key="${to}"]`).getBoundingClientRect();
              const n = path.getAttribute('d').match(/-?[\d.]+/g).map(Number);
              error = Math.max(error, Math.abs(n[0] - (a.right - stage.left)), Math.abs(n[1] - (a.top + a.height / 2 - stage.top)), Math.abs(n[6] - (b.left - stage.left)), Math.abs(n[7] - (b.top + b.height / 2 - stage.top)));
            }
            samples.push({ width: column.getBoundingClientRect().width, error });
            if (performance.now() - start < 300) requestAnimationFrame(sample); else resolve();
          };
          requestAnimationFrame(sample);
        });
        return samples;
      });
      assert.ok(new Set(frames.map(frame => Math.round(frame.width))).size > 4, 'retained card width eases across frames');
      assert.ok(frames.every(frame => frame.error < 1), JSON.stringify(frames));
      assert.deepEqual((await geometry(page)).chrome, chrome);
      await page.close();
    }
    await writeFile('/workspace/tmp/owasp-v5-measurements.json', JSON.stringify(results, null, 2));
    assert.deepEqual(errors, []);
  } finally { await browser.close(); server.kill(); }
});
