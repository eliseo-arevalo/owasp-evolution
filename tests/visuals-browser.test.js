import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { catalog } from '../src/data.js';
import { iconSVG, attackSectionHTML, getVisual } from '../src/visuals.js';
import { pathFor } from '../src/routes.js';
import { translate } from '../src/i18n.js';

const pilot = catalog.families.web.editions.find(edition => edition.year === 2025).items;
const unmark = code => code.replaceAll('[[', '').replaceAll(']]', '');
test('Chrome: unique bilingual examples, stable draw, dock layouts, themes and visuals2 screenshots', { skip: !process.env.MOTION_PLAYWRIGHT }, async () => {
  const { chromium } = await import(process.env.MOTION_PLAYWRIGHT);
  const server = spawn('python3', ['-m', 'http.server', '4190', '-d', 'dist'], { stdio: 'ignore' });
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const route = (id, language = 'en') => 'http://localhost:4190' + pathFor({ family: 'web', year: 2025, id }, catalog, language);
  const errors = [];
  const fits = async (page, context) => {
    await page.evaluate(() => document.fonts.ready);
    const metrics = await page.locator('#detail-modal').evaluate(panel => {
      const svg = panel.querySelector('.attack-diagram');
      const body = panel.querySelector('.detail-body');
      const code = panel.querySelector('pre');
      return { overflow: document.documentElement.scrollWidth - innerWidth,
        bodyOverflow: body.scrollWidth - body.clientWidth, codeOverflow: code.scrollWidth - code.clientWidth,
        collisions: [...svg.querySelectorAll('.attack-path, .attack-outline')].flatMap(path => {
          const boxes = [...svg.querySelectorAll('text')].map(text => ({ text: text.textContent, box: text.getBBox() }));
          const collisions = new Set();
          for (let n = 0; n <= path.getTotalLength(); n += 1) {
            const point = path.getPointAtLength(n);
            for (const { text, box } of boxes) if (point.x > box.x && point.x < box.x + box.width && point.y > box.y && point.y < box.y + box.height) collisions.add(text);
          }
          return [...collisions];
        }),
        labels: [...svg.querySelectorAll('text')].map(label => {
          const box = label.getBBox();
          return { text: label.textContent, x: box.x, right: box.x + box.width, y: box.y, bottom: box.y + box.height };
        }) };
    });
    assert.equal(metrics.overflow, 0, context);
    assert.equal(metrics.bodyOverflow, 0, context);
    assert.equal(metrics.codeOverflow, 0, context);
    assert.deepEqual(metrics.collisions, [], `${context}: arrows clear labels`);
    assert.ok(metrics.labels.every(box => box.text && box.text !== 'undefined'), context);
    for (const box of metrics.labels) assert.ok(box.x >= 0 && box.right <= 320 && box.y >= 0 && box.bottom <= 196, `${context}: ${JSON.stringify(box)}`);
  };
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, colorScheme: 'dark' });
    page.on('pageerror', error => errors.push(error.message));
    for (const item of pilot) {
      await page.goto(route(item.id));
      await page.locator('#detail-modal[open] .attack-diagram').waitFor();
      const motion = await page.locator('#detail-modal .attack-diagram').evaluate(async svg => {
        const initial = svg.getBoundingClientRect().toJSON();
        const timings = svg.getAnimations({ subtree: true }).map(animation => animation.effect.getComputedTiming());
        const frames = [];
        await new Promise(resolve => {
          const start = performance.now();
          const sample = () => {
            const box = svg.getBoundingClientRect();
            frames.push({ width: box.width, height: box.height });
            if (performance.now() - start < 500) requestAnimationFrame(sample);
            else resolve();
          };
          sample();
        });
        return { initial, frames, endTimes: timings.map(t => t.endTime), delays: timings.map(t => t.delay),
          expected: svg.querySelectorAll('.attack-node, .attack-path').length,
          opacity: [...svg.querySelectorAll('.attack-node')].map(node => getComputedStyle(node).opacity),
          dash: [...svg.querySelectorAll('.attack-path')].map(path => getComputedStyle(path).strokeDashoffset) };
      });
      assert.equal(motion.endTimes.length, motion.expected);
      assert.ok(motion.endTimes.every(end => end < 600));
      assert.ok(new Set(motion.delays).size > 2);
      assert.ok(motion.frames.every(frame => frame.width === motion.initial.width && frame.height === motion.initial.height));
      assert.ok(motion.opacity.every(value => value === '1'));
      assert.ok(motion.dash.every(value => value === '0px'));
      for (const language of ['en', 'es']) {
        await page.locator(`[data-language="${language}"]`).click();
        const t = text => translate(text, language);
        assert.equal(await page.locator('#detail-modal .attack-diagram title').textContent(), `${item.id} · ${t('Cómo funciona el ataque')}`);
        assert.equal(await page.locator('#detail-modal .attack-diagram desc').textContent(), t(getVisual('web', 2025, item.id).description));
        assert.equal(await page.locator('#detail-modal .attack-diagram').getAttribute('role'), 'img');
        assert.equal(await page.locator('#detail-modal .attack-diagram').getAttribute('data-layout'), getVisual('web', 2025, item.id).layout);
        assert.equal(await page.locator('#detail-modal .detail-icon svg title').textContent(), item.name);
        assert.equal(await page.locator('#detail-modal pre code').textContent(), unmark(getVisual('web', 2025, item.id).example));
        assert.equal(await page.locator('#detail-modal .attack-fix').textContent(), `${t('Corrección:')} ${t(getVisual('web', 2025, item.id).fix)}`);
        assert.equal(await page.locator('#detail-modal .source-link').getAttribute('href'), item.source);
        await page.evaluate(() => document.fonts.ready);
        await fits(page, `${item.id} ${language}`);
      }
    }
    // Compare the same rendered row with/without the pilot enhancement.
    const geometry = await page.evaluate(() => [...document.querySelectorAll('[data-year="2025"] .risk-focus')].map(button => {
      const copy = button.querySelector('.risk-copy');
      const icon = button.querySelector('.matrix-icon');
      const before = { width: copy.getBoundingClientRect().width, height: button.getBoundingClientRect().height };
      const rank = button.querySelector('.risk-rank').getBoundingClientRect(), i = icon.getBoundingClientRect(), name = copy.getBoundingClientRect();
      const aligned = rank.right <= i.left && i.right <= name.left && Math.abs((i.top + i.height / 2) - (rank.top + rank.height / 2)) < 1;
      button.classList.remove('has-icon'); icon.remove();
      const after = { width: copy.getBoundingClientRect().width, height: button.getBoundingClientRect().height };
      button.classList.add('has-icon'); button.insertBefore(icon, copy);
      return { before, after, aligned, iconWidth: i.width };
    }));
    for (const row of geometry) {
      assert.equal(row.before.width, row.after.width);
      assert.equal(row.before.height, row.after.height);
      assert.equal(row.iconWidth, 16); assert.ok(row.aligned);
    }
    // Reopen replays the animation, and reduced motion paints instantly.
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    await page.locator('.risk-detail').click();
    assert.ok(await page.locator('#detail-modal .attack-diagram').evaluate(svg => svg.getAnimations({ subtree: true }).length > 0));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(route('A01'));
    assert.equal(await page.locator('#detail-modal .attack-diagram').evaluate(svg => svg.getAnimations({ subtree: true }).length), 0);
    await page.close();

    // Exercise both side docks at 360/480px and the wide bottom layout.
    for (const theme of ['dark', 'light']) for (const side of ['left', 'right', 'bottom']) for (const width of side === 'bottom' ? [480] : [360, 480]) {
      const dock = await browser.newPage({ viewport: { width: 1440, height: 1000 }, colorScheme: theme, reducedMotion: 'reduce' });
      await dock.addInitScript(({ side, width }) => localStorage.setItem('owasp-dock-layout', JSON.stringify({ desktop: { side, width, height: 620 } })), { side, width });
      for (const item of pilot) {
        await dock.goto(route(item.id, 'es'));
        await dock.locator('#detail-modal .attack-diagram').waitFor();
        await fits(dock, `${theme} ${side} ${width} ${item.id}`);
      }
      if (side === 'bottom') assert.equal(await dock.locator('.attack-explainer').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length), 2);
      if (theme === 'dark' && side === 'right' && width === 480) for (const id of ['A05', 'A03']) {
        await dock.goto(route(id, 'es')); await dock.evaluate(() => document.fonts.ready);
        await dock.screenshot({ path: `/workspace/tmp/owasp-visuals2-detail-${id.toLowerCase()}-dark-1440.png`, fullPage: true });
      }
      await dock.close();
    }
    const matrix = await browser.newPage({ viewport: { width: 1440, height: 1000 }, colorScheme: 'dark', reducedMotion: 'reduce' });
    await matrix.goto('http://localhost:4190/es/'); await matrix.locator('.matrix-icon').first().waitFor(); await matrix.evaluate(() => document.fonts.ready);
    await matrix.screenshot({ path: '/workspace/tmp/owasp-visuals2-matrix-dark-1440.png', fullPage: true }); await matrix.close();

    const mobile = await browser.newPage({ viewport: { width: 390, height: 1000 }, colorScheme: 'light', reducedMotion: 'reduce' });
    await mobile.addInitScript(() => localStorage.setItem('owasp-dock-layout', JSON.stringify({ mobile: { height: 700 } })));
    for (const language of ['en', 'es']) for (const item of pilot) {
      await mobile.goto(route(item.id, language)); await mobile.locator('#detail-modal[open]').waitFor();
      await fits(mobile, `390 ${language} ${item.id}`);
      assert.equal(await mobile.locator('.matrix-icon').first().evaluate(el => getComputedStyle(el).display), 'none');
    }
    await mobile.goto(route('A01', 'es')); await mobile.evaluate(() => document.fonts.ready);
    await mobile.screenshot({ path: '/workspace/tmp/owasp-visuals2-detail-a01-light-390.png', fullPage: true });
    await mobile.close();

    for (const language of ['en', 'es']) {
      const staticPage = await browser.newPage({ javaScriptEnabled: false, viewport: { width: 390, height: 1000 } });
      await staticPage.goto(route('A05', language));
      await staticPage.locator('#prerender .attack-diagram').waitFor({ state: 'visible' });
      assert.equal(await staticPage.locator('#prerender svg[role="img"]').count(), 2);
      assert.equal(await staticPage.locator('#prerender pre code').textContent(), unmark(getVisual('web', 2025, 'A05').example));
      assert.equal(await staticPage.locator('#prerender .attack-fix strong').textContent(), translate('Corrección:', language));
      await staticPage.close();
    }
    assert.deepEqual(errors, []);
    // Both languages and real HTML snippets appear in each contact-sheet card.
    const css = (await readFile(new URL('../styles.css', import.meta.url), 'utf8')).replaceAll('./assets/', new URL('../assets/', import.meta.url).href);
    const gallery = `<!doctype html><html lang="es"><meta charset="utf-8"><title>OWASP Web 2025 · Visuales 2</title><style>${css}
      body { padding: 28px; } .gallery { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
      .gallery-card { padding: 18px; border: 1px solid var(--line-strong); border-radius: 14px; background: var(--page); }
      .gallery-title { display: flex; align-items: center; gap: 12px; margin: 0 0 12px; font-size: 17px; }
      .gallery-languages { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
      .gallery-language { color: var(--muted); font: 11px 'Geist Mono', monospace; }
      .attack-section { border: 0; padding-top: 8px; } .attack-section h2 { font-size: 12px; }
      h1 { margin: 0 0 8px; font-size: 28px; } .gallery-intro { color: var(--muted); margin: 0 0 22px; }
    </style><h1>OWASP Web 2025 · Diez ataques, diez ejemplos</h1><p class="gallery-intro">Phosphor duotone / MIT · EN + ES · Ejemplos seleccionables y correcciones</p><div class="gallery">${pilot.map(item => `<article class="gallery-card"><h2 class="gallery-title">${iconSVG('web', 2025, item.id, item.name)}${item.id} · ${item.name.replaceAll('&', '&amp;')}</h2><div class="gallery-languages">${['en', 'es'].map(language => `<div lang="${language}"><div class="gallery-language">${language.toUpperCase()}</div>${attackSectionHTML('web', 2025, item.id, text => translate(text, language))}</div>`).join('')}</div></article>`).join('')}</div></html>`;
    const galleryPath = '/workspace/tmp/owasp-visuals2-gallery.html';
    await writeFile(galleryPath, gallery);
    const sheet = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    await sheet.goto(`file://${galleryPath}`); await sheet.evaluate(() => document.fonts.ready);
    for (const theme of ['dark', 'light']) {
      await sheet.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
      await sheet.screenshot({ path: `/workspace/tmp/owasp-visuals2-contact-${theme}.png`, fullPage: true });
    }
    await sheet.close();
  } finally { await browser.close(); server.kill(); }
});
