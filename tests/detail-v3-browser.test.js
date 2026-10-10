import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { catalog } from '../src/data.js';
import { iconSVG, attackSectionHTML } from '../src/visuals.js';
import { pathFor } from '../src/routes.js';
import { translate } from '../src/i18n.js';
const items = catalog.families.web.editions.find(e => e.year === 2025).items;

test('Chrome: live detail navigation, keyboard, fullscreen focus, bilingual help and 2x diagram audit', { skip: !process.env.MOTION_PLAYWRIGHT }, async () => {
  const { chromium } = await import(process.env.MOTION_PLAYWRIGHT);
  const server = spawn('python3', ['-m', 'http.server', '4196', '-d', 'dist'], { stdio:'ignore' });
  const browser = await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
  const base = 'http://localhost:4196';
  const route = (id, lang='es') => base + pathFor({family:'web',year:2025,id},catalog,lang);
  const errors=[];
  try {
    const page = await browser.newPage({ viewport:{width:1440,height:1000}, colorScheme:'dark' });
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(route('A01')); await page.locator('#detail-modal[open]').waitFor();
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.evaluate(() => {
      window.panelEvents=[];
      new MutationObserver(records=>records.forEach(r=>window.panelEvents.push(r.attributeName))).observe(document.querySelector('#detail-modal'),{attributes:true,attributeFilter:['open']});
      document.querySelector('#detail-page .detail-body').scrollTop=400;
    });
    const length = await page.evaluate(()=>history.length);
    await page.locator('.risk-card[data-key="2025:A02"] .risk-focus').click();
    await page.waitForFunction(()=>document.querySelector('#detail-title').textContent==='Security Misconfiguration');
    assert.equal(await page.locator('#detail-modal').evaluate(d=>d.open),true);
    assert.equal(await page.locator('#detail-page .detail-body').evaluate(d=>d.scrollTop),0);
    assert.equal(await page.evaluate(()=>history.length),length+1);
    assert.equal(page.url(),route('A02'));
    await page.locator('#detail-page [data-action="copy"]').click();
    assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),route('A02'));
    assert.deepEqual(await page.evaluate(()=>window.panelEvents),[]);
    await page.waitForTimeout(250);
    assert.equal(await page.locator('.detail-crossfade').count(),0);
    await page.goBack(); assert.equal(page.url(),route('A01'));
    assert.equal(await page.locator('#detail-modal').evaluate(d=>d.open),true);
    await page.goForward(); assert.equal(page.url(),route('A02'));
    assert.equal(await page.locator('#detail-modal').evaluate(d=>d.open),true);
    // Both connector and row selection keep the panel mounted.
    const endpoint = await page.locator('.connector-hit').last().getAttribute('data-key');
    await page.locator('.connector-hit').last().dispatchEvent('click',{detail:1});
    assert.equal(await page.locator('#detail-modal').evaluate(d=>d.open),true);
    assert.equal(await page.locator('.risk-card.is-selected').getAttribute('data-key'),endpoint);
    assert.deepEqual(await page.evaluate(()=>window.panelEvents),[]);
    await page.goto(route('A01')); await page.locator('.detail-back').focus();
    await page.keyboard.press('ArrowDown'); assert.equal(page.url(),route('A02'));
    await page.keyboard.press('k'); assert.equal(page.url(),route('A01'));
    await page.keyboard.press('j'); assert.equal(page.url(),route('A02'));
    await page.keyboard.press('ArrowUp'); assert.equal(page.url(),route('A01'));
    await page.keyboard.press('['); assert.ok(page.url().includes('/2021/'));
    await page.keyboard.press(']'); assert.equal(page.url(),route('A01'));
    await page.keyboard.press('ArrowLeft'); assert.ok(page.url().includes('/2021/'));
    await page.keyboard.press('ArrowRight'); assert.equal(page.url(),route('A01'));
    for(const [key,side] of [['2','right'],['3','bottom'],['1','left']]) {
      await page.keyboard.press(key); assert.equal(await page.locator('.explorer-shell').getAttribute('data-dock'),side);
    }
    await page.keyboard.press('f');
    assert.equal(await page.locator('#detail-modal').evaluate(d=>d.matches(':modal')),true);
    assert.equal(await page.locator('#detail-page .detail-grid').evaluate(d=>getComputedStyle(d).gridTemplateColumns.split(' ').length),2);
    const controls = page.locator('#detail-page button:not([disabled]), #detail-page a[href]');
    await controls.last().focus(); await page.keyboard.press('Tab');
    assert.ok(await controls.first().evaluate(d=>document.activeElement===d));
    await page.keyboard.press('Shift+Tab'); assert.ok(await controls.last().evaluate(d=>document.activeElement===d));
    await page.keyboard.press('j'); assert.equal(page.url(),route('A02'));
    assert.equal(await page.locator('#detail-modal').evaluate(d=>d.matches(':modal')),true);
    await page.waitForFunction(()=>document.querySelector('#detail-modal').contains(document.activeElement));
    await page.keyboard.press('?'); assert.ok(await page.locator('#shortcuts-dialog').evaluate(d=>d.matches(':modal')));
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#shortcuts-dialog').evaluate(d=>d.open),false);
    assert.equal(await page.locator('#detail-modal').evaluate(d=>d.matches(':modal')),true);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#detail-modal').evaluate(d=>d.open && !d.matches(':modal')),true);
    await page.keyboard.press('?');
    assert.ok(await page.locator('#shortcuts-dialog').evaluate(d=>d.matches(':modal')));
    assert.equal(await page.locator('#shortcuts-dialog .shortcuts-list kbd').count(),9);
    assert.equal(await page.locator('#shortcuts-dialog dd span[lang="en"]').count(),9);
    assert.ok((await page.locator('#shortcuts-dialog').textContent()).includes('Focus search'));
    const helpClose=page.locator('#shortcuts-dialog button');
    await page.keyboard.press('Tab'); assert.ok(await helpClose.evaluate(d=>document.activeElement===d));
    await page.keyboard.press('Shift+Tab'); assert.ok(await helpClose.evaluate(d=>document.activeElement===d));
    await page.screenshot({path:'/workspace/tmp/owasp-v3-shortcuts.png'});
    await page.keyboard.press('Escape'); assert.equal(await page.locator('#shortcuts-dialog').evaluate(d=>d.open),false);
    assert.ok(await page.locator('#detail-modal').evaluate(d=>d.open));
    await page.keyboard.press('/'); assert.ok(await page.locator('#risk-search').evaluate(d=>d===document.activeElement));
    const beforeTyping=page.url();
    await page.keyboard.type('jkf123[]?'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
    assert.equal(page.url(),beforeTyping);
    assert.equal(await page.locator('#shortcuts-dialog').evaluate(d=>d.open),false);
    await page.locator('.detail-back').focus(); await page.keyboard.press('Control+k');
    assert.ok(await page.locator('#risk-search').evaluate(d=>d===document.activeElement));
    await page.locator('.detail-back').focus(); await page.keyboard.press('Meta+k');
    assert.ok(await page.locator('#risk-search').evaluate(d=>d===document.activeElement));
    await page.locator('.detail-back').focus(); await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    assert.equal(await page.locator('#detail-modal').evaluate(d=>d.open),false);
    const selected=page.locator('.is-selected .risk-focus'); await selected.focus();
    await page.keyboard.press('ArrowDown'); assert.ok(await page.locator('.risk-card[data-key="2025:A03"] .risk-focus').evaluate(d=>d===document.activeElement));
    assert.equal(await page.locator('#detail-modal').evaluate(d=>d.open),false);
    await page.keyboard.press('Enter'); assert.ok(await page.locator('#detail-modal').evaluate(d=>d.open)); assert.equal(page.url(),route('A03'));
    // Item export uses the selected category, independent of visible years.
    const download=page.waitForEvent('download'); await page.locator('#detail-page [data-action="markdown"]').click();
    const file=await download; assert.equal(file.suggestedFilename(),'owasp-web-2025-A03.md');
    await page.goto(route('A01')); await page.evaluate(()=>document.fonts.ready); await page.waitForTimeout(300);
    await page.evaluate(()=>document.activeElement.blur());
    await page.screenshot({path:'/workspace/tmp/owasp-v3-detail-left-dark-a01-1440.png'});
    await page.goto(route('A03')); await page.locator('#theme-select').click(); await page.locator('[data-theme-choice="light"]').click();
    await page.locator('#detail-page [data-action="fullscreen"]').click(); await page.evaluate(()=>document.fonts.ready);
    await page.evaluate(()=>document.activeElement.blur());
    await page.screenshot({path:'/workspace/tmp/owasp-v3-fullscreen-light-a03-1440.png'});
    await page.close();

    // 2x density plus geometry checks on every label, node and arrow in both languages.
    const audit=[];
    for(const theme of ['dark','light']) for(const [side,width] of [['left',360],['right',520],['bottom',520]]) {
      const p=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:2,colorScheme:theme,reducedMotion:'reduce'});
      p.on('pageerror',e=>errors.push(e.message));
      await p.addInitScript(({side,width,theme})=>{
        localStorage.setItem('owasp-theme',theme);
        localStorage.setItem('owasp-dock-layout',JSON.stringify({desktop:{side,width,height:680}}));
      },{side,width,theme});
      for(const item of items) for(const lang of ['es','en']) {
        await p.goto(route(item.id,lang)); await p.evaluate(()=>document.fonts.ready);
        const m=await p.locator('#detail-page .attack-diagram').evaluate(svg=>{
          const labels=[...svg.querySelectorAll('text')].map(el=>({text:el.textContent,box:el.getBBox()}));
          const collide=(a,b)=>a.x<b.x+b.width && a.x+a.width>b.x && a.y<b.y+b.height && a.y+a.height>b.y;
          const collision=[];
          for(let i=0;i<labels.length;i++)for(let j=i+1;j<labels.length;j++)if(collide(labels[i].box,labels[j].box))collision.push(`${labels[i].text} / ${labels[j].text}`);
          const paths=[...svg.querySelectorAll('.attack-path')];
          for(const path of paths)for(let n=0;n<path.getTotalLength();n++) {
            const p=path.getPointAtLength(n);
            for(const label of labels)if(p.x>label.box.x && p.x<label.box.x+label.box.width && p.y>label.box.y && p.y<label.box.y+label.box.height)collision.push(label.text);
          }
          const root=svg.getBoundingClientRect(), scale=root.width/320;
          const icons=[...svg.querySelectorAll('svg[data-actor]')].map(el=>{const r=el.getBoundingClientRect();return {x:(r.x-root.x)/scale,y:(r.y-root.y)/scale,width:r.width/scale,height:r.height/scale};});
          for(const icon of icons)for(const label of labels)if(collide(icon,label.box))collision.push(`icon / ${label.text}`);
          const tiles=[...svg.querySelectorAll('rect')].map(el=>el.getBBox());
          for(let i=0;i<tiles.length;i++)for(let j=i+1;j<tiles.length;j++)if(collide(tiles[i],tiles[j]))collision.push('node overlap');
          const panel=document.querySelector('#detail-page .detail-body');
          return {collision:[...new Set(collision)],clipped:labels.filter(({box:b})=>b.x<0 || b.x+b.width>320 || b.y<0 || b.y+b.height>196).map(l=>l.text),overflow:panel.scrollWidth-panel.clientWidth,pageOverflow:document.documentElement.scrollWidth-innerWidth};
        });
        const label=`${theme} ${side} ${width}px ${lang} ${item.id}`;
        assert.deepEqual(m.collision,[],label); assert.deepEqual(m.clipped,[],label); assert.equal(m.overflow,0,label); assert.equal(m.pageOverflow,0,label);
        audit.push({label,...m});
        if(theme==='dark' && side==='left' && lang==='es') await p.locator('#detail-page .attack-diagram').screenshot({path:`/workspace/tmp/owasp-v3-audit-${item.id}-2x.png`});
      }
      await p.close();
    }
    await writeFile('/workspace/tmp/owasp-v3-audit.json',JSON.stringify(audit,null,2));
    const mobile=await browser.newPage({viewport:{width:390,height:1000},colorScheme:'light',reducedMotion:'reduce',deviceScaleFactor:2});
    await mobile.addInitScript(()=>localStorage.setItem('owasp-dock-layout',JSON.stringify({mobile:{height:730}})));
    await mobile.goto(route('A07')); await mobile.evaluate(()=>document.fonts.ready);
    assert.equal(await mobile.locator('#detail-page .detail-body').evaluate(d=>d.scrollWidth-d.clientWidth),0);
    await mobile.locator('#detail-page .detail-section-nav a[href="#detail-attack"]').click();
    await mobile.evaluate(()=>document.activeElement.blur());
    await mobile.screenshot({path:'/workspace/tmp/owasp-v3-detail-light-a07-390.png'}); await mobile.close();
    const css=(await readFile(new URL('../styles.css',import.meta.url),'utf8')).replaceAll('./assets/',`${base}/assets/`);
    const gallery=`<!doctype html><html lang="es" data-theme="dark"><meta charset="utf-8"><style>${css}
      body{padding:28px}h1{font-size:26px;margin:0 0 20px}.gallery{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.card{border:1px solid var(--line-strong);border-radius:12px;padding:18px;min-width:0}.card h2{display:flex;align-items:center;gap:12px;font-size:17px;margin:0}.attack-section{border:0}.attack-explainer{grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:18px}.attack-description{font-size:12px}.attack-example{align-self:center}
      </style><h1>OWASP Web 2025 · Diez escenarios de ataque</h1><div class="gallery">${items.map(item=>`<article class="card"><h2>${iconSVG('web',2025,item.id)}${item.id} · ${item.name}</h2>${attackSectionHTML('web',2025,item.id,text=>translate(text,'es'))}</article>`).join('')}</div></html>`;
    await writeFile('/workspace/tmp/owasp-v3-contact.html',gallery);
    const sheet=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:2,reducedMotion:'reduce'});
    await sheet.setContent(gallery); await sheet.evaluate(()=>document.fonts.ready);
    await sheet.screenshot({path:'/workspace/tmp/owasp-v3-contact-all10-dark.png',fullPage:true}); await sheet.close();
    assert.deepEqual(errors,[]);
    console.log(`2x diagram audit: ${audit.length} layouts, no clipped labels, collisions or overflow`);
  } finally {await browser.close();server.kill();}
});
