import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { catalog } from '../src/data.js';
import { pathFor } from '../src/routes.js';

const enabled = Boolean(process.env.MOTION_PLAYWRIGHT);
const action = (page, name) => page.locator(`#detail-page [data-action="${name}"]`);
const closed = page => page.waitForFunction(() => !document.querySelector('#detail-modal').open);
const focused = (page, key) => page.waitForFunction(key => document.activeElement?.closest('.risk-card')?.dataset.key === key, key);
const fullscreen = async page => {
  await page.waitForFunction(() => document.querySelector('#detail-modal').matches(':modal'));
  const metrics = await page.locator('#detail-modal').evaluate(dialog => {
    const box = dialog.getBoundingClientRect();
    return { x: box.x, y: box.y, width: box.width, height: box.height, vw: innerWidth, vh: innerHeight,
      overflow: dialog.scrollWidth - dialog.clientWidth, modal: dialog.getAttribute('aria-modal'),
      lock: getComputedStyle(document.body).position };
  });
  assert.equal(metrics.x, 0); assert.equal(metrics.y, 0);
  assert.equal(metrics.width, metrics.vw); assert.equal(metrics.height, metrics.vh);
  assert.equal(metrics.overflow, 0); assert.equal(metrics.modal, 'true'); assert.equal(metrics.lock, 'fixed');
  assert.equal(await page.locator('#dock-resizer').isVisible(), false);
  assert.equal(await action(page, 'fullscreen').isVisible(), false);
  for (const name of ['close', 'previous', 'next', 'overflow']) {
    await action(page, name).evaluate(button => Promise.all(button.getAnimations().map(animation => animation.finished.catch(() => {}))));
    const box = await action(page, name).boundingBox();
    assert.ok(box.width >= 44 && box.height >= 44, `${name}: ${JSON.stringify(box)}`);
  }
};

