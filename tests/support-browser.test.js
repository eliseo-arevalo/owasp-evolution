import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

test('support links switch EN/ES, retain chrome geometry and fit narrow screens', { skip: !process.env.MOTION_PLAYWRIGHT }, async () => {
  const { chromium } = await import(process.env.MOTION_PLAYWRIGHT);
  const server = spawn('python3', ['-m', 'http.server', '4209', '-d', 'dist'], { stdio: 'ignore' });
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  try {
    for (const width of [1440, 390, 320]) {
      const theme = width === 1440 ? 'dark' : 'light';
      const page = await browser.newPage({ viewport: { width, height: width === 1440 ? 900 : 844 }, colorScheme: theme, reducedMotion: 'reduce' });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      const requests = []; page.on('request', request => { if (request.url().includes('ko-fi.com')) requests.push(request.url()); });
      await page.goto('http://localhost:4209/web/2025/a01-broken-access-control/');
      await page.waitForSelector('#detail-title');
      const geometry = () => page.evaluate(() => ['.topbar', '.toolbar', '#family-nav', '#language-select', '#theme-select', '.support-button'].map(selector => {
        const { x, y, width, height } = document.querySelector(selector).getBoundingClientRect();
        return { x, y, width, height };
      }));
      const before = await geometry();
      for (const language of ['es', 'en', 'es']) {
        await page.locator(`[data-language="${language}"]`).click();
        const label = language === 'es' ? 'Invítame un café' : 'Buy me a coffee';
        for (const selector of ['.support-button', '#detail-sources .support-link']) {
          const link = page.locator(selector);
          assert.equal(await link.getAttribute('href'), 'https://ko-fi.com/oclazi');
          assert.equal(await link.getAttribute('rel'), 'noopener');
          assert.equal(await link.getAttribute('target'), '_blank');
          assert.equal(await link.getAttribute('aria-label'), label);
        }
        assert.equal(await page.locator('.support-button').getAttribute('data-tooltip'), label);
        assert.equal(await page.locator('#detail-sources .support-link').textContent(), label);
        assert.deepEqual(await geometry(), before, '0px chrome shift');
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      }
      const button = page.locator('.support-button');
      assert.deepEqual((await button.boundingBox()).width, 32);
      assert.equal((await button.boundingBox()).height, 32);
      await page.keyboard.press('Tab');
      await button.focus();
      await page.waitForSelector('#shared-tooltip:popover-open');
      assert.equal(await page.locator('#shared-tooltip').textContent(), 'Invítame un café');
      assert.deepEqual(await geometry(), before, 'tooltip keeps chrome stationary');
      await page.locator('.brand').click();
      if (width !== 320) await page.screenshot({ path: `/workspace/tmp/owasp-kofi-${width}-${theme}.png`, fullPage: true });
      assert.deepEqual(requests, [], 'no third-party request before clicking');
      assert.deepEqual(errors, []);
      await page.close();
    }
    const page = await browser.newPage({ javaScriptEnabled: false });
    for (const prefix of ['', '/es']) {
      await page.goto(`http://localhost:4209${prefix}/web/2025/a01-broken-access-control/`);
      assert.ok(await page.locator('#prerender #detail-sources .support-link').isVisible());
    }
    await page.close();
  } finally { await browser.close(); server.kill(); }
});
