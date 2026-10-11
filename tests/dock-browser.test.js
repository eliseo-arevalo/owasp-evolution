import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';

// Run with MOTION_PLAYWRIGHT pointing at a Playwright installation.
test('Chrome: themes, dock geometry, resize connectors, focus, persistence and screenshots', { skip: !process.env.MOTION_PLAYWRIGHT }, async () => {
  const { chromium } = await import(process.env.MOTION_PLAYWRIGHT);
  const server = spawn('python3', ['-m', 'http.server', '4180', '-d', 'dist'], { stdio: 'ignore' });
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const measurements = [];
  const measure = async (page) => page.evaluate(async () => {
    // Sample the painted frame after ResizeObserver; measuring mid-frame would
    // force the next CSS layout before the browser has delivered its observers.
    await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
    const rect = selector => document.querySelector(selector).getBoundingClientRect().toJSON();
    const matrix = rect('.timeline-panel'), panel = rect('#detail-modal');
    const overlap = (a,b) => Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
    const stage = rect('#timeline-stage');
    let error = 0;
    for(const path of document.querySelectorAll('#connector-layer > path[data-edge]')) {
      const [from,to] = path.dataset.edge.split('>');
      const a = rect(`.risk-card[data-key="${from}"]`), b = rect(`.risk-card[data-key="${to}"]`);
      const nums = path.getAttribute('d').match(/-?[\d.]+/g).map(Number);
      error = Math.max(error,Math.abs(nums[0]-(a.right-stage.left)),Math.abs(nums[1]-(a.top-stage.top+a.height/2)),Math.abs(nums[6]-(b.left-stage.left)),Math.abs(nums[7]-(b.top-stage.top+b.height/2)));
      if(path.hitArea?.getAttribute('d') !== path.getAttribute('d')) error=Infinity;
    }
    const columns = [...document.querySelectorAll('#timeline-grid > .edition-column')].map(c=>c.getBoundingClientRect().toJSON());
    // Side docks clip offscreen columns in the matrix's own scroll viewport.
    const visibleColumns = columns.map(c=>({left:Math.max(c.left,matrix.left),right:Math.min(c.right,matrix.right),top:Math.max(c.top,matrix.top),bottom:Math.min(c.bottom,matrix.bottom)})).filter(c=>c.right>c.left&&c.bottom>c.top);
    return { matrix, panel, overlap: overlap(matrix,panel), columnOverlap: Math.max(0,...visibleColumns.map(c=>overlap(c,panel))), connectorError:error, overflow:document.documentElement.scrollWidth-innerWidth, theme:document.documentElement.dataset.theme, dock:document.querySelector('.explorer-shell').dataset.dock, paths:document.querySelectorAll('#connector-layer > path[data-edge]').length };
  });
  const check = result => {
    assert.equal(result.overlap,0,JSON.stringify(result));
    assert.equal(result.columnOverlap,0,JSON.stringify(result));
    assert.equal(result.overflow,0,JSON.stringify(result));
    assert.ok(result.connectorError < 1,JSON.stringify(result));
    assert.ok(result.paths > 0);
  };
  const animationSamples = [];
  const sampleAnimation = async (page, action) => {
    await action();
    const samples = [];
    for(let i=0;i<14;i++) { await page.waitForTimeout(16); const sample = await measure(page); check(sample); samples.push(sample); }
    animationSamples.push(samples.length);
  };
  try {
    for(const width of [1440]) for(const theme of ['dark','light']) {
      const page = await browser.newPage({viewport:{width,height:900},colorScheme:theme,locale:'es-SV'});
      const errors=[]; page.on('pageerror',e=>errors.push(e.message));
      await page.addInitScript(({theme}) => {
        localStorage.setItem('owasp-theme',theme);
        localStorage.setItem('owasp-language','es');
        window.themeFrames=[];
        const sample=()=> { if(document.querySelector('link[rel="stylesheet"]')?.sheet) window.themeFrames.push({theme:document.documentElement.dataset.theme,bg:getComputedStyle(document.body).backgroundColor}); if(window.themeFrames.length<20) requestAnimationFrame(sample); };
        requestAnimationFrame(sample);
      },{theme});
      // Delay CSS so the head script's resolution can be inspected before the first styled paint.
      await page.route('**/styles.css',async route=>{await new Promise(resolve=>setTimeout(resolve,150));await route.continue();});
      await page.goto('http://localhost:4180/#/web/2025/A01');
      await page.waitForTimeout(1300);
      const frames=await page.evaluate(()=>window.themeFrames);
      assert.ok(frames.length > 0);
      assert.ok(frames.every(f=>f.theme===theme&&f.bg===(theme==='dark'?'rgb(17, 17, 17)':'rgb(247, 247, 247)')),JSON.stringify(frames));
      assert.equal(await page.locator('[data-theme-choice][aria-checked="true"]').getAttribute('data-theme-choice'),theme);
      await page.locator('[data-language="es"]').click();
      for(const dock of ['right','left']) {
        await sampleAnimation(page,()=>page.locator('.risk-detail').click());
        await page.waitForTimeout(100);
        if(width===1440) { await page.locator('[data-action="overflow"]').click(); await page.locator(`#dock-select [data-dock="${dock}"]`).click(); }
        await page.waitForTimeout(350);
        const result=await measure(page);check(result);
        assert.equal(result.dock,dock);
        const screenshot=`/workspace/tmp/owasp-dock-${theme}-${dock}-${width}.png`;
        await page.screenshot({path:screenshot,fullPage:true});
        measurements.push({width,theme,dock,...result,screenshot,themeFrames:frames.length});
        // Resize with pointer capture, then with the accessible separator keyboard.
        const handle=await page.locator('#dock-resizer').boundingBox();
        await page.mouse.move(handle.x+handle.width/2,handle.y+handle.height/2);
        await page.mouse.down();
        await page.mouse.move(handle.x+handle.width/2+(dock==='left'?40:-40),handle.y+handle.height/2,{steps:8});
        await page.mouse.up();await page.waitForTimeout(100);check(await measure(page));
        await page.locator('#dock-resizer').focus();
        await page.keyboard.press('ArrowRight');
        await page.waitForTimeout(350);check(await measure(page));
        // Narrow layouts promote the dock to a modal, then restore its desktop side.
        await page.setViewportSize({width:390,height:900});await page.waitForTimeout(350);
        assert.equal(await page.locator('#detail-modal').evaluate(d => d.matches(':modal')), true);
        assert.equal(await page.locator('.explorer-shell').getAttribute('data-dock'),'fullscreen');
        await page.setViewportSize({width,height:900});await page.waitForTimeout(350);check(await measure(page));
        await sampleAnimation(page,()=>page.keyboard.press('Escape'));
        await page.waitForTimeout(100);
        assert.equal(await page.locator('#detail-modal').evaluate(d=>d.open),false);
        assert.ok(await page.locator('.is-selected .risk-focus').evaluate(b=>b===document.activeElement));
      }
      if(width===1440) {
        await page.reload();await page.waitForTimeout(1300);
        await page.locator('.risk-detail').click();await page.waitForTimeout(350);
        assert.equal(await page.locator('.explorer-shell').getAttribute('data-dock'),'left');
        check(await measure(page));
      }
      assert.deepEqual(errors,[]);await page.close();
    }
    const page=await browser.newPage({viewport:{width:1440,height:900},colorScheme:'light',reducedMotion:'reduce'});
    await page.goto('http://localhost:4180');
    assert.equal(await page.locator('[data-theme-choice][aria-checked="true"]').getAttribute('data-theme-choice'),'system');
    assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
    await page.emulateMedia({colorScheme:'dark',reducedMotion:'reduce'});
    await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark');
    assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
    await page.locator('#theme-select').click(); await page.locator('[data-theme-choice="light"]').click();
    await page.emulateMedia({colorScheme:'dark',reducedMotion:'reduce'});
    assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
    await page.reload();assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
    await page.locator('.is-selected .risk-focus').dblclick();await page.waitForTimeout(50);
    check(await measure(page));assert.equal(await page.evaluate(()=>document.getAnimations().length),0);
    await page.keyboard.press('Escape');await page.waitForTimeout(50);
    assert.equal(await page.locator('#detail-modal').evaluate(d=>d.open),false);
    // Storage exceptions never prevent startup.
    await page.addInitScript(()=>{Storage.prototype.getItem=()=>{throw Error('blocked')};Storage.prototype.setItem=()=>{throw Error('blocked')};});
    await page.reload();await page.locator('.risk-detail').click();await page.waitForTimeout(50);check(await measure(page));
    await page.close();
    await writeFile('/workspace/tmp/owasp-dock-measurements.json',JSON.stringify(measurements,null,2));
    console.log(`Open/close: ${animationSamples.reduce((a,b)=>a+b,0)} geometry samples, no overlap or stale connectors`);
    console.log(measurements.map(m=>`${m.width}px ${m.theme}/${m.dock}: overlap ${m.overlap}px², overflow ${m.overflow}px, connector error ${m.connectorError}px, ${m.themeFrames} correct initial frames`).join('\n'));
  } finally { await browser.close();server.kill(); }
});