test('Chrome: mobile fullscreen, history, focus, scrolling and actions at 375×812 and 390×844', { skip: !enabled }, async () => {
  const { chromium } = await import(process.env.MOTION_PLAYWRIGHT);
  const server = spawn('python3', ['-m', 'http.server', '4212', '-d', 'dist'], { stdio: 'ignore' });
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  try {
    for (const [width, height] of [[375, 812], [390, 844]]) {
      const page = await browser.newPage({ viewport: { width, height }, isMobile: true, hasTouch: true, reducedMotion: width === 375 ? 'reduce' : 'no-preference' });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto('http://localhost:4212/');
      const item = page.locator('.risk-card[data-key="2025:A02"] .risk-focus');
      await item.waitFor();
      assert.equal(await page.locator('#detail-modal').evaluate(d => d.open), false);
      const home = page.url();
      // Give the underlying document a scroll range to verify the fixed-body lock.
      await page.evaluate(() => { document.body.style.paddingBottom = '400px'; window.scrollTo(0, 70); });
      const scrollY = await page.evaluate(() => window.scrollY);
      await item.tap();
      await fullscreen(page);
      assert.equal(await page.locator('#detail-modal').getAttribute('role'), 'dialog');
      assert.equal(await page.locator('#detail-modal').getAttribute('aria-labelledby'), 'detail-title');
      const locked = await page.evaluate(() => document.body.getBoundingClientRect().top);
      await page.mouse.wheel(0, 300);
      assert.equal(await page.evaluate(() => document.body.getBoundingClientRect().top), locked);
      // Tab and reverse Tab stay in the modal, even from its non-tabstop title.
      await page.locator('#detail-title').focus();
      for (const key of ['Shift+Tab', ...Array(22).fill('Tab')]) {
        await page.keyboard.press(key);
        assert.equal(await page.evaluate(() => document.querySelector('#detail-modal').contains(document.activeElement)), true);
      }
      await action(page, 'close').tap(); await closed(page); await focused(page, '2025:A02');
      assert.equal(await page.evaluate(() => getComputedStyle(document.body).position), 'static');
      assert.equal(await page.evaluate(() => window.scrollY), scrollY);
      assert.equal(page.url(), home);
      await item.tap(); await fullscreen(page);
      await page.keyboard.press('Escape'); await closed(page); await focused(page, '2025:A02');
      await item.tap(); await fullscreen(page);
      await action(page, 'next').tap();
      await page.waitForFunction(() => document.querySelector('.is-selected').dataset.key === '2025:A03');
      await fullscreen(page);
      await action(page, 'previous').tap();
      await page.waitForFunction(() => document.querySelector('.is-selected').dataset.key === '2025:A02');
      await page.locator('#detail-page .detail-section-nav a[href="#detail-lineage"]').tap();
      await page.waitForFunction(() => document.querySelector('#detail-page .detail-section-nav a[aria-current]').hash === '#detail-lineage');
      await page.locator('#detail-page .detail-body').evaluate(body => new Promise(resolve => {
        let last = body.scrollTop, still = 0;
        const frame = () => {
          still = body.scrollTop === last ? still + 1 : 0;
          last = body.scrollTop;
          if (still >= 6) resolve(); else requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      }));
      await action(page, 'overflow').tap();
      assert.equal(await page.locator('#dock-select').isVisible(), false);
      assert.equal(await page.locator('#dock-select button').first().isDisabled(), true);
      const [download] = await Promise.all([page.waitForEvent('download'), action(page, 'markdown').tap()]);
      assert.match(download.suggestedFilename(), /\.md$/);
      // Back closes in one step after navigation and restores the original trigger.
      await action(page, 'next').tap();
      await page.waitForFunction(() => document.querySelector('.is-selected').dataset.key === '2025:A03');
      await page.goBack(); await closed(page); await focused(page, '2025:A02');
      assert.equal(page.url(), home);
      await page.goForward(); await fullscreen(page);
      await page.setViewportSize({ width: height, height: width }); await fullscreen(page);
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.waitForFunction(() => !document.querySelector('#detail-modal').matches(':modal'));
      assert.equal(await page.evaluate(() => document.body.classList.contains('mobile-detail-open')), false);
      for (const dock of ['right', 'bottom', 'left']) {
        await page.waitForTimeout(350); // Finish viewport/grid transitions before opening a positioned menu.
        await action(page, 'overflow').click();
        await page.locator(`#dock-select [data-dock="${dock}"]`).click();
        assert.equal(await page.locator('.explorer-shell').getAttribute('data-dock'), dock);
        assert.equal(await page.locator('#dock-resizer').isVisible(), true);
      }
      await page.setViewportSize({ width, height }); await fullscreen(page);
      await action(page, 'close').tap(); await closed(page);
      await page.setViewportSize({ width: 1440, height: 900 });
      assert.equal(await page.evaluate(() => document.body.classList.contains('mobile-detail-open')), false);
      await page.setViewportSize({ width, height });
      // Saved open choices never hide the matrix on mobile reload; deep links do open.
      await page.evaluate(() => localStorage.setItem('owasp-detail-open', 'true'));
      await page.goto(home); await item.waitFor();
      assert.equal(await page.locator('#detail-modal').evaluate(d => d.open), false);
      const deep = pathFor({ family: 'web', year: 2025, id: 'A02' }, catalog);
      await page.goto('http://localhost:4212' + deep); await fullscreen(page);
      await action(page, 'next').tap();
      await action(page, 'close').tap(); await closed(page);
      assert.equal(await page.evaluate(() => document.body.classList.contains('mobile-detail-open')), false);
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); server.kill(); }
});

test('Chrome: arrow selection moves the focused matrix row with detail open or closed', { skip: !enabled }, async () => {
  const { chromium } = await import(process.env.MOTION_PLAYWRIGHT);
  const server = spawn('python3', ['-m', 'http.server', '4213', '-d', 'dist'], { stdio: 'ignore' });
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    await page.goto('http://localhost:4213/');
    for (const open of [true, false]) {
      assert.equal(await page.locator('#detail-modal').evaluate(d => d.open), open);
      await page.locator('.risk-card[data-key="2025:A02"] .risk-focus').click();
      for (const [key, selected] of [['ArrowDown', '2025:A03'], ['ArrowUp', '2025:A02'], ['End', '2025:A10'], ['Home', '2025:A01']]) {
        await page.keyboard.press(key); await focused(page, selected);
        assert.equal(await page.locator('.is-selected').getAttribute('data-key'), selected);
        assert.equal(await page.locator('.risk-focus[tabindex="0"]').count(), 1);
        assert.equal(await page.locator('.is-selected .risk-focus').getAttribute('tabindex'), '0');
      }
      if (open) { await action(page, 'close').click(); await closed(page); }
    }
  } finally { await browser.close(); server.kill(); }
});
