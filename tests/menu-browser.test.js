import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

test('menus, mobile names and locked detail emphasis in Chrome', { skip: !process.env.MOTION_PLAYWRIGHT }, async () => {
  const { chromium } = await import(process.env.MOTION_PLAYWRIGHT);
  const server = spawn('python3', ['-m', 'http.server', '4186', '-d', 'dist'], { stdio: 'ignore' });
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  try {
    for (const width of [1440, 390]) for (const theme of ['dark', 'light']) {
      const page = await browser.newPage({ viewport: { width, height: width === 390 ? 844 : 900 }, locale: 'en-US', reducedMotion: 'reduce', hasTouch: width === 390 });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.goto('http://localhost:4186/#/web/2025/A01');
      if (await page.locator('html').getAttribute('lang') !== 'en') await page.locator('[data-language="en"]').click();
      const button = page.locator('#theme-select');
      await button.focus(); await page.keyboard.press('ArrowDown');
      assert.equal(await page.evaluate(() => document.activeElement.dataset.themeChoice), 'system');
      await page.keyboard.press('End');
      assert.equal(await page.evaluate(() => document.activeElement.dataset.themeChoice), 'light');
      await page.keyboard.press('Home'); await page.keyboard.press('ArrowUp');
      assert.equal(await page.evaluate(() => document.activeElement.dataset.themeChoice), 'light');
      await page.keyboard.press('d');
      assert.equal(await page.evaluate(() => document.activeElement.dataset.themeChoice), 'dark');
      await page.keyboard.press('Escape');
      assert.equal(await page.evaluate(() => document.activeElement.id), 'theme-select');
      await page.keyboard.press('Space'); await page.keyboard.press(theme === 'dark' ? 'd' : 'l'); await page.keyboard.press('Enter');
      assert.equal(await page.locator('html').getAttribute('data-theme'), theme);
      assert.equal(await button.getAttribute('aria-expanded'), 'false');
      await button.click(); await page.locator('.brand').click();
      assert.equal(await button.getAttribute('aria-expanded'), 'false');
      await page.locator('#export-button').focus(); await page.keyboard.press('ArrowUp');
      assert.equal(await page.evaluate(() => document.activeElement.dataset.export), 'md');
      await page.keyboard.press('c');
      assert.equal(await page.evaluate(() => document.activeElement.dataset.export), 'csv');
      await page.keyboard.press('Escape');
      await button.focus(); await page.keyboard.press('ArrowDown');
      await page.keyboard.press(theme === 'dark' ? 'd' : 'l'); await page.keyboard.press('Space');
      assert.equal(await button.getAttribute('aria-expanded'), 'false');
      assert.equal(await page.locator('html').getAttribute('data-theme'), theme);
      assert.equal(await page.locator('select').count(), 0);
      assert.ok(await page.locator('.header-meta').evaluate(header => ['#theme-select', '#export-button', '#language-select', '.search-control'].every(selector => header.querySelector(selector).getBoundingClientRect().height === 32))); 
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      if (width === 390) {
        const search = await page.locator('.search-wrap').boundingBox();
        assert.ok(search.width > 340);
        assert.ok(await page.locator('.risk-name').evaluateAll(names => names.every(name => getComputedStyle(name).webkitLineClamp === '2' && name.getBoundingClientRect().height <= 30 && name.closest('button').title.includes(name.textContent))));
      }
      await page.locator('.risk-detail').click();
      await page.locator('.risk-card:not(.is-selected) .risk-focus').first().focus();
      await page.locator('.risk-card:not(.is-selected)').first().dispatchEvent('pointerover', { pointerType: width === 390 ? 'touch' : 'mouse' });
      assert.equal(await page.locator('.is-selected.is-anchor').count(), 1);
      const detailMenu = width === 390 ? page.locator('[data-action=overflow]') : button;
      await detailMenu.focus(); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Escape');
      assert.equal(await page.locator('#detail-modal').evaluate(panel => panel.open), true);
      if (width === 390) assert.equal(await page.locator('#dock-select').isVisible(), false);
      assert.deepEqual(errors, []);
      await page.screenshot({ path: `/workspace/tmp/owasp-menu-${width}-${theme}.png`, fullPage: true });
      await detailMenu.click();
      await page.screenshot({ path: `/workspace/tmp/owasp-menu-${width}-${theme}-open.png`, fullPage: true });
      await page.close();
    }
  } finally { await browser.close(); server.kill(); }
});
