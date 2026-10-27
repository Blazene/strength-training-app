import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPreviewAsset } from '../../scripts/preview-files.mjs';

const frontend = fileURLToPath(new URL('../../', import.meta.url));
export async function offlineUpdateCase({ browserType, engine, artifacts, executablePath }) {
  const directory = resolve(frontend, 'dist');
  const html = await readFile(resolve(directory, 'index.html'), 'utf8');
  const worker = await readFile(resolve(directory, 'sw.js'), 'utf8');
  const files = JSON.parse(worker.match(/^const FILES = (\[.*\]);$/m)[1]);
  const script = html.match(/src="(\/assets\/[^"\s]+\.js)"/)[1];
  const nextScript = '/assets/interrupted-update.js';
  const nextHtml = html.replace(script, nextScript);
  let update = false, assetAvailable = false;
  const server = createServer(async (request, response) => {
    const path = new URL(request.url, 'http://localhost').pathname;
    if (path === '/api/me') { response.writeHead(401, { 'content-type':'application/json' }); response.end('{"error":"Sign in"}'); return; }
    if (path === '/' && update) { response.writeHead(200, {'content-type':'text/html','cache-control':'no-store'}); response.end(nextHtml); return; }
    if (path === '/app-shell.json') { response.writeHead(200, {'content-type':'application/json','cache-control':'no-store'}); response.end(JSON.stringify({files:files.map(file=>update && file===script ? nextScript:file)})); return; }
    if (path === nextScript) {
      response.writeHead(assetAvailable ? 200 : 503, {'content-type':'text/javascript','cache-control':'no-store'});
      response.end(assetAvailable ? (await loadPreviewAsset(directory,script)).body : 'Interrupted download'); return;
    }
    const asset = await loadPreviewAsset(directory,request.url);
    response.writeHead(asset ? 200 : 404, {'content-type':asset?.type ?? 'text/plain','cache-control':'no-store'});response.end(asset?.body ?? 'Not found');
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const port=server.address().port,url=`http://127.0.0.1:${port}/`;
  const profile=await mkdtemp(join(tmpdir(),'strength-e2e-profile-'));
  const options={headless:true,viewport:{width:390,height:844},isMobile:true,hasTouch:true,...(executablePath?{executablePath}:{})};
  let context;
  const watchdog=setTimeout(()=>{void context?.close();},120000);
  const launch=async()=>{context=await browserType.launchPersistentContext(profile,options);const page=context.pages()[0]??await context.newPage();page.setDefaultTimeout(15000);return page;};
  const state=page=>page.evaluate(async()=>{const db=await new Promise((resolve,reject)=>{const request=indexedDB.open('strength-training');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});try{return await new Promise((resolve,reject)=>{const tx=db.transaction('workouts');const request=tx.objectStore('workouts').get('state');tx.oncomplete=()=>resolve(request.result);tx.onabort=()=>reject(tx.error)})}finally{db.close()}});
  const stop=async()=>{if(server.listening){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}};
  try {
    let page=await launch();await page.goto(url);await page.getByText('Ready for offline use',{exact:true}).waitFor();
    await page.getByRole('button',{name:'Start workout',exact:true}).click();await page.locator('#exercise').selectOption('bench-press');await page.getByRole('button',{name:'Add exercise',exact:true}).click();await page.getByLabel('Weight (kg)').fill('60');await page.getByLabel('Reps',{exact:true}).fill('8');await page.getByRole('button',{name:'Add set',exact:true}).click();await page.getByRole('status').filter({hasText:/^Saved on this device$/}).waitFor();const before=await state(page);
    update=true;await page.goto(url+'?update-attempt=1');
    const cached=await page.evaluate(async()=>{const cache=await caches.open((await caches.keys()).find(name=>name.startsWith('strength-training-shell-')));return(await cache.match('/')).text()});
    assert(!cached.includes(nextScript),'An interrupted update replaced the usable offline HTML with an unavailable JavaScript bundle');
    await page.getByRole('region',{name:'Bench Press',exact:true}).waitFor();assert.deepEqual(await state(page),before);
    await stop();await context.close();context=null;
    page=await launch();await page.goto(url);await page.getByRole('region',{name:'Bench Press',exact:true}).waitFor();assert.deepEqual(await state(page),before);
    await page.screenshot({path:join(artifacts,`offline-restart-${engine}.png`),fullPage:true});
    console.log(`PASS ${engine}: interrupted app update keeps a usable shell; real browser restart offline retains the workout`);
    await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));assetAvailable=true;await page.goto(url+'?update-attempt=2');await page.getByRole('region',{name:'Bench Press',exact:true}).waitFor();await page.getByText('Ready for offline use',{exact:true}).waitFor();
    assert.deepEqual(await state(page),before);await stop();await context.close();context=null;
    page=await launch();await page.goto(url);await page.getByRole('region',{name:'Bench Press',exact:true}).waitFor();assert.deepEqual(await state(page),before);
    console.log(`PASS ${engine}: a complete app update also reopens offline after browser restart without duplicate or missing sets`);
  } catch(error) {if(context)await(context.pages()[0]?.screenshot({path:join(artifacts,`offline-update-failure-${engine}.png`),fullPage:true}).catch(()=>{}));throw error;}
  finally {clearTimeout(watchdog);if(context)await context.close();await stop();await rm(profile,{recursive:true,force:true});}
}
