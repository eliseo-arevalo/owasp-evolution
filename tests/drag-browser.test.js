import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

test('Chrome: pointer dock drag, mobile snaps and close', { skip: !process.env.MOTION_PLAYWRIGHT }, async () => {
  const { chromium } = await import(process.env.MOTION_PLAYWRIGHT);
  const server = spawn('python3', ['-m', 'http.server', '4186', '-d', 'dist'], { stdio: 'ignore' });
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
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

  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto('http://localhost:4186/#/web/2025/A01');
    await page.waitForTimeout(1000);
    await page.locator('.risk-detail').click(); await page.waitForTimeout(350);
    assert.equal(await page.locator('.explorer-shell').getAttribute('data-dock'), 'left');
    const drag = async (locator, dx, dy) => {
      const b = await locator.boundingBox();
      await page.mouse.move(b.x+b.width/2,b.y+b.height/2); await page.mouse.down();
      await page.mouse.move(b.x+b.width/2+dx,b.y+b.height/2+dy,{steps:12});
      check(await measure(page));
      await page.waitForTimeout(150); await page.mouse.up(); await page.waitForTimeout(400);
      check(await measure(page));
    };
    const before = await page.locator('#detail-modal').boundingBox();
    await drag(page.locator('#dock-resizer'), 100, 0);
    assert.ok((await page.locator('#detail-modal').boundingBox()).width > before.width + 50);
    await page.locator('#dock-resizer').focus();
    const keyboardSize = Number(await page.locator('#dock-resizer').getAttribute('aria-valuenow'));
    await page.keyboard.press('ArrowRight'); await page.waitForTimeout(300);
    assert.equal(Number(await page.locator('#dock-resizer').getAttribute('aria-valuenow')),keyboardSize+10);
    check(await measure(page));
    await page.screenshot({path:'/workspace/tmp/owasp-drag-desktop-left.png'});
    for (const side of ['right','bottom']) {
      const b = await page.locator('.detail-header').boundingBox();
      const shell = await page.locator('.explorer-shell').boundingBox();
      const x = b.x+30, y=b.y+25;
      await page.mouse.move(x,y); await page.mouse.down();
      await page.mouse.move(side==='right'?shell.x+shell.width-30:shell.x+shell.width/2,side==='bottom'?shell.y+shell.height-30:shell.y+shell.height/2,{steps:15});
      assert.equal(await page.locator('.dock-drop.is-target').count(),1);
      await page.mouse.up(); await page.waitForTimeout(400);
      assert.equal(await page.locator('.explorer-shell').getAttribute('data-dock'),side); check(await measure(page));
      await drag(page.locator('#dock-resizer'),side==='right'?-60:0,side==='bottom'?-60:0);
      await page.screenshot({path:`/workspace/tmp/owasp-drag-desktop-${side}.png`});
    }
    await page.reload(); await page.waitForTimeout(1000); await page.locator('.risk-detail').click(); await page.waitForTimeout(400);
    assert.equal(await page.locator('.explorer-shell').getAttribute('data-dock'),'bottom');
    await page.close();
    const mobile = await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    await mobile.addInitScript(()=>localStorage.setItem('owasp-dock','right'));
    await mobile.goto('http://localhost:4186/#/web/2025/A01'); await mobile.waitForTimeout(1000);
    await mobile.locator('.risk-detail').click(); await mobile.waitForTimeout(400);
    assert.equal(await mobile.locator('.explorer-shell').getAttribute('data-dock'),'bottom');
    assert.equal(await mobile.locator('#dock-select').isVisible(),false);
    assert.equal(await mobile.locator('#dock-select button').first().isDisabled(),true);
    const cdp = await mobile.context().newCDPSession(mobile);
    const touch = async (target, wait=160) => {
      const b=await mobile.locator('#dock-resizer').boundingBox();
      const x=b.x+b.width/2, y=b.y+b.height/2;
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
      for(let i=1;i<=12;i++) {
        await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y+(target-y)*i/12}]});
        await mobile.waitForTimeout(16); check(await measure(mobile));
      }
      await mobile.waitForTimeout(wait);
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      await mobile.waitForTimeout(400);
    };
    for(const ratio of [.25,.5,.9]) {
      const b=await mobile.locator('.explorer-shell').boundingBox();
      await touch(b.y+b.height-12-(b.height-22)*ratio);
      check(await measure(mobile));
      const size=Number(await mobile.locator('#dock-resizer').getAttribute('aria-valuenow'));
      assert.ok(Math.abs(size-(b.height-22)*ratio)<3,`${ratio}: ${size}`);
      await mobile.screenshot({path:`/workspace/tmp/owasp-drag-mobile-${ratio}.png`});
    }
    const stored = await mobile.evaluate(()=>JSON.parse(localStorage.getItem('owasp-dock-layout')));
    assert.equal(stored.mobile.side,'bottom');
    assert.ok(stored.mobile.height > 500);
    await mobile.setViewportSize({width:800,height:844}); await mobile.waitForTimeout(350);
    assert.equal(await mobile.locator('.explorer-shell').getAttribute('data-dock'),'bottom');
    await mobile.setViewportSize({width:390,height:844}); await mobile.waitForTimeout(350);
    check(await measure(mobile));
    const scroll=mobile.locator('.timeline-scroll');
    await scroll.evaluate(el=>el.scrollLeft=250); assert.ok(await scroll.evaluate(el=>el.scrollLeft)>0); check(await measure(mobile));
    await touch(830);
    assert.equal(await mobile.locator('#detail-modal').evaluate(el=>el.open),false);
    await mobile.screenshot({path:'/workspace/tmp/owasp-drag-mobile-closed.png'});
    await mobile.close();
  } finally { await browser.close(); server.kill(); }
});
