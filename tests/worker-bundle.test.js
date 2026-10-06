import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWorkerBundle } from '../scripts/worker-bundle.js';
test('optional worker preserves path language and delegates static asset serving', async()=>{
 const script=await buildWorkerBundle();
 const {default:worker}=await import(`data:text/javascript;base64,${Buffer.from(script).toString('base64')}`);
 const request=new Request('https://example.com/en/');
 assert.equal(await worker.fetch(request,{ASSETS:{fetch:r=>r.url}}),request.url);
});
