import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serveVercel } from '../scripts/test-server.js';

const browserOptions = { skip: !process.env.MOTION_PLAYWRIGHT };
test('audit browser: generated CSP, Umami, exports, accessible names, search and scroll-safe menus', browserOptions, async t => {
  const { chromium } = await import(process.env.MOTION_PLAYWRIGHT);
  const root = await mkdtemp(join(tmpdir(),'owasp-csp-'));
  const env = { ...process.env, BUILD_OUTPUT_DIR:join(root,'dist'), VERCEL_OUTPUT_DIR:join(root,'output'), UMAMI_SCRIPT_URL:'https://unami-oclazi.vercel.app/script.js', UMAMI_WEBSITE_ID:'00000000-0000-0000-0000-000000000001', UMAMI_DOMAINS:'' };
  execFileSync(process.execPath,['scripts/build.js'],{env});
  execFileSync(process.execPath,['scripts/vercel-output.js'],{env});
  const server = await serveVercel(env.VERCEL_OUTPUT_DIR);
  const browser = await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
  t.after(async()=>{await browser.close(); await server.close(); await rm(root,{recursive:true,force:true});});
  const violations=[], errors=[], analytics=[]; let downloads=0, copies=0, popups=0;
  const script = execFileSync('curl',['-fsSL','--max-time','30','-A','Mozilla/5.0',env.UMAMI_SCRIPT_URL],{encoding:'utf8'});
  assert.ok(script.includes('/api/send'));
  const context = await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true,permissions:['clipboard-read','clipboard-write']});
  // Execute the real fetched Umami script; intercept collection to avoid test traffic in production.
  await context.route(env.UMAMI_SCRIPT_URL,route=>route.fulfill({contentType:'text/javascript',body:script}));
  await context.route('https://unami-oclazi.vercel.app/api/send',async route=>{
    analytics.push(route.request().postDataJSON());
    await route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:'{"cache":"test"}'});
  });
  await context.route('https://ko-fi.com/**',route=>route.fulfill({contentType:'text/html',body:'<title>Ko-fi test destination</title>'}));
  await context.exposeBinding('recordViolation',(_,event)=>violations.push(event));
  await context.addInitScript(()=>document.addEventListener('securitypolicyviolation',e=>window.recordViolation({directive:e.effectiveDirective,blocked:e.blockedURI,page:location.pathname})));
  const page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(/content security policy|violates.*directive|refused to/i.test(m.text())) errors.push(m.text());});
  const checkNames=async()=>{
    const mismatches=await page.locator('.risk-focus,.lineage-link,.lineage-predecessor').evaluateAll(buttons=>buttons.flatMap(button=>{
      const visible=button.matches('.risk-focus') ? `${button.querySelector('.risk-rank').textContent} ${button.querySelector('.risk-name').textContent}` : button.matches('.lineage-link') ? `${button.querySelector('.lineage-id').textContent} ${button.querySelector('.lineage-title').textContent}` : button.textContent;
      return button.getAttribute('aria-label')?.startsWith(visible) ? [] : [visible];
    }));
    assert.deepEqual(mismatches,[]);
    assert.equal(await page.locator('#timeline-scroll').getAttribute('role'),'region');
    assert.equal(await page.locator('.lineage-rank[aria-label]').count(),0);
  };
  const exportFormats=async(id,formats)=>{
    for(const format of formats){
      await page.evaluate(async () => { await document.fonts.ready; await Promise.all(document.getAnimations().map(a=>a.finished.catch(()=>{}))); await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))); });
      await page.locator(`#${id}-button`).click();
      const [download]=await Promise.all([page.waitForEvent('download'), page.locator(`#${id}-menu [data-export=${format}]`).click()]); const data=await readFile(await download.path());
      assert.ok(data.length>100,format);
      if(format==='png') assert.equal(data.subarray(1,4).toString(),'PNG');
      if(format==='json') assert.ok(JSON.parse(data).length);
      if(['svg','png'].includes(format)) {
        const dimensions=await page.evaluate(async({data,format})=>{
          const img=new Image();img.src=`data:image/${format==='svg'?'svg+xml':'png'};base64,${data}`;await img.decode();
          const canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);
          return [img.width,img.height,ctx.getImageData(0,0,1,1).data[3]];
        },{data:data.toString('base64'),format});
        assert.ok(dimensions[0]>100&&dimensions[1]>100&&dimensions[2]>0);
      }
      downloads++;
    }
    await page.locator(`#${id}-button`).click();
    await page.locator(`#${id}-menu [data-export=copy]`).click();
    await page.waitForFunction(id=>document.querySelector(`#${id}-menu [data-export=copy] svg`)?.dataset.icon==='check',id);
    assert.ok((await page.evaluate(()=>navigator.clipboard.readText())).startsWith('# '));copies++;
    await page.keyboard.press('Escape');
  };
  for(const language of ['en','es']) {
    const response=await page.goto(server.origin+(language==='es'?'/es/':'/'));
    assert.match(response.headers()['content-security-policy'],/sha256-/);
    await page.locator('.risk-focus').first().waitFor(); await checkNames();
    if(await page.locator('#detail-modal').evaluate(el=>el.open)) await page.keyboard.press('Escape');
    const search=page.locator('#risk-search'); await search.fill('injection'); await search.press('ArrowDown');
    assert.equal(await search.getAttribute('aria-activedescendant'),'search-option-0');
    await search.press('ArrowDown'); assert.equal(await search.getAttribute('aria-activedescendant'),'search-option-1');
    await search.press('ArrowUp'); assert.equal(await search.getAttribute('aria-activedescendant'),'search-option-0');
    const target=await page.locator('#search-option-0').innerText(); await search.press('Enter');
    assert.equal(await search.getAttribute('aria-expanded'),'false'); assert.ok(target.includes('Injection'));
    assert.ok((await page.locator('.is-selected .risk-name').textContent()).includes('Injection'));
    await search.fill('injection'); await search.press('ArrowDown'); await search.press('Escape');
    assert.equal(await search.getAttribute('aria-activedescendant'),null);
    await exportFormats('export',['png','svg','csv','json','md']);
    await page.goto(server.origin+(language==='es'?'/es':'')+'/web/2013/a1-injection/');
    await page.locator('#detail-modal[open]').waitFor(); await checkNames();
    assert.ok((await page.locator('.lineage-origin').first().textContent()).includes(language==='es'?'Primera edición mostrada':'First edition shown'));
    await exportFormats('detail-export',['png','svg','md']);
    await exportFormats('export',['png','svg']);
    const popupPromise=context.waitForEvent('page');
    await page.locator('#detail-page .support-link').click();const popup=await popupPromise;await popup.waitForLoadState();
    assert.ok(popup.url().startsWith('https://ko-fi.com/'));await popup.close();popups++;
  }
  // Open during actual smooth scrolling at the two reported sizes. Old code closes immediately.
  for(const [width,height] of [[768,1024],[844,390]]) {
    await page.setViewportSize({width,height});
    await page.goto(server.origin+'/web/2025/a05-injection/');
    await page.locator('#detail-modal[open]').waitFor();
    for(let cycle=0;cycle<3;cycle++) {
      await page.locator('#detail-export-button').click();
      await page.locator('.detail-body').evaluate((el,cycle)=>el.scrollTo({top:cycle%2?0:el.scrollHeight,behavior:'smooth'}),cycle);
      await page.waitForTimeout(650);
      assert.equal(await page.locator('#detail-export-menu').isVisible(),true);
      await page.keyboard.press('ArrowDown'); await page.keyboard.press('Escape');
      assert.equal(await page.locator('#detail-export-menu').isVisible(),false);
      assert.equal(await page.locator('#detail-modal').evaluate(el=>el.open),true);
    }
  }
  await page.setViewportSize({width:1440,height:1000});
  await page.goto(server.origin+'/es/genai/2025/llm01-prompt-injection/');
  await page.locator('#detail-modal[open]').waitFor();
  assert.match(await page.locator('#detail-page pre code').textContent(), /Tarea: Resume esta página/);
  assert.doesNotMatch(await page.locator('#detail-page pre code').textContent(), /Task:|Answer:/);
  await checkNames();
  // Initial-visit rendering also works without executing the bootstrap or application.
  const nojs = await browser.newPage({javaScriptEnabled:false});
  await nojs.goto(server.origin+'/es/genai/2025/llm01-prompt-injection/');
  assert.match(await nojs.locator('#prerender pre code').textContent(), /Tarea: Resume esta página/);
  await nojs.close();
  const html=await (await fetch(server.origin+'/')).text();
  for(const path of [html.match(/href="(\/styles-[^"]+)"/)[1],html.match(/src="(\/assets\/app-[^"]+)"/)[1]]) assert.equal((await fetch(server.origin+path)).headers.get('cache-control'),'public, max-age=31536000, immutable');
  for(const path of ['/','/es/','/assets/fonts/Geist-Regular.woff2']) assert.equal((await fetch(server.origin+path)).headers.get('cache-control'),'public, max-age=0, must-revalidate');
  for(const [from,to] of [['/en/','/'],['/en/web/2025/a05-injection/','/web/2025/a05-injection/']]) {
    const r=await fetch(server.origin+from,{redirect:'manual'});assert.equal(r.status,308);assert.equal(r.headers.get('location'),to);
  }
  assert.equal((await fetch(server.origin+'/missing/')).status,404);
  await page.waitForFunction(()=>Boolean(window.umami));
  assert.ok(analytics.length>=4); assert.deepEqual(violations,[]);assert.deepEqual(errors,[]);
  console.log(JSON.stringify({cspViolations:violations.length,consoleErrors:errors.length,downloads,copies,popups,analyticsRequests:analytics.length,menuScrollCycles:6}));
});
