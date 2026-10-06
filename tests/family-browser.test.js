import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';

// Optional real Chrome suite: MOTION_PLAYWRIGHT points to an installed Playwright module.
test('family crossfade preserves chrome geometry and paints every frame in ES/EN and reduced motion', { skip: !process.env.MOTION_PLAYWRIGHT }, async () => {
  const { chromium } = await import(process.env.MOTION_PLAYWRIGHT);
  const server = spawn('python3', ['-m', 'http.server', '4179', '-d', 'dist'], { stdio: 'ignore' });
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const measurements = [];
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } });
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto('http://localhost:4179/#/web/2025/A01');
      await page.waitForTimeout(1250);
      for (const language of ['es', 'en']) {
        await page.selectOption('#language-select', language);
        await page.waitForTimeout(400);
        for (const family of ['llm', 'web']) {
          const result = await page.evaluate(async (family) => {
            const selectors = ['.brand', '#family-nav', '#risk-search', '#edition-options', '.timeline-panel'];
            const boxes = () => selectors.map((selector) => {
              const { x, y, width, height } = document.querySelector(selector).getBoundingClientRect();
              return { selector, x, y, width, height };
            });
            const before = boxes();
            const frames = [];
            const button = document.querySelector(`[data-family="${family}"]`);
            button.focus();
            button.click();
            await new Promise((resolve) => {
              const start = performance.now();
              const sample = () => {
                const snapshot = document.querySelector('.family-snapshot');
                const oldOpacity = snapshot ? Number(getComputedStyle(snapshot).opacity) : 0;
                const columns = [...document.querySelectorAll('#timeline-grid > .edition-column')];
                const newOpacity = Math.max(...columns.map((column) => Number(getComputedStyle(column).opacity)));
                const maxDelta = Math.max(...boxes().flatMap((box, index) => ['x', 'y', 'width', 'height'].map((key) => Math.abs(box[key] - before[index][key]))));
                frames.push({ oldOpacity, newOpacity, maxDelta });
                if (performance.now() - start < 650) requestAnimationFrame(sample);
                else resolve();
              };
              requestAnimationFrame(sample);
            });
            return { before, after: boxes(), frames, focusRetained: document.activeElement === button, snapshots: document.querySelectorAll('.family-snapshot').length };
          }, family);
          assert.ok(result.frames.length >= 10);
          assert.ok(result.frames.every((frame) => frame.maxDelta === 0), JSON.stringify(result));
          assert.ok(result.frames.every((frame) => frame.oldOpacity + frame.newOpacity > .4), JSON.stringify(result));
          assert.ok(result.focusRetained);
          assert.equal(result.snapshots, 0);
          measurements.push({ width, language, family, ...result });
          if (language === 'es') await page.screenshot({ path: `/workspace/tmp/owasp-family-${family}-${width}.png`, fullPage: true });
        }
      }
      await page.locator('.connector-hit').first().hover({ force: true });
      assert.ok(await page.locator('#connector-layer > .is-highlighted').count() > 0);
      await page.locator('.risk-focus').first().focus();
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(100);
      assert.ok(await page.locator('.is-selected .risk-focus').evaluate((button) => button === document.activeElement));
      await page.locator('.is-selected .risk-focus').dblclick({ force: true });
      await page.waitForTimeout(100);
      assert.ok(await page.locator('#detail-modal').evaluate((dialog) => dialog.open));
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      assert.equal(await page.locator('#detail-modal').evaluate((dialog) => dialog.open), false);
      assert.deepEqual(errors, []);
      await page.close();
    }
    const page = await browser.newPage({ reducedMotion: 'reduce' });
    await page.goto('http://localhost:4179');
    await page.locator('[data-family="llm"]').click();
    await page.waitForTimeout(50);
    assert.equal(await page.evaluate(() => document.getAnimations().length), 0);
    assert.equal(await page.locator('.family-snapshot').count(), 0);
    await page.close();
    await writeFile('/workspace/tmp/owasp-family-measurements.json', JSON.stringify(measurements, null, 2));
    console.log(measurements.map(({ width, language, family, frames }) => `${width}px ${language} → ${family}: ${frames.length} frames, chrome delta 0px, no blank frame`).join('\n'));
  } finally {
    await browser.close();
    server.kill();
  }
});
