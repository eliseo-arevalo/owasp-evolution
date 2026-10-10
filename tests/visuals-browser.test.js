import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { catalog } from '../src/data.js';
import { iconSVG, diagramSVG, getVisual } from '../src/visuals.js';
import { pathFor } from '../src/routes.js';
import { translate } from '../src/i18n.js';

const pilot = catalog.families.web.editions.find(edition => edition.year === 2025).items;
test('Chrome: bilingual pilot diagrams, accessible prerender, stable motion, themes and contact sheets', { skip: !process.env.MOTION_PLAYWRIGHT }, async () => {
  const { chromium } = await import(process.env.MOTION_PLAYWRIGHT);
  const server = spawn('python3', ['-m', 'http.server', '4190', '-d', 'dist'], { stdio: 'ignore' });
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const route = (id, language = 'en') => 'http://localhost:4190' + pathFor({ family: 'web', year: 2025, id }, catalog, language);
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, colorScheme: 'dark' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    for (const item of pilot) {
      await page.goto(route(item.id));
      await page.locator('#detail-modal[open] .attack-diagram').waitFor();
      const motion = await page.locator('#detail-modal .attack-diagram').evaluate(async svg => {
        const initial = svg.getBoundingClientRect().toJSON();
        const animations = svg.getAnimations({ subtree: true });
        const timings = animations.map(animation => animation.effect.getComputedTiming());
        const frames = [];
        await new Promise(resolve => {
          const start = performance.now();
          const sample = () => {
            const box = svg.getBoundingClientRect();
            frames.push({ width: box.width, height: box.height });
            if (performance.now() - start < 650) requestAnimationFrame(sample);
            else resolve();
          };
          sample();
        });
        return { initial, frames, endTimes: timings.map(t => t.endTime), delays: timings.map(t => t.delay),
          opacity: [...svg.querySelectorAll('.attack-node')].map(node => getComputedStyle(node).opacity),
          dash: [...svg.querySelectorAll('.attack-path')].map(path => getComputedStyle(path).strokeDashoffset) };
      });
      assert.equal(motion.endTimes.length, 7);
      assert.ok(motion.endTimes.every(end => end < 600));
      assert.ok(new Set(motion.delays).size > 2);
      assert.ok(motion.frames.every(frame => frame.width === motion.initial.width && frame.height === motion.initial.height));
      assert.deepEqual(motion.opacity, ['1', '1', '1', '1']);
      assert.deepEqual(motion.dash, ['0px', '0px', '0px']);
      for (const language of ['en', 'es']) {
        await page.locator(`[data-language="${language}"]`).click();
        const t = text => translate(text, language);
        assert.equal(await page.locator('#detail-modal .attack-diagram title').textContent(), `${item.id} · ${t('Cómo funciona el ataque')}`);
        assert.equal(await page.locator('#detail-modal .attack-diagram desc').textContent(), t(getVisual('web', 2025, item.id).description));
        assert.deepEqual(await page.locator('#detail-modal .attack-label').allTextContents(), getVisual('web', 2025, item.id).nodes.map(t));
        assert.equal(await page.locator('#detail-modal .attack-diagram').getAttribute('role'), 'img');
        assert.equal(await page.locator('#detail-modal .detail-icon svg title').textContent(), item.name);
        const fits = await page.locator('#detail-modal .attack-diagram').evaluate(svg => [...svg.querySelectorAll('.attack-label')].every(label => {
          const box = label.getBBox();
          return box.x >= 3 && box.x + box.width <= 127 && box.y >= 2 && box.y + box.height <= 44;
        }));
        const arrowsClearRoles = await page.locator('#detail-modal .attack-diagram').evaluate(svg => {
          const roles = [...svg.querySelectorAll('.attack-role')].map(label => label.getBoundingClientRect());
          return [...svg.querySelectorAll('.attack-path')].every(path => {
            const box = path.getBoundingClientRect();
            return roles.every(role => box.right <= role.left || box.left >= role.right || box.bottom <= role.top || box.top >= role.bottom);
          });
        });
        assert.ok(arrowsClearRoles, `${item.id} ${language}: arrows clear role labels`);
        assert.ok(fits, `${item.id} ${language}: label fits its node`);
      }
    }
    // Adding icons does not reduce the name's available width or change row height.
    const geometry = await page.evaluate(() => {
      const a = document.querySelector('[data-year="2025"] .risk-focus');
      const b = document.querySelector('[data-year="2021"] .risk-focus');
      const name = el => el.querySelector('.risk-copy').getBoundingClientRect();
      return { a: name(a).width, b: name(b).width, ah: a.closest('.risk-card').getBoundingClientRect().height, bh: b.closest('.risk-card').getBoundingClientRect().height };
    });
    assert.equal(geometry.a, geometry.b);
    assert.equal(geometry.ah, geometry.bh);
    for (const id of ['A01', 'A03']) {
      await page.goto(route(id, 'es'));
      await page.waitForTimeout(1100);
      await page.screenshot({ path: `/workspace/tmp/owasp-visuals-detail-${id.toLowerCase()}-dark-1440.png`, fullPage: true });
    }
    // Opening a selected row replays the draw, including a repeat open.
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await page.locator('.risk-detail').click();
    assert.equal(await page.locator('#detail-modal .attack-diagram').evaluate(svg => svg.getAnimations({ subtree: true }).length), 7);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(route('A01'));
    assert.equal(await page.locator('#detail-modal .attack-diagram').evaluate(svg => svg.getAnimations({ subtree: true }).length), 0);
    assert.deepEqual(errors, []);
    await page.close();

    const mobile = await browser.newPage({ viewport: { width: 390, height: 1000 }, colorScheme: 'light', reducedMotion: 'reduce' });
    await mobile.goto(route('A05', 'es'));
    await mobile.locator('#detail-modal[open]').waitFor();
    const metrics = await mobile.evaluate(() => {
      const svg = document.querySelector('#detail-modal .attack-diagram');
      const body = document.querySelector('.detail-body');
      return { overflow: document.documentElement.scrollWidth - innerWidth, bodyOverflow: body.scrollWidth - body.clientWidth,
        iconVisible: getComputedStyle(document.querySelector('.matrix-icon')).display, width: svg.getBoundingClientRect().width };
    });
    assert.equal(metrics.overflow, 0);
    assert.equal(metrics.bodyOverflow, 0);
    assert.equal(metrics.iconVisible, 'none');
    assert.ok(metrics.width > 300 && metrics.width < 390);
    await mobile.screenshot({ path: '/workspace/tmp/owasp-visuals-detail-a05-light-390.png', fullPage: true });
    await mobile.close();

    for (const language of ['en', 'es']) {
      const staticPage = await browser.newPage({ javaScriptEnabled: false, viewport: { width: 390, height: 1000 } });
      await staticPage.goto(route('A05', language));
      await staticPage.locator('#prerender .attack-diagram').waitFor({ state: 'visible' });
      assert.equal(await staticPage.locator('#prerender svg[role="img"]').count(), 2);
      assert.equal(await staticPage.locator('#prerender .attack-description').textContent(), translate(getVisual('web', 2025, 'A05').description, language));
      await staticPage.close();
    }
    // Temporary gallery lives outside the repository and uses the actual SVG renderers.
    const css = (await readFile(new URL('../styles.css', import.meta.url), 'utf8')).replaceAll('./assets/', new URL('../assets/', import.meta.url).href);
    const gallery = `<!doctype html><html lang="es"><meta charset="utf-8"><title>OWASP Web 2025 · Visuales</title><style>${css}
      body { padding: 24px; } .gallery { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
      .gallery-card { padding: 16px; border: 1px solid var(--line-strong); border-radius: 8px; background: var(--surface); }
      .gallery-title { display: flex; align-items: center; gap: 10px; margin: 0 0 12px; font-size: 16px; }
      .gallery-title svg { width: 28px; height: 28px; color: var(--muted); }
      .gallery-languages { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
      .gallery-language { color: var(--quiet); font: 11px 'Geist Mono', monospace; margin-bottom: 8px; }
      h1 { margin: 0 0 8px; font-size: 24px; } .gallery-intro { color: var(--muted); margin: 0 0 20px; }
    </style><h1>OWASP Web 2025 · Iconos y diagramas</h1><p class="gallery-intro">Actor → Entrada / Entry point → Fallo / Flaw → Impacto / Impact</p><div class="gallery">${pilot.map(item => `<article class="gallery-card"><h2 class="gallery-title">${iconSVG('web', 2025, item.id, item.name)}${item.id} · ${item.name.replaceAll('&', '&amp;')}</h2><div class="gallery-languages">${['en', 'es'].map(language => `<div lang="${language}"><div class="gallery-language">${language.toUpperCase()}</div>${diagramSVG('web', 2025, item.id, text => translate(text, language))}</div>`).join('')}</div></article>`).join('')}</div></html>`;
    const galleryPath = '/workspace/tmp/owasp-visuals-gallery.html';
    await writeFile(galleryPath, gallery);
    const sheet = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    await sheet.goto(`file://${galleryPath}`);
    await sheet.evaluate(() => document.fonts.ready);
    for (const theme of ['dark', 'light']) {
      await sheet.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
      await sheet.screenshot({ path: `/workspace/tmp/owasp-visuals-contact-${theme}.png`, fullPage: true });
    }
    await sheet.close();
  } finally { await browser.close(); server.kill(); }
});
