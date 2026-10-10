import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { catalog } from '../src/data.js';
import { defaultVisibleYears, latestEdition, firstCategory } from '../src/editions.js';
import { pathFor } from '../src/routes.js';

test('Chrome: first visit reserves the panel, remembers close/open, and prioritizes deep links', { skip: !process.env.MOTION_PLAYWRIGHT }, async () => {
  const { chromium } = await import(process.env.MOTION_PLAYWRIGHT);
  const server = spawn('python3', ['-m', 'http.server', '4211', '-d', 'dist'], { stdio: 'ignore' });
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const origin = 'http://localhost:4211';
  const results = [];
  try {
    for (const [familyId, width, height, theme, motion] of [
      ['web', 1440, 1000, 'dark', 'no-preference'],
      ['web', 390, 844, 'light', 'no-preference'],
      ['llm', 1440, 1000, 'dark', 'no-preference'],
      ['web', 768, 1024, 'light', 'reduce'],
      ['llm', 640, 900, 'light', 'reduce'],
    ]) {
      const family = catalog.families[familyId];
      const edition = latestEdition(family), category = firstCategory(edition);
      const home = familyId === catalog.defaultFamily ? '/' : pathFor({ family: familyId }, catalog);
      const page = await browser.newPage({ viewport: { width, height }, colorScheme: theme, reducedMotion: motion, hasTouch: width === 768 });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(theme => {
        localStorage.setItem('owasp-theme', theme);
        window.layoutShifts = [];
        new PerformanceObserver(list => {
          for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.layoutShifts.push({ value: entry.value, sources: entry.sources.map(source => source.node?.className) });
        }).observe({ type: 'layout-shift', buffered: true });
        window.initialMatrixBoxes = [];
        const sample = () => {
          const matrix = document.querySelector('.timeline-panel');
          if (matrix && document.querySelector('link[rel="stylesheet"]')?.sheet) {
            const { x, y, width, height } = matrix.getBoundingClientRect();
            window.initialMatrixBoxes.push({ x, y, width, height });
          }
          if (document.documentElement.classList.contains('booting') || !matrix) requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      }, theme);
      // Let the shell paint while the module graph is still downloading.
      await page.route('**/app.js', async route => {
        await new Promise(resolve => setTimeout(resolve, 250));
        await route.continue();
      });
      await page.goto(origin + home);
      await page.locator('#detail-modal[open]').waitFor();
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(1100);
      assert.equal(new URL(page.url()).pathname, home);
      assert.equal(await page.locator('.is-selected').getAttribute('data-key'), `${edition.year}:${category.id}`);
      assert.match(await page.locator('#detail-title').textContent(), new RegExp(category.name));
      assert.deepEqual(await page.locator('.edition-column').evaluateAll(nodes => nodes.map(node => Number(node.dataset.year))), defaultVisibleYears(family));
      assert.ok((await page.locator('link[rel="canonical"]').getAttribute('href')).endsWith(home));
      assert.equal(await page.locator('.explorer-shell').getAttribute('data-dock'), width <= 640 ? 'bottom' : 'left');
      const geometry = await page.evaluate(() => {
        const matrix = document.querySelector('.timeline-panel').getBoundingClientRect();
        const panel = document.querySelector('#detail-modal').getBoundingClientRect();
        const shell = document.querySelector('.explorer-shell');
        const title = document.querySelector('#detail-title').getBoundingClientRect();
        const stage = document.querySelector('#timeline-stage').getBoundingClientRect();
        let connectorError = 0;
        for (const path of document.querySelectorAll('#connector-layer > path[data-edge]')) {
          const [from, to] = path.dataset.edge.split('>');
          const a = document.querySelector(`.risk-card[data-key="${from}"]`).getBoundingClientRect();
          const b = document.querySelector(`.risk-card[data-key="${to}"]`).getBoundingClientRect();
          const n = path.getAttribute('d').match(/-?[\d.]+/g).map(Number);
          connectorError = Math.max(connectorError, Math.abs(n[0] - (a.right - stage.left)), Math.abs(n[1] - (a.top - stage.top + a.height / 2)), Math.abs(n[6] - (b.left - stage.left)), Math.abs(n[7] - (b.top - stage.top + b.height / 2)));
        }
        const final = { x: matrix.x, y: matrix.y, width: matrix.width, height: matrix.height };
        return {
          cls: window.layoutShifts.reduce((sum, entry) => sum + entry.value, 0), shifts: window.layoutShifts,
          initialFrames: window.initialMatrixBoxes.length,
          initialDelta: Math.max(0, ...window.initialMatrixBoxes.flatMap(box => Object.keys(final).map(key => Math.abs(box[key] - final[key])))),
          panelRatio: panel.height / (shell.clientHeight - 22), titleVisible: title.top >= panel.top && title.bottom <= panel.bottom,
          overlap: Math.max(0, Math.min(matrix.right, panel.right) - Math.max(matrix.left, panel.left)) * Math.max(0, Math.min(matrix.bottom, panel.bottom) - Math.max(matrix.top, panel.top)),
          connectorError, overflow: document.documentElement.scrollWidth - innerWidth,
        };
      });
      assert.ok(geometry.cls < .001, JSON.stringify(geometry));
      assert.ok(geometry.initialFrames > 2, JSON.stringify(geometry));
      assert.ok(geometry.initialDelta < 1, JSON.stringify(geometry));
      assert.equal(geometry.overlap, 0);
      assert.equal(geometry.overflow, 0);
      assert.ok(geometry.connectorError < 1);
      assert.ok(geometry.titleVisible);
      if (width <= 640) {
        assert.ok(Math.abs(geometry.panelRatio - .25) < .01, JSON.stringify(geometry));
        const handle = await page.locator('#dock-resizer').boundingBox();
        await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
        await page.mouse.down();
        await page.mouse.move(handle.x + handle.width / 2, handle.y - 200, { steps: 12 });
        await page.mouse.up();
        await page.waitForTimeout(350);
        assert.ok(Number(await page.locator('#dock-resizer').getAttribute('aria-valuenow')) > height * .3);
        // Restore the initial peek for the requested screenshot.
        await page.evaluate(() => localStorage.removeItem('owasp-dock-layout'));
        await page.reload();
        await page.locator('#detail-modal[open]').waitFor();
        await page.waitForTimeout(1100);
      }
      if (width === 1440 || width === 390) await page.screenshot({ path: `/workspace/tmp/owasp-first-${familyId === 'llm' ? 'llm-' : ''}${width}-${theme}.png` });
      if (motion === 'reduce') assert.equal(await page.evaluate(() => document.getAnimations().length), 0);
      await page.locator('[data-action="close"]').click();
      await page.waitForFunction(() => !document.querySelector('#detail-modal').open);
      assert.equal(new URL(page.url()).pathname, home);
      assert.equal(await page.evaluate(() => localStorage.getItem('owasp-detail-open')), 'false');
      await page.reload();
      await page.locator('.risk-card').first().waitFor();
      assert.equal(await page.locator('#detail-modal').evaluate(dialog => dialog.open), false);
      await page.locator('.risk-detail').click();
      await page.locator('#detail-modal[open]').waitFor();
      assert.equal(await page.evaluate(() => localStorage.getItem('owasp-detail-open')), 'true');
      await page.goBack();
      await page.waitForFunction(() => !document.querySelector('#detail-modal').open);
      assert.equal(await page.evaluate(() => localStorage.getItem('owasp-detail-open')), 'false');
      await page.locator('.risk-detail').click();
      await page.locator('#detail-modal[open]').waitFor();
      await page.goto(origin + home);
      await page.locator('#detail-modal[open]').waitFor();
      // Deep links to hidden editions outrank the saved closed choice and defaults.
      await page.locator('[data-action="close"]').click();
      const older = family.editions[0], other = older.items.at(-1);
      const deep = pathFor({ family: familyId, year: older.year, id: other.id }, catalog);
      await page.goto(origin + deep);
      await page.locator('#detail-modal[open]').waitFor();
      assert.equal(await page.locator('.is-selected').getAttribute('data-key'), `${older.year}:${other.id}`);
      assert.match(await page.locator('#detail-title').textContent(), new RegExp(other.name));
      assert.ok((await page.locator('link[rel="canonical"]').getAttribute('href')).endsWith(deep));
      assert.equal(await page.evaluate(() => localStorage.getItem('owasp-detail-open')), 'false');
      await page.goto(origin + home);
      await page.locator('.risk-card').first().waitFor();
      assert.equal(await page.locator('#detail-modal').evaluate(dialog => dialog.open), false);
      assert.deepEqual(errors, []);
      results.push({ family: familyId, width, height, motion, ...geometry });
      await page.close();
    }
    await writeFile('/workspace/tmp/owasp-first-measurements.json', JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results));
  } finally { await browser.close(); server.kill(); }
});

