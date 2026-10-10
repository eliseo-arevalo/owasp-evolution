import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { catalog } from '../src/data.js';
import { pathFor } from '../src/routes.js';

const enabled = Boolean(process.env.MOTION_PLAYWRIGHT);
async function setup(port) {
  const { chromium } = await import(process.env.MOTION_PLAYWRIGHT);
  const server = spawn('python3', ['-m', 'http.server', String(port), '-d', 'dist'], { stdio: 'ignore' });
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  return { browser, server, url: (family, year, id, language = 'es') => `http://localhost:${port}${pathFor({family, year, id}, catalog, language)}` };
}
const menu = page => page.locator('#detail-page [data-action="overflow"]');
const action = (page, name) => page.locator(`#detail-page [data-action="${name}"]`);
const shot = (page, name) => page.screenshot({ path: `/workspace/tmp/owasp-v4-${name}.png` });

test('Chrome v4: feedback, shared delayed tooltip, overflow APG actions, scroll nav and timeline navigation', { skip: !enabled }, async () => {
  const { browser, server, url } = await setup(4197);
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, colorScheme: 'dark' });
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      localStorage.setItem('owasp-theme', 'dark');
      window.copyFailure = false;
      Object.defineProperty(navigator, 'clipboard', { value: { writeText: async text => {
        if (window.copyFailure) throw new Error('clipboard unavailable');
        window.copiedURL = text;
      } } });
    });
    await page.goto(url('web', 2025, 'A01'));
    await page.locator('#detail-modal[open]').waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(600);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'detail-title');
    assert.equal(await page.locator('#shared-tooltip').isVisible(), false);
    assert.equal(await page.locator('[role="tooltip"]').count(), 1);
    assert.equal(await page.locator('.detail-header .detail-summary').count(), 0);
    assert.equal(await page.locator('.detail-actions > button').count(), 4);
    assert.equal(await action(page, 'copy').isVisible(), false);
    assert.equal(await action(page, 'markdown').isVisible(), false);
    assert.equal(await page.locator('#detail-title').evaluate(title => title.getBoundingClientRect().height / parseFloat(getComputedStyle(title).lineHeight)), 1);
    await shot(page, 'docked-a01-dark-1440');
    // Hover delay and instant dismissal. Programmatic heading focus stays silent.
    await action(page, 'close').hover();
    await page.waitForTimeout(150);
    assert.equal(await page.locator('#shared-tooltip').isVisible(), false);
    await page.locator('#shared-tooltip').waitFor({ state: 'visible' });
    assert.ok((await page.locator('#shared-tooltip').textContent()).includes('Esc'));
    await page.locator('.detail-body').evaluate(body => body.scrollTop = 20);
    await page.locator('#shared-tooltip').waitFor({ state: 'hidden' });
    assert.equal(await page.locator('#shared-tooltip').isVisible(), false);
    await page.mouse.move(800, 100);
    await action(page, 'close').hover();
    await page.locator('#shared-tooltip').waitFor({ state: 'visible' });
    await action(page, 'close').dispatchEvent('pointerdown', { pointerType: 'mouse' });
    assert.equal(await page.locator('#shared-tooltip').isVisible(), false);
    await page.mouse.move(800, 100);
    await page.locator('#detail-title').focus();
    await page.keyboard.press('Shift+Tab');
    await page.locator('#shared-tooltip').waitFor({ state: 'visible' });
    assert.ok((await page.locator('#shared-tooltip').textContent()).includes('Cerrar'));
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#shared-tooltip').isVisible(), false);
    await page.waitForFunction(() => !document.querySelector('#detail-modal').open);
    await page.locator('.is-selected .risk-focus').focus();
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.activeElement.id === 'detail-title');
    await page.waitForTimeout(500);
    assert.equal(await page.locator('#shared-tooltip').isVisible(), false);
    await page.goto(url('web', 2025, 'A01'));
    await page.waitForTimeout(250);
    // Shared menu supports radio states, keyboard movement, hints and focus return.
    await menu(page).focus(); await page.keyboard.press('ArrowDown');
    assert.equal(await page.evaluate(() => document.activeElement.dataset.dock), 'left');
    assert.equal(await page.locator('#detail-menu [role="menuitemradio"]').count(), 3);
    assert.equal(await page.locator('#detail-menu [role="menuitem"]').count(), 3);
    assert.equal(await page.locator('#detail-menu kbd').count(), 4);
    await shot(page, 'overflow-dark-1440');
    await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
    assert.equal(await page.locator('.explorer-shell').getAttribute('data-dock'), 'right');
    assert.equal(await page.locator('[data-dock="right"][role="menuitemradio"]').getAttribute('aria-checked'), 'true');
    assert.equal(await page.locator('[data-dock="right"][role="menuitemradio"]').getAttribute('aria-pressed'), 'true');
    assert.equal(await menu(page).getAttribute('aria-expanded'), 'false');
    assert.equal(await menu(page).evaluate(button => button === document.activeElement), true);
    await menu(page).click(); await action(page, 'dock-bottom').click();
    assert.equal(await page.locator('.explorer-shell').getAttribute('data-dock'), 'bottom');
    await menu(page).click(); await action(page, 'dock-left').click();
    await menu(page).click(); await page.keyboard.press('End');
    assert.equal(await page.evaluate(() => document.activeElement.dataset.action), 'shortcuts');
    await page.keyboard.press('Escape');
    assert.equal(await menu(page).getAttribute('aria-expanded'), 'false');
    // Success/failure feedback is visible, announced and expires; copied icons reset.
    await menu(page).click(); await action(page, 'copy').click();
    assert.equal(await page.evaluate(() => window.copiedURL), url('web', 2025, 'A01'));
    assert.equal(await page.locator('.detail-feedback').textContent(), 'Copiado');
    assert.equal(await page.locator('.detail-announcement').getAttribute('aria-live'), 'polite');
    await page.waitForFunction(() => document.querySelector('.detail-announcement').textContent === 'Copiado');
    assert.equal(await menu(page).locator('svg').getAttribute('data-icon'), 'check');
    assert.equal(await action(page, 'copy').locator('svg').getAttribute('data-icon'), 'check');
    await shot(page, 'copy-feedback-dark-1440');
    await page.waitForTimeout(1600);
    assert.equal(await page.locator('.detail-feedback').isVisible(), false);
    assert.equal(await menu(page).locator('svg').getAttribute('data-icon'), 'dots-three');
    await page.evaluate(() => window.copyFailure = true);
    await menu(page).click(); await action(page, 'copy').click();
    assert.equal(await page.locator('.detail-feedback').textContent(), 'No se pudo copiar el enlace');
    assert.equal(await page.locator('.detail-feedback').isVisible(), true);
    await page.evaluate(() => window.copyFailure = false);
    await menu(page).click();
    const downloading = page.waitForEvent('download');
    await action(page, 'markdown').click();
    assert.equal((await downloading).suggestedFilename(), 'owasp-web-2025-A01.md');
    assert.equal(await page.locator('.detail-feedback').textContent(), 'Descargado');
    await menu(page).click(); await action(page, 'shortcuts').click();
    assert.equal(await page.locator('#shortcuts-dialog').evaluate(dialog => dialog.matches(':modal')), true);
    await page.keyboard.press('Escape');
    assert.equal(await menu(page).evaluate(button => button === document.activeElement), true);
    // Sticky section links track manual scroll as well as smooth navigation.
    for (const section of ['attack', 'example', 'prevention', 'lineage']) {
      await page.locator(`.detail-section-nav a[href="#detail-${section}"]`).click();
      await page.waitForFunction(id => document.querySelector(`.detail-section-nav a[href="#detail-${id}"]`).getAttribute('aria-current') === 'location', section);
    }
    assert.equal(await page.locator('.detail-section-nav').evaluate(nav => getComputedStyle(nav).position), 'sticky');
    await page.locator('.detail-body').evaluate(body => body.scrollTop = 0);
    await page.waitForFunction(() => document.querySelector('.detail-section-nav a[aria-current]').hash === '#detail-overview');
    // Continuous chronological ol, merged branches, rank gains and selected endpoint.
    for (const id of ['A01', 'A03']) {
      await page.goto(url('web', 2025, id));
      await page.locator('.detail-section-nav a[href="#detail-lineage"]').click();
      await page.waitForTimeout(700);
      assert.equal(await page.locator('ol.lineage-list > li').count(), 4);
      assert.equal(await page.locator('.lineage-list > li').evaluateAll(nodes => nodes.map(node => node.dataset.year).join(',')), '2013,2017,2021,2025');
      assert.equal(await page.locator('.lineage-node.is-current .lineage-link').getAttribute('data-key'), `2025:${id}`);
      assert.ok(await page.locator('.lineage-rank[data-movement="up"]').count());
      assert.equal(await page.locator('.lineage-item').evaluateAll(nodes => nodes.every(node => getComputedStyle(node, '::after').content !== 'none')), true);
      if (id === 'A01') {
        assert.equal(await page.locator('.lineage-item[data-year="2017"] .lineage-merge [data-key]').evaluateAll(nodes => nodes.map(node => node.dataset.key).join(',')), '2013:A4,2013:A7');
        assert.ok((await page.locator('.lineage-rank[data-delta="4"]').textContent()).includes('#5 → #1 ↑4'));
        assert.ok(await page.locator('.lineage-rank[data-movement="same"]').count());
      } else {
        assert.equal(await page.locator('.lineage-chip.line-renamed').count(), 1);
        assert.equal(await page.locator('.lineage-chip.line-merged').count(), 1);
      }
      await shot(page, `timeline-${id.toLowerCase()}-docked-dark`);
      await action(page, 'fullscreen').click();
      assert.equal(await action(page, 'fullscreen').getAttribute('aria-pressed'), 'true');
      assert.equal(await page.locator('#detail-modal').evaluate(dialog => dialog.matches(':modal')), true);
      const anim = await action(page, 'fullscreen').evaluate(button => button.getAnimations().map(animation => animation.effect.getTiming().duration));
      assert.ok(anim.includes(120));
      await page.waitForTimeout(300);
      await page.locator('.detail-section-nav a[href="#detail-lineage"]').click();
      await page.waitForFunction(() => document.querySelector('.detail-section-nav a[aria-current]').hash === '#detail-lineage');
      await shot(page, `timeline-${id.toLowerCase()}-fullscreen-dark`);
      const target = id === 'A01' ? '2017:A5' : '2021:A06';
      await page.locator(`.lineage-link[data-key="${target}"]`).click();
      await page.waitForFunction(key => document.querySelector('.lineage-node.is-current .lineage-link').dataset.key === key, target);
      assert.equal(await page.locator('#detail-modal').evaluate(dialog => dialog.open && dialog.matches(':modal')), true);
      const [year, risk] = target.split(':');
      assert.equal(page.url(), url('web', Number(year), risk));
    }
    await page.goto(url('web', 2013, 'A8'));
    await page.locator('.detail-section-nav a[href="#detail-lineage"]').click();
    assert.ok((await page.locator('.lineage-departure').textContent()).includes('Sale del Top 10 en 2017'));
    await page.goto(url('web', 2025, 'A01', 'en'));
    await menu(page).click(); await action(page, 'copy').click();
    assert.equal(await page.locator('.detail-feedback').textContent(), 'Copied');
    await menu(page).click(); await action(page, 'markdown').click();
    assert.equal(await page.locator('.detail-feedback').textContent(), 'Downloaded');
    await page.goto(url('web', 2021, 'A06'));
    await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(300);
    const lines = await page.locator('#detail-title').evaluate(title => title.getBoundingClientRect().height / parseFloat(getComputedStyle(title).lineHeight));
    assert.equal(lines, 2);
    await shot(page, 'docked-a06-two-lines-dark-1440');
    await page.locator('#detail-title').hover();
    await page.locator('#shared-tooltip').waitFor({state:'visible'});
    assert.equal(await page.locator('#shared-tooltip span').textContent(), 'Vulnerable and Outdated Components');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await action(page, 'fullscreen').click();
    assert.equal(await action(page, 'fullscreen').evaluate(button => button.getAnimations().length), 0);
    await browser.newPage().then(async mobile => {
      await mobile.setViewportSize({width:390,height:1000});
      await mobile.emulateMedia({colorScheme:'light',reducedMotion:'reduce'});
      await mobile.addInitScript(() => {
        localStorage.setItem('owasp-theme', 'light');
        localStorage.setItem('owasp-dock-layout', JSON.stringify({mobile:{height:740}}));
      });
      mobile.on('pageerror', error => errors.push(error.message));
      await mobile.goto(url('web', 2025, 'A01'));
      await mobile.locator('.detail-section-nav a[href="#detail-lineage"]').click();
      await mobile.evaluate(() => document.fonts.ready);
      assert.equal(await mobile.locator('.detail-body').evaluate(body => body.scrollWidth - body.clientWidth), 0);
      await shot(mobile, '390-light');
      await menu(mobile).click();
      assert.equal(await mobile.locator('#dock-select').isVisible(), false);
      assert.equal(await mobile.locator('#dock-select button').first().isDisabled(), true);
      await shot(mobile, '390-light-overflow');
      await mobile.close();
    });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); server.kill(); }
});

