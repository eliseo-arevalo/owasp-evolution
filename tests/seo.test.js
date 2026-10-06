import test from 'node:test';
import assert from 'node:assert/strict';
import { generateSeo } from '../scripts/seo.js';
import {catalog} from '../src/data.js';
import {pathFor,routeFrom} from '../src/routes.js';
test('every route has unique metadata, static content and paired alternates',()=>{
 const origin = new URL(process.env.SITE_URL || JSON.parse(awaitPackage()).homepage).origin;
 const files=generateSeo(); const titles=new Set(); const descriptions=new Set(); let count=0;
 for(const lang of ['es','en']) for(const family of Object.values(catalog.families)) for(const edition of family.editions) for(const item of edition.items){
 const route={family:family.id,year:edition.year,id:item.id};const path=pathFor(route,catalog,lang);const html=files.get(path.slice(1)+'index.html');
 assert.ok(html);assert.ok(html.includes(item.name.replaceAll('&','&amp;')));assert.ok(html.includes(item.source));assert.match(html,/application\/ld\+json/);
 const title=html.match(/<title>(.*?)<\/title>/)[1];const description=html.match(/<meta name="description" content="([^"]*)"/)[1];assert.ok(!titles.has(title));assert.ok(!descriptions.has(description));titles.add(title);descriptions.add(description);
 for(const l of ['es','en']) assert.ok(html.includes(`hreflang="${l}" href="${origin}${pathFor(route,catalog,l)}"`));
 assert.equal(routeFrom(path,catalog).id,item.id);count++;
 }
 assert.equal([...files.get('sitemap.xml').matchAll(/<loc>/g)].length,count+6);
 assert.ok(!files.get('sitemap.xml').includes('<loc>/'));
});
import {readFileSync} from 'node:fs';
function awaitPackage(){return readFileSync(new URL('../package.json',import.meta.url),'utf8');}
test('sitemap only lists actual pages and reciprocal language pairs',()=>{
 const files=generateSeo();const xml=files.get('sitemap.xml');
 const locations=[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>new URL(m[1]));
 assert.equal(new Set(locations.map(u=>u.href)).size,locations.length);
 assert.equal(locations.length,126);
 for(const url of locations){assert.ok(url.pathname.endsWith('/'));assert.ok(files.has(url.pathname.slice(1)+'index.html'));}
 for(const [,html] of files)if(html.startsWith('<!doctype html>') && html.includes('rel="canonical"')){
  const canonical=html.match(/rel="canonical" href="([^"]+)"/)[1];
  const alternates=[...html.matchAll(/rel="alternate" hreflang="(es|en|x-default)" href="([^"]+)"/g)];assert.equal(alternates.length,3);
  for(const [,lang,href] of alternates){const target=files.get(new URL(href).pathname.slice(1)+'index.html');assert.ok(target.includes(`href="${canonical}"`));if(lang!=='x-default')assert.ok(target.includes(`<html lang="${lang}">`));}
  assert.doesNotThrow(()=>JSON.parse(html.match(/<script type="application\/ld\+json">([^]*?)<\/script>/)[1]));
 }
});
