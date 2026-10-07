import test from 'node:test';
import assert from 'node:assert/strict';
import { generateSeo } from '../scripts/seo.js';
import {catalog} from '../src/data.js';
import {pathFor,routeFrom,languageOf} from '../src/routes.js';
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

test('English is the default URL language and Spanish has its own prefix', () => {
 assert.equal(pathFor(null,catalog),'/');
 assert.equal(pathFor(null,catalog,'es'),'/es/');
 for(const lang of ['en','es']) for(const family of Object.values(catalog.families)) {
  const edition=family.editions[0];const item=edition.items[0];
  const route={family:family.id,year:edition.year,id:item.id};
  const path=pathFor(route,catalog,lang);
  assert.equal(languageOf(path),lang);
  assert.deepEqual(routeFrom(path,catalog),{...route,detail:true});
  if(lang==='en') assert.deepEqual(routeFrom('/en'+path,catalog),routeFrom(path,catalog));
 }
 for(const path of ['/','/web/','/genai/','/en','/en/','/en/web/','/esoteric/']) assert.equal(languageOf(path),'en');
 for(const path of ['/es','/es/','/es/web/','/es/genai/']) assert.equal(languageOf(path),'es');
 for(const path of ['/','/en/','/es/']) {
  const route=routeFrom(path,catalog,'#/llm/2026/LLM03/detalle');
  assert.equal(pathFor(route,catalog,languageOf(path)),`${path==='/es/'?'/es':''}/genai/2026/llm03-excessive-agency/`);
 }
});

test('root previews are English, aliases share canonical HTML, and discovery uses canonical URLs', () => {
 const files=generateSeo();const origin=new URL(process.env.SITE_URL || JSON.parse(awaitPackage()).homepage).origin;
 const root=files.get('index.html');
 assert.match(root,/<html lang="en">/);
 assert.match(root,/<title>OWASP Evolution · Risk evolution<\/title>/);
 assert.match(root,/<meta property="og:description" content="Interactive explorer/);
 assert.ok(root.includes(`property="og:image" content="${origin}/assets/og-web-en.png"`));
 assert.ok(root.includes(`hreflang="x-default" href="${origin}/"`));
 for(const {pathname} of [...files.get('sitemap.xml').matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>new URL(m[1]))) {
  const html=files.get(pathname.slice(1)+'index.html');
  const lang=languageOf(pathname);
  assert.ok(html.includes(`data-language="${lang}" aria-pressed="true"`));
  assert.ok(html.includes(`data-language="${lang==='en'?'es':'en'}" aria-pressed="false"`));
  assert.ok(html.includes(`class="brand" href="${lang==='es'?'/es/':'/'}"`));
  if(lang==='en') assert.equal(files.get('en/'+pathname.slice(1)+'index.html'),html);
  const route=pathname==='/' || pathname==='/es/' ? null : /\/\d{4}\//.test(pathname) ? routeFrom(pathname,catalog) : {family:routeFrom(pathname,catalog).family};
  assert.ok(html.includes(`hreflang="x-default" href="${origin}${pathFor(route,catalog,'en')}"`));
 }
 assert.ok(!files.get('sitemap.xml').includes(`${origin}/en/`));
 assert.ok(files.get('llms.txt').includes(`[English](${origin}/)`));
 assert.ok(files.get('llms.txt').includes(`[Spanish](${origin}/es/)`));
 assert.ok(files.get('robots.txt').includes(`Sitemap: ${origin}/sitemap.xml`));
 assert.ok(files.get('404.html').includes('<a href="/es/">Inicio</a>'));
});
