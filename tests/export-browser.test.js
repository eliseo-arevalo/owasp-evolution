import test from 'node:test';
import { catalog } from '../src/data.js';
import { defaultVisibleYears, latestEdition, firstCategory } from '../src/editions.js';
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
      if (await page.locator('html').getAttribute('lang') !== (width === 390 ? 'en' : 'es')) await page.locator(`[data-language="${width === 390 ? 'en' : 'es'}"]`).click();
      await page.locator('#theme-select').click(); await page.locator(`[data-theme-choice="${width === 390 ? 'light' : 'dark'}"]`).click();
      await page.waitForTimeout(200);
      const before = await page.locator('#timeline-stage').boundingBox();
      await page.locator('#export-button').focus();
      await page.keyboard.press('ArrowDown');
      assert.equal(await page.locator('#export-button').getAttribute('aria-expanded'), 'true');
      assert.deepEqual(await page.locator('#timeline-stage').boundingBox(), before);
      await page.keyboard.press('End');
      assert.equal(await page.evaluate(() => document.activeElement.dataset.export), 'json');
      await page.keyboard.press('Escape');
      assert.equal(await page.evaluate(() => document.activeElement.id), 'export-button');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
      await page.locator('#export-button').click();
      await page.locator('#export-menu [data-export=copy]').focus();
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => document.querySelector('#export-menu [data-export=copy] svg').dataset.icon === 'check');
      assert.ok((await page.evaluate(() => navigator.clipboard.readText())).includes(width === 390 ? '| Family |' : '| Familia |'));
      await page.keyboard.press('Escape');
      for (const format of ['png', 'svg', 'csv', 'json', 'md']) {
        await page.locator('#export-button').click();
        const pending = page.waitForEvent('download');
        await page.locator(`#export-menu [data-export="${format}"]`).click();
        const download = await pending;
        assert.equal(download.suggestedFilename(), `owasp-evolution-web-${defaultVisibleYears(catalog.families.web).join('-')}.${format}`);
        const path = `/workspace/tmp/owasp-export-${width === 1440 ? 'sample' : 'mobile'}.${format}`;
        await download.saveAs(path);
        const data = await readFile(path);
        assert.ok(data.length > 100);
        if (format === 'csv') assert.equal(data.toString().split('\r\n')[0], width === 390 ? 'Family,Year,Code,Name,Rank,Lineage type,Linked to' : 'Familia,Año,Código,Nombre,Puesto,Tipo de linaje,Relacionado con');
        if (format === 'json') assert.deepEqual(Object.keys(JSON.parse(data)[0]), ['family', 'year', 'code', 'name', 'position', 'lineage_type', 'linked_to']);
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
            // Every visible edition exports its native duotone icons on desktop and mobile.
            assert.equal((data.toString().match(/<svg x=/g) || []).length, defaultVisibleYears(catalog.families.web).length * 10);
            assert.equal((data.toString().match(/viewBox="0 0 256 256"/g) || []).length, defaultVisibleYears(catalog.families.web).length * 10);
            assert.doesNotMatch(data.toString(), /var\(--visual/);
            assert.ok(data.toString().includes(`${latestEdition(catalog.families.web).year}</text>`));
            const labels = [...data.toString().matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map(match => match[1]).join(' ').replace(/\s+/g, ' ').trim();
            assert.ok(labels.includes(firstCategory(latestEdition(catalog.families.web)).name));
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

test('shared Export menus: both contexts, keyboard, copy fallback, dock migration and complete image captures', { skip: !process.env.MOTION_PLAYWRIGHT }, async () => {
  const { chromium } = await import(process.env.MOTION_PLAYWRIGHT);
  const server = spawn('python3', ['-m', 'http.server', '4220', '-d', 'dist'], { stdio: 'ignore' });
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  try {
    for (const language of ['es', 'en']) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: language === 'es' ? 'dark' : 'light', reducedMotion: 'reduce', acceptDownloads: true });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(() => {
        localStorage.setItem('owasp-dock-layout', JSON.stringify({ desktop: { side: 'bottom', width: 380, height: 600 } }));
        Object.defineProperty(navigator, 'clipboard', { value: { writeText: async text => { if (window.copyFailure) throw Error('denied'); window.copiedMarkdown = text; } } });
        document.execCommand = command => { window.fallbackCommand = command; window.fallbackMarkdown = document.querySelector('textarea').value; return !window.fallbackFailure; };
      });
      await page.goto(`http://localhost:4220/${language === 'es' ? 'es/' : ''}web/2025/a05-injection/?dock=bottom`);
      await page.locator('#detail-title').waitFor();
      assert.equal(await page.locator('.explorer-shell').getAttribute('data-dock'), 'left');
      assert.equal(new URL(page.url()).searchParams.get('dock'), 'left');
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('owasp-dock-layout')).desktop.side), 'left');
      assert.equal(await page.locator('[data-dock=bottom]').count(), 0);
      assert.equal(await page.locator('[data-action=markdown]').count(), 0);
      const downloadImage = async (context, format, suffix = '') => {
        await page.locator(`#${context}-button`).click();
        const pending = page.waitForEvent('download');
        await page.locator(`#${context}-menu [data-export=${format}]`).click();
        const file = await pending;
        const path = `/workspace/tmp/owasp-${context}-${language}${suffix}.${format}`;
        await file.saveAs(path);
        return readFile(path);
      };
      for (const context of ['export', 'detail-export']) {
        const button = page.locator(`#${context}-button`), menu = page.locator(`#${context}-menu`);
        assert.equal(await menu.locator('[role=group]').count(), context === 'export' ? 3 : 2);
        await button.focus(); await page.keyboard.press('ArrowUp');
        assert.equal(await page.evaluate(() => document.activeElement.dataset.export), context === 'export' ? 'json' : 'md');
        await page.keyboard.press('Home');
        assert.equal(await page.evaluate(() => document.activeElement.dataset.export), 'png');
        await page.keyboard.press('ArrowUp');
        assert.equal(await page.evaluate(() => document.activeElement.dataset.export), context === 'export' ? 'json' : 'md');
        await page.keyboard.press('Home'); await page.keyboard.press('ArrowDown');
        assert.equal(await page.evaluate(() => document.activeElement.dataset.export), 'svg');
        assert.equal(await menu.locator('[tabindex="0"]').count(), 1);
        await page.keyboard.press('Escape');
        assert.equal(await button.evaluate(element => element === document.activeElement), true);
        assert.equal(await menu.isVisible(), false);
        await button.click();
        await page.screenshot({ path: `/workspace/tmp/owasp-${context}-menu-${language}.png` });
        await menu.locator('[data-export=copy]').click();
        await page.waitForFunction(({ context, label }) => document.querySelector(`#${context}-menu [data-export=copy]`).textContent === label, { context, label: language === 'es' ? 'Copiado' : 'Copied' });
        assert.equal(await menu.locator('[data-export=copy] svg').getAttribute('data-icon'), 'check');
        assert.equal(await button.locator('..').locator('[role=status]').textContent(), language === 'es' ? 'Copiado' : 'Copied');
        assert.ok((await page.evaluate(() => window.copiedMarkdown)).includes('data:image/svg+xml;base64,'));
        await page.waitForFunction(({ context, label }) => document.querySelector(`#${context}-menu [data-export=copy]`).textContent === label, { context, label: language === 'es' ? 'Copiar' : 'Copy' });
        await page.evaluate(() => window.copyFailure = true);
        await menu.locator('[data-export=copy]').click();
        await page.waitForFunction(() => window.fallbackCommand === 'copy');
        assert.ok((await page.evaluate(() => window.fallbackMarkdown)).includes('```python'));
        assert.equal(await menu.isVisible(), true);
        await page.evaluate(() => window.fallbackFailure = true);
        await menu.locator('[data-export=copy]').click();
        await page.waitForFunction(context => document.querySelector(`#${context}-button`).parentElement.querySelector('[role=status]').textContent.includes('Inténtalo') || document.querySelector(`#${context}-button`).parentElement.querySelector('[role=status]').textContent.includes('try again'), context);
        await page.evaluate(() => { window.copyFailure = false; window.fallbackFailure = false; window.fallbackCommand = null; });
        await page.keyboard.press('Escape');
        await button.click();
        await page.locator('.edition-year').first().click();
        assert.equal(await menu.isVisible(), false);
      }
      const geometry = await page.evaluate(() => ({ stage: document.querySelector('#timeline-stage').getBoundingClientRect().width, shell: document.querySelector('.explorer-shell').getBoundingClientRect().width, detail: document.querySelector('#detail-page').getBoundingClientRect().width }));
      for (const side of ['left', 'right']) {
        await page.locator('[data-action=overflow]').click();
        await page.locator(`#dock-select [data-dock=${side}]`).click();
        // Capture from different scroll positions; full exports must include the entire card.
        await page.locator('.detail-body').evaluate((body, side) => body.scrollTop = side === 'left' ? body.scrollHeight : 0, side);
        const viewportHeight = await page.evaluate(() => {
          const matrix = document.querySelector('#timeline-stage').getBoundingClientRect();
          const panel = document.querySelector('#detail-modal').getBoundingClientRect();
          return Math.ceil(Math.max(matrix.bottom, panel.bottom) - Math.min(matrix.top, panel.top)) + 60;
        });
        const generalPNG = await downloadImage('export', 'png', `-${side}`);
        assert.equal(generalPNG.readUInt32BE(16), (Math.ceil(geometry.shell) + 32) * 2);
        assert.ok(generalPNG.readUInt32BE(16) > (Math.ceil(geometry.stage) + 32) * 2 + geometry.detail);
        assert.ok(generalPNG.readUInt32BE(20) > viewportHeight * 2);
        const generalSVG = (await downloadImage('export', 'svg', `-${side}`)).toString();
        assert.ok(generalSVG.includes('matrix-clip'));
        assert.ok(generalSVG.includes('data-layout="input-to-query"'));
        assert.ok(generalSVG.includes('Injection'));
        assert.ok(generalSVG.includes(language === 'es' ? 'FUENTES' : 'SOURCES'));
        assert.ok(generalSVG.includes(language === 'es' ? 'Abrir fuente oficial' : 'Open official source'));
        assert.doesNotMatch(generalSVG, /Ko-fi|proyecto no oficial|unofficial project|Exportar|Export|Cerrar detalle|Close detail|Secciones del detalle|Detail sections|Más acciones|More actions|<button|foreignObject/);
        const composition = await page.evaluate(svg => {
          const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
          const root = doc.documentElement;
          const detail = doc.querySelector('#detail-clip').closest('svg');
          const matrix = doc.querySelector('#matrix-clip rect');
          const source = [...detail.querySelectorAll('text')].find(text => /Abrir fuente oficial|Open official source/.test(text.textContent));
          return {
            width: +root.getAttribute('width'), height: +root.getAttribute('height'),
            detailX: +detail.getAttribute('x'), detailWidth: +detail.getAttribute('width'), detailHeight: +detail.getAttribute('height'),
            matrixX: +matrix.getAttribute('x'), matrixWidth: +matrix.getAttribute('width'),
            sourceY: +source.getAttribute('y'),
          };
        }, generalSVG);
        assert.equal(generalPNG.readUInt32BE(20), composition.height * 2);
        assert.equal(composition.detailWidth, Math.ceil(geometry.detail));
        assert.ok(composition.sourceY > 900 && composition.sourceY < composition.detailHeight);
        if (side === 'left') assert.ok(composition.detailX + composition.detailWidth <= composition.matrixX);
        else assert.ok(composition.detailX >= composition.matrixX + composition.matrixWidth);
      }
      await page.locator('.detail-body').evaluate(body => body.scrollTop = body.scrollHeight);
      const svg = (await downloadImage('detail-export', 'svg')).toString();
      assert.ok(svg.includes('data:font/woff2;base64,'));
      assert.ok(svg.includes('data-layout="input-to-query"'));
      assert.ok(svg.includes(language === 'es' ? 'RESUMEN' : 'SUMMARY'));
      assert.ok(svg.includes(language === 'es' ? 'PREVENCIÓN' : 'PREVENTION'));
      const exportedText = await page.evaluate(svg => new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement.textContent, svg);
      assert.ok(exportedText.includes("' OR '1'='1"));
      assert.ok(svg.includes(language === 'es' ? 'Abrir fuente oficial' : 'Open official source'));
      assert.doesNotMatch(svg, /Ko-fi|proyecto no oficial|unofficial project|<button|foreignObject/);
      const png = await downloadImage('detail-export', 'png');
      assert.equal(png.readUInt32BE(16), Math.ceil(geometry.detail) * 2);
      assert.ok(png.readUInt32BE(20) > 1800);
      // The same detail menu works in a native fullscreen phone dialog.
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForFunction(() => document.querySelector('#detail-modal').matches(':modal'));
      await page.locator('#detail-export-button').focus(); await page.keyboard.press('ArrowDown');
      assert.equal(await page.locator('#detail-export-menu').isVisible(), true);
      await page.locator('#detail-export-menu [data-export=copy]').click();
      await page.waitForFunction(() => document.querySelector('#detail-export-menu [data-export=copy] svg').dataset.icon === 'check');
      await page.keyboard.press('Escape');
      assert.equal(await page.evaluate(() => document.activeElement.id), 'detail-export-button');
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); server.kill(); }
});
