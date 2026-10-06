import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

// Set MOTION_PLAYWRIGHT to a Playwright module path to run the real Chrome checks.
test('Chrome preserves columns and paints every toggle frame at desktop and mobile sizes', { skip: !process.env.MOTION_PLAYWRIGHT }, async () => {
  const { chromium } = await import(process.env.MOTION_PLAYWRIGHT);
  const server = spawn('python3', ['-m', 'http.server', '4178', '-d', 'dist'], { stdio: 'ignore' });
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } });
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto('http://localhost:4178');
      await page.waitForTimeout(1250);
      for (const adding of [true, false, true, false]) {
        const result = await page.evaluate(async (adding) => {
          const grid = document.querySelector('#timeline-grid');
          const chrome = ['.topbar', '.toolbar'].map(selector => document.querySelector(selector).getBoundingClientRect().toJSON());
          const old = new Map([...grid.children].map((column) => [column.dataset.year, column]));
          const input = document.querySelector(`#edition-options button[aria-pressed="${adding ? 'false' : 'true'}"]`);
          const year = input.dataset.year;
          input.click();
          const frames = [];
          await new Promise((resolve) => {
            const start = performance.now();
            const sample = () => {
              const visible = [...grid.children].filter((column) => {
                const box = column.getBoundingClientRect();
                return box.width > 0 && box.height > 0 && Number(getComputedStyle(column).opacity) > .05;
              });
              const strokes = [...document.querySelectorAll('#connector-layer > path:not(.connector-hit)')].filter((path) => Number(getComputedStyle(path).opacity) > .05 && path.getAttribute('d'));
              const chromeShift = Math.max(...['.topbar', '.toolbar'].flatMap((selector, index) => { const box = document.querySelector(selector).getBoundingClientRect(); return ['x', 'y', 'width', 'height'].map(key => Math.abs(box[key] - chrome[index][key])); }));
              frames.push({ chromeShift, count: visible.length, connectors: strokes.length, opacity: Number(getComputedStyle(grid).opacity) });
              if (performance.now() - start < 350) requestAnimationFrame(sample);
              else resolve();
            };
            sample();
          });
          return { year, frames, retained: [...grid.children].every((column) => !old.has(column.dataset.year) || old.get(column.dataset.year) === column), leaving: document.querySelectorAll('.is-leaving').length };
        }, adding);
        assert.ok(result.retained, `DOM identity at ${width}`);
        assert.ok(result.frames.length >= 5);
        assert.ok(result.frames.every((frame) => frame.count > 0 && frame.connectors > 0 && frame.opacity === 1 && frame.chromeShift === 0), JSON.stringify(result));
        assert.equal(result.leaving, 0);
        console.log(`${width}px ${adding ? 'add' : 'remove'} ${result.year}: ${result.frames.length} frames, no blank frame, DOM retained`);
      }
      await page.locator('.edition-toggle').first().focus();
      await page.keyboard.press('ArrowRight');
      assert.equal(await page.locator('.edition-toggle').nth(1).evaluate(el => el === document.activeElement), true);
      await page.keyboard.press('Space');
      await page.waitForTimeout(300);
      while (await page.locator('.edition-toggle[aria-pressed="true"]').count() > 1) {
        await page.locator('.edition-toggle[aria-pressed="true"]').first().click();
        await page.waitForTimeout(250);
      }
      await page.locator('.edition-toggle[aria-pressed="true"]').click();
      assert.equal(await page.locator('.edition-toggle[aria-pressed="true"]').count(), 1);
      assert.ok(await page.locator('#edition-feedback').textContent());
      await page.locator('.edition-toggle[aria-pressed="false"]').first().click();
      await page.waitForTimeout(300);
      // Hover focus, keyboard activation, double click and reduced motion still work.
      await page.locator('.connector-hit').first().hover({ force: true });
      assert.ok(await page.locator('.connector-layer > .is-highlighted').count() > 0);
      await page.locator('.risk-focus').first().focus();
      await page.keyboard.press('Enter');
      await page.waitForTimeout(100);
      await page.locator('.risk-focus').first().dblclick({ force: true });
      await page.waitForTimeout(100);
      assert.equal(await page.locator('#detail-modal').evaluate((dialog) => dialog.open), true);
      assert.deepEqual(errors, []);
      await page.close();
    }
    const page = await browser.newPage({ reducedMotion: 'reduce' });
    await page.goto('http://localhost:4178');
    assert.equal(await page.evaluate(() => document.getAnimations().length), 0);
    await page.locator('#edition-options button[aria-pressed="false"]').first().evaluate((input) => input.click());
    assert.equal(await page.evaluate(() => document.getAnimations().length), 0);
    await page.close();
  } finally {
    await browser.close();
    server.kill();
  }
});
