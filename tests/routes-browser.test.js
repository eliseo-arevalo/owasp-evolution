import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
test('deep links hydrate, old hashes migrate and browser history restores selection', {skip:!process.env.MOTION_PLAYWRIGHT}, async()=>{
 const {chromium}=await import(process.env.MOTION_PLAYWRIGHT);
 const server=spawn('python3',['-m','http.server','4193','-d','dist'],{stdio:'ignore'});
 const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
 try {const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:4193/en/web/2025/a01-broken-access-control/');await page.waitForSelector('#detail-title');
 assert.match(await page.locator('#detail-title').textContent(),/Broken Access Control/);assert.equal(await page.locator('html').getAttribute('lang'),'en');
 await page.goto('http://localhost:4193/#/web/2025/A01/detalle');await page.waitForSelector('#detail-title');assert.ok(page.url().endsWith('/web/2025/a01-broken-access-control/'));
 await page.keyboard.press('Escape');await page.waitForTimeout(300);
 await page.locator('[data-key="2025:A02"] .risk-focus').click();const selectedUrl=page.url();await page.locator('[data-key="2025:A03"] .risk-focus').click();await page.goBack();assert.equal(page.url(),selectedUrl);
 assert.equal(await page.locator('.is-selected').getAttribute('data-key'),'2025:A02');await page.reload();await page.waitForSelector('#detail-title');assert.match(await page.locator('#detail-title').textContent(),/Security Misconfiguration/);assert.deepEqual(errors,[]);
 }finally {await browser.close();server.kill();}
});
test('skip link moves focus to the explorer and URL language overrides saved preference', {skip:!process.env.MOTION_PLAYWRIGHT}, async()=>{
 const {chromium}=await import(process.env.MOTION_PLAYWRIGHT);
 const server=spawn('python3',['-m','http.server','4195','-d','dist'],{stdio:'ignore'});
 const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
 try {const page=await browser.newPage({reducedMotion:'reduce'});await page.addInitScript(()=>localStorage.setItem('owasp-language','en'));
 await page.goto('http://localhost:4195/');await page.waitForSelector('.risk-focus');assert.equal(await page.locator('html').getAttribute('lang'),'es');
 await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.className),'skip-link');await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>document.activeElement.id),'timeline');
 await page.goto('http://localhost:4195/en/');await page.waitForSelector('.risk-focus');await page.locator('[data-language="es"]').click();assert.equal(await page.locator('#risk-search').getAttribute('placeholder'),'Buscar categorías');assert.equal(new URL(page.url()).pathname,'/');
 }finally{await browser.close();server.kill();}
});
