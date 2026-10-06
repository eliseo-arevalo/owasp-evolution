import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';

test('Chrome downloads all formats and renders standalone images at desktop and 390px', { skip: !process.env.MOTION_PLAYWRIGHT }, async () => {
  const { chromium } = await import(process.env.MOTION_PLAYWRIGHT);
  const server = spawn('python3', ['-m', 'http.server', '4182', '-d', 'dist'], { stdio: 'ignore' });
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce', acceptDownloads: true });
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto('http://localhost:4182/#/web/2025/A01');
      await page.locator(`[data-language="${width === 390 ? 'en' : 'es'}"]`).click();
      await page.locator('#theme-select').click(); await page.locator(`[data-theme-choice="${width === 390 ? 'light' : 'dark'}"]`).click();
      await page.waitForTimeout(200);
      const before = await page.locator('#timeline-stage').boundingBox();
      await page.locator('#export-button').focus();
      await page.keyboard.press('ArrowDown');
      assert.equal(await page.locator('#export-button').getAttribute('aria-expanded'), 'true');
      assert.deepEqual(await page.locator('#timeline-stage').boundingBox(), before);
      await page.keyboard.press('End');
      assert.equal(await page.evaluate(() => document.activeElement.dataset.export), 'md');
      await page.keyboard.press('Escape');
      assert.equal(await page.evaluate(() => document.activeElement.id), 'export-button');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      for (const format of ['png', 'svg', 'csv', 'json', 'md']) {
        await page.locator('#export-button').click();
        const pending = page.waitForEvent('download');
        await page.locator(`[data-export="${format}"]`).click();
        const download = await pending;
        assert.equal(download.suggestedFilename(), `owasp-evolution-web-2017-2021-2025.${format}`);
        const path = `/workspace/tmp/owasp-export-${width === 1440 ? 'sample' : 'mobile'}.${format}`;
        await download.saveAs(path);
        const data = await readFile(path);
        assert.ok(data.length > 100);
        if (format === 'png' || format === 'svg') {
          const result = await page.evaluate(async ({ encoded, format }) => {
            const image = new Image(); image.src = `data:image/${format === 'svg' ? 'svg+xml' : 'png'};base64,${encoded}`;
            await image.decode();
            const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
            const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
            const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
            const colors = new Set(); let connections = 0;
            for (let i = 0; i < pixels.length; i += 4) {
              colors.add(`${pixels[i]},${pixels[i+1]},${pixels[i+2]}`);
              if (Math.max(pixels[i], pixels[i+1], pixels[i+2]) - Math.min(pixels[i], pixels[i+1], pixels[i+2]) > 25) connections++;
            }
            return { width: image.width, height: image.height, colors: colors.size, connections };
          }, { encoded: data.toString('base64'), format });
          assert.ok(result.colors > 20 && result.connections > 20, JSON.stringify(result));
          if (format === 'png') assert.equal(result.width, (Math.ceil(before.width) + 32) * 2);
          if (format === 'svg') {
            assert.ok(data.toString().includes('2025</text>'));
            assert.ok(data.toString().includes('Broken Access Control'));
            assert.ok(data.toString().includes('OWASP Evolution · OWASP Top 10'));
          assert.doesNotMatch(data.toString(), /unofficial project|proyecto no oficial/);
          }
        }
      }
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); server.kill(); }
});
