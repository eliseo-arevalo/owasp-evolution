import test from 'node:test';
import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
test('Chrome centers every edition count and keeps connectors aligned across viewport and dock sizes', { skip: !process.env.MOTION_PLAYWRIGHT }, async () => {
  const { chromium } = await import(process.env.MOTION_PLAYWRIGHT);
  const server=spawn('python3',['-m','http.server','4194','-d','dist'],{stdio:'ignore'});
  const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
  const results=[];
  try {
  for(const width of [1440,1024,390]) for(const count of [2,3,4]) for(const dock of ['none','left','right']) {
  const page=await browser.newPage({viewport:{width,height:900}});
  await page.goto('http://localhost:4194/#/web/2025/A01');await page.waitForTimeout(1300);
  while(await page.locator('.edition-toggle[aria-pressed="true"]').count()>count) {await page.locator('.edition-toggle[aria-pressed="true"]').first().click();await page.waitForTimeout(300);}
  while(await page.locator('.edition-toggle[aria-pressed="true"]').count()<count) {await page.locator('.edition-toggle[aria-pressed="false"]').first().click();await page.waitForTimeout(300);}
  // Narrow screens use fullscreen regardless of the saved desktop dock.
  if(dock!=='none') {await page.locator('.risk-detail').first().click();await page.waitForTimeout(300);if (width > 760) { await page.locator('[data-action="overflow"]').click(); await page.locator(`#dock-select [data-dock="${dock}"]`).click(); } await page.waitForTimeout(350);}
  const m=await page.evaluate(async ()=>{await new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,0)));const stage=document.querySelector('#timeline-stage').getBoundingClientRect();const cols=[...document.querySelectorAll('#timeline-grid > .edition-column')].map(x=>x.getBoundingClientRect());let error=0;for(const p of document.querySelectorAll('#connector-layer > path[data-edge]')){const [a,b]=p.dataset.edge.split('>');const x=document.querySelector(`.risk-card[data-key="${a}"]`).getBoundingClientRect(),y=document.querySelector(`.risk-card[data-key="${b}"]`).getBoundingClientRect();const n=p.getAttribute('d').match(/-?[\d.]+/g).map(Number);error=Math.max(error,Math.abs(n[0]-(x.right-stage.left)),Math.abs(n[6]-(y.left-stage.left)),Math.abs(n[1]-(x.top-stage.top+x.height/2)),Math.abs(n[7]-(y.top-stage.top+y.height/2)));}return {left:cols[0].left-stage.left,right:stage.right-cols.at(-1).right,error,overflow:document.documentElement.scrollWidth-innerWidth,actualDock:document.querySelector('.explorer-shell').dataset.dock};});
  assert.ok(Math.abs(m.left-m.right)<=2,JSON.stringify({width,count,dock,...m}));assert.ok(m.error<1,JSON.stringify({width,count,dock,...m}));assert.equal(m.overflow,0);if(dock!=='none') assert.equal(m.actualDock,width===390?'fullscreen':dock);results.push({width,count,dock,...m});
  if(width===1440&&dock==='none'&&[2,3].includes(count)||width===1440&&count===3&&dock==='right'||width===390&&count===3&&dock==='none') await page.screenshot({path:`/workspace/tmp/owasp-center-${width}-${count}-${dock}.png`});
  await page.close();
  }
  await writeFile('/workspace/tmp/owasp-center-measurements.json',JSON.stringify(results,null,2));
  console.log('Verified',results.length,'cases; max imbalance',Math.max(...results.map(x=>Math.abs(x.left-x.right))));
  } finally {await browser.close();server.kill();}
  
});