test('Chrome: saved closed and resized panels reserve the correct space before hydration', { skip: !process.env.MOTION_PLAYWRIGHT }, async () => {
  const { chromium } = await import(process.env.MOTION_PLAYWRIGHT);
  const server = spawn('python3', ['-m', 'http.server', '4210', '-d', 'dist'], { stdio: 'ignore' });
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  try {
    for (const [width, open, dock] of [
      [1440, false, {}], [390, false, {}],
      [1440, true, { desktop: { side: 'right', width: 2000 } }],
      [1440, true, { desktop: { side: 'bottom', height: 2000 } }],
      [1440, true, { desktop: { side: 'bottom', height: 0 } }],
      [390, true, { mobile: { height: 50 } }],
      [390, true, { mobile: { height: 2000 } }],
      [1920, true, { desktop: { side: 'left', width: 2000 } }],
    ]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
      await page.addInitScript(({ open, dock }) => {
        localStorage.setItem('owasp-detail-open', String(open));
        localStorage.setItem('owasp-dock-layout', JSON.stringify(dock));
        window.cls = 0;
        new PerformanceObserver(list => { for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.cls += entry.value; }).observe({ type: 'layout-shift', buffered: true });
        window.firstBoxes = [];
        const sample = () => {
          const matrix = document.querySelector('.timeline-panel');
          if (matrix && document.querySelector('link[rel="stylesheet"]')?.sheet) {
            const { x, y, width, height } = matrix.getBoundingClientRect();
            window.firstBoxes.push({ x, y, width, height });
          }
          if (!matrix || document.documentElement.classList.contains('booting')) requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      }, { open, dock });
      await page.route('**/app.js', async route => {
        await new Promise(resolve => setTimeout(resolve, 250));
        await route.continue();
      });
      await page.goto('http://localhost:4210/');
      await page.locator('.risk-card').first().waitFor();
      await page.waitForTimeout(350);
      assert.equal(await page.locator('#detail-modal').evaluate(dialog => dialog.open), open);
      const metrics = await page.evaluate(() => {
        const matrix = document.querySelector('.timeline-panel').getBoundingClientRect();
        return { cls: window.cls, frames: window.firstBoxes.length, delta: Math.max(0, ...window.firstBoxes.flatMap(box => ['x', 'y', 'width', 'height'].map(key => Math.abs(box[key] - matrix[key])))) };
      });
      assert.ok(metrics.frames > 2);
      assert.ok(metrics.cls < .001, JSON.stringify({ width, open, dock, ...metrics }));
      assert.ok(metrics.delta < 1, JSON.stringify({ width, open, dock, ...metrics }));
      assert.equal(await page.evaluate(() => document.getAnimations().length), 0);
      await page.close();
    }
  } finally { await browser.close(); server.kill(); }
});