test('Chrome v4: all Web + LLM editions, 360/420/520 dock widths + fullscreen, both languages, title centers within 2px', { skip: !enabled }, async () => {
  const { browser, server, url } = await setup(4198);
  const measurements = [], errors = [];
  try {
    for (const width of [360, 420, 520, 'fullscreen']) {
      const page = await browser.newPage({viewport:{width:1440,height:1000},colorScheme:'dark',reducedMotion:'reduce'});
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(width => {
        localStorage.setItem('owasp-theme', 'dark');
        localStorage.setItem('owasp-dock-layout', JSON.stringify({desktop:{side:'left',width:width === 'fullscreen' ? 520 : width}}));
      }, width);
      for (const family of Object.values(catalog.families)) for (const edition of family.editions) for (const item of edition.items) for (const language of ['es','en']) {
        await page.goto(url(family.id, edition.year, item.id, language));
        await page.evaluate(() => document.fonts.ready);
        if (width === 'fullscreen') await action(page, 'fullscreen').click();
        const metrics = await page.evaluate(() => {
          const rect = selector => document.querySelector(selector).getBoundingClientRect();
          const icon = rect('.detail-icon'), block = rect('.detail-title-block'), title = rect('#detail-title'), meta = rect('.detail-code');
          const body = document.querySelector('.detail-body');
          return {
            centerError: Math.abs(icon.y + icon.height / 2 - block.y - block.height / 2),
            tileSize: icon.width, tileHeight: icon.height, lines: title.height / parseFloat(getComputedStyle(document.querySelector('#detail-title')).lineHeight),
            clamp: getComputedStyle(document.querySelector('#detail-title')).webkitLineClamp,
            metaHeight: meta.height, overflow: body.scrollWidth-body.clientWidth, pageOverflow: document.documentElement.scrollWidth-innerWidth,
            tooltip: document.querySelector('#shared-tooltip').matches(':popover-open'),
          };
        });
        const label = `${family.id}/${edition.year}/${item.id} ${language} ${width}`;
        assert.ok(metrics.centerError <= 2, `${label}: ${JSON.stringify(metrics)}`);
        assert.equal(metrics.tileSize, width === 'fullscreen' ? 48 : 40, label);
        assert.equal(metrics.tileHeight, metrics.tileSize, label);
        assert.ok(metrics.lines <= 2.01, label); assert.equal(metrics.clamp, '2', label);
        assert.equal(metrics.overflow, 0, label); assert.equal(metrics.pageOverflow, 0, label);
        assert.equal(metrics.tooltip, false, label);
        assert.ok(metrics.metaHeight < 25, label);
        measurements.push({label,...metrics});
      }
      await page.close();
    }
    await writeFile('/workspace/tmp/owasp-v4-alignment.json', JSON.stringify(measurements, null, 2));
    assert.deepEqual(errors, []);
    console.log(`v4 title audit: ${measurements.length} layouts, maximum center error ${Math.max(...measurements.map(m=>m.centerError))}px`);
  } finally { await browser.close(); server.kill(); }
});
