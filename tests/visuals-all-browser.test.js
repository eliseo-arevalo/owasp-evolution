import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { catalog } from '../src/data.js';
import { pathFor } from '../src/routes.js';
const entries = Object.values(catalog.families).flatMap(f => f.editions.flatMap(e => e.items.map(i => ({family: f.id, year:e.year, id:i.id}))));

test('Chrome: all 60 categories fit both languages/themes at dock widths 360/420/520, fullscreen and 390px', {skip: !process.env.MOTION_PLAYWRIGHT}, async () => {
  const {chromium} = await import(process.env.MOTION_PLAYWRIGHT);
  const server = spawn('python3',['-m','http.server','4208','-d','dist'],{stdio:'ignore'});
  const browser = await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
  const page = await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  const errors = [], results = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => {if(m.type()==='error') errors.push(m.text());});
  page.on('response', r => {if(r.status()>=400) errors.push(`${r.status()} ${r.url()}`);});
  const measure = () => page.locator('#detail-page').evaluate(panel => {
    const body=panel.querySelector('.detail-body'), tabs=panel.querySelector('.detail-tabs'), title=panel.querySelector('h1'), svg=panel.querySelector('.attack-diagram'), pre=panel.querySelector('pre');
    const tr=tabs.getBoundingClientRect();
    const labels=[...svg.querySelectorAll('text')].map(el=>({text:el.textContent,b:el.getBBox()}));
    const collisions=[];
    for(const path of svg.querySelectorAll('.attack-path')) for(let n=0;n<=path.getTotalLength();n++) {
      const q=path.getPointAtLength(n);
      for(const {text,b} of labels) if(q.x>b.x&&q.x<b.x+b.width&&q.y>b.y&&q.y<b.y+b.height&&!collisions.includes(text)) collisions.push(text);
    }
    const overlap=[];
    for(let i=0;i<labels.length;i++)for(let j=i+1;j<labels.length;j++) {
      const a=labels[i].b,b=labels[j].b;
      if(a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y)overlap.push([labels[i].text,labels[j].text]);
    }
    const nodes=[...svg.querySelectorAll('.attack-node')];
    const cardOverflow=nodes.flatMap(g=>{
      const rect=g.querySelector(':scope > rect');if(!rect)return[];const b=rect.getBBox();
      return [...g.querySelectorAll(':scope > text')].filter(t=>{const a=t.getBBox();return a.y>b.y&&a.y+a.height<b.y+b.height&&(a.x<b.x+3||a.x+a.width>b.x+b.width-3);}).map(t=>t.textContent);
    });
    const iconOverlap=nodes.flatMap(g=>{
      const icon=g.querySelector(':scope > svg');if(!icon)return[];const b={x:+icon.getAttribute('x'),y:+icon.getAttribute('y'),width:+icon.getAttribute('width'),height:+icon.getAttribute('height')};
      return [...g.querySelectorAll(':scope > text')].filter(t=>{const a=t.getBBox();return a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;}).map(t=>t.textContent);
    });
    return {pageOverflow:document.documentElement.scrollWidth-innerWidth,bodyOverflow:body.scrollWidth-body.clientWidth,codeOverflow:pre.scrollWidth-pre.clientWidth,titleClipped:title.scrollHeight>title.clientHeight+1,
      tabs:[...tabs.querySelectorAll('a')].map(a=>{const b=a.getBoundingClientRect();return {text:a.textContent,visible:b.x>=tr.x-.5&&b.right<=tr.right+.5&&b.y>=tr.y-.5&&b.bottom<=tr.bottom+.5};}),
      labelsOutside:labels.filter(({b})=>b.x<0||b.x+b.width>320||b.y<0||b.y+b.height>196).map(({text})=>text),collisions,overlap,cardOverflow,iconOverlap,
      rows:document.querySelectorAll('.risk-focus').length,icons:document.querySelectorAll('.risk-focus .matrix-icon').length,
      visibleIcons:[...document.querySelectorAll('.risk-focus .matrix-icon')].filter(e=>e.getBoundingClientRect().width>0&&e.getBoundingClientRect().height>0).length,
      rowNamesAccessible:[...document.querySelectorAll('.risk-focus')].every(b=>b.title.includes(b.querySelector('.risk-name').textContent)&&b.getAttribute('aria-label').includes(b.querySelector('.risk-name').textContent))};
  });
  try {
    for(const language of ['en','es']) for(const entry of entries) {
      await page.setViewportSize({width:1440,height:1000});
      await page.goto('http://localhost:4208'+pathFor(entry,catalog,language));
      await page.locator('#detail-page .attack-diagram').waitFor();await page.evaluate(()=>document.fonts.ready);
      for(const theme of ['dark','light']) {
        await page.locator('#theme-select').click();await page.locator(`[data-theme-choice="${theme}"]`).click();
        for(const width of [360,420,520,'fullscreen',390]) {
          if(width==='fullscreen') await page.locator('#detail-page [data-action="fullscreen"]').click();
          else if(width===390) {await page.locator('#detail-page [data-action="fullscreen"]').click();await page.setViewportSize({width:390,height:844});}
          else {await page.setViewportSize({width:1440,height:1000});await page.evaluate(w=>document.querySelector('.explorer-shell').style.setProperty('--dock-size',`${w}px`),width);}
          await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
          const m=await measure(), context=JSON.stringify({language,...entry,theme,width,...m});
          assert.equal(m.pageOverflow,0,context);assert.equal(m.bodyOverflow,0,context);assert.equal(m.codeOverflow,0,context);assert.equal(m.titleClipped,false,context);
          assert.equal(m.tabs.length,6,context);assert.ok(m.tabs.every(t=>t.visible),context);
          for(const field of ['labelsOutside','collisions','overlap','cardOverflow','iconOverlap'])assert.deepEqual(m[field],[],context);
          assert.equal(m.rows,m.icons,context);assert.equal(m.rows,m.visibleIcons,context);assert.ok(m.rowNamesAccessible,context);
          results.push({language,...entry,theme,width,...m});
        }
        await page.setViewportSize({width:1440,height:1000});
      }
    }
    assert.deepEqual(errors,[]);
    await writeFile('/workspace/tmp/owasp-all-browser-measurements.json',JSON.stringify(results,null,2));
  }finally {await browser.close();server.kill();}
});
