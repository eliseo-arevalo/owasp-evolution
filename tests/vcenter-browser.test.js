import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';

test('Chrome safely centers the matrix and keeps connectors attached across viewport, family and dock changes', { skip: !process.env.MOTION_PLAYWRIGHT }, async () => {
  const { chromium } = await import(process.env.MOTION_PLAYWRIGHT);
  const server = spawn('python3', ['-m', 'http.server', '4195', '-d', 'dist'], { stdio: 'ignore' });
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const measurements = [];
  try {
    const page = await browser.newPage();
    await page.goto('http://localhost:4195');
    await page.waitForTimeout(1300);
    for (const [width, height] of [[1440,800], [1440,900], [1440,1000], [1440,1200], [1024,768], [390,844]]) {
      if (width <= 640 && await page.locator('#detail-modal').evaluate(el => el.open)) {
        await page.locator('.detail-back').click();
        await page.waitForFunction(() => !document.querySelector('#detail-modal').open);
      }
      await page.setViewportSize({ width, height });
      for (const theme of ['light', 'dark']) {
        await page.locator('#theme-select').click(); await page.locator(`[data-theme-choice="${theme}"]`).click();
        for (const family of ['web', 'llm']) {
          await page.locator(`[data-family="${family}"]`).click();
          await page.waitForTimeout(500);
          const chrome = await page.locator('.toolbar').boundingBox();
          const total = await page.locator('.edition-toggle').count();
          for (const count of [2,3,4].filter(n => n <= total)) {
            while (await page.locator('.edition-toggle[aria-pressed="true"]').count() > count) {
              await page.locator('.edition-toggle[aria-pressed="true"]').first().click();
              await page.waitForTimeout(250);
            }
            while (await page.locator('.edition-toggle[aria-pressed="true"]').count() < count) {
              await page.locator('.edition-toggle[aria-pressed="false"]').first().click();
              await page.waitForTimeout(250);
            }
            assert.deepEqual(await page.locator('.toolbar').boundingBox(), chrome);
            for (const dock of ['closed', 'bottom', 'left', 'right']) {
              if (dock === 'closed') {
                await page.evaluate(() => { if (document.querySelector('#detail-modal').open) document.querySelector('.detail-back').click(); });
              } else {
                if (!await page.locator('#detail-modal').evaluate(el => el.open)) await page.locator('.risk-detail').first().click();
                if (width > 760) { await page.locator('[data-action="overflow"]').click(); await page.locator(`#dock-select [data-dock="${dock}"]`).click(); }
                if (width > 640) {
                  await page.locator('#dock-resizer').focus();
                  await page.keyboard.press('ArrowUp');
                }
              }
              await page.waitForTimeout(300);
              assert.equal(await page.locator('.explorer-shell').evaluate(el => el.classList.contains('has-detail')), dock !== 'closed');
              const m = await page.evaluate(() => {
                const area = document.querySelector('.timeline-scroll');
                area.scrollTop = 0;
                const box = area.getBoundingClientRect();
                const stage = document.querySelector('#timeline-stage').getBoundingClientRect();
                const grid = document.querySelector('#timeline-grid').getBoundingClientRect();
                let error = 0;
                for (const path of document.querySelectorAll('#connector-layer > path[data-edge]')) {
                  const [from,to] = path.dataset.edge.split('>');
                  const a = document.querySelector(`.risk-card[data-key="${from}"]`).getBoundingClientRect();
                  const b = document.querySelector(`.risk-card[data-key="${to}"]`).getBoundingClientRect();
                  const n = path.getAttribute('d').match(/-?[\d.]+/g).map(Number);
                  error = Math.max(error, Math.abs(n[0] - (a.right-stage.left)), Math.abs(n[1] - (a.top-stage.top+a.height/2)), Math.abs(n[6] - (b.left-stage.left)), Math.abs(n[7] - (b.top-stage.top+b.height/2)));
                }
                return { top: grid.top-box.top, bottom: box.top+area.clientHeight-grid.bottom, fits: grid.height <= area.clientHeight-2, error, contentHeight: grid.height, available: area.clientHeight, actualDock: document.querySelector('.explorer-shell').dataset.dock };
              });
              const context = { width,height,theme,family,count,dock,...m };
              assert.ok(m.fits ? Math.abs(m.top-m.bottom) <= 2 : Math.abs(m.top-1) <= 1, JSON.stringify(context));
              assert.ok(m.error < 1, JSON.stringify(context));
              measurements.push(context);
              if (theme === 'light' && (count === 3 || family === 'llm' && count === 2) && ((width === 1440 && height === 1000 && family === 'web' && ['closed','bottom'].includes(dock)) || (width === 1440 && height === 1200 && family === 'llm' && dock === 'closed') || (width === 390 && family === 'web' && dock === 'closed'))) {
                await page.screenshot({ path: `/workspace/tmp/owasp-vcenter-${width}x${height}-${family}-${dock}.png` });
              }
            }
            if (width <= 640) {
              await page.locator('.detail-back').click();
              await page.waitForFunction(() => !document.querySelector('#detail-modal').open);
            }
          }
        }
      }
    }
    await writeFile('/workspace/tmp/owasp-vcenter-measurements.json', JSON.stringify(measurements, null, 2));
    console.log(`Vertical geometry and connectors verified in ${measurements.length} cases`);
  } finally { await browser.close(); server.kill(); }
});
