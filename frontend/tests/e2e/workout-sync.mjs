import { randomUUID } from 'node:crypto';
import { createServer, request as proxyRequest } from 'node:http';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { createApp } from '../../../backend/dist/app.js';
import { migrate } from '../../../backend/dist/migrations.js';
import { loadPreviewAsset } from '../../scripts/preview-files.mjs';
import { handlePhoneUpdate } from '../../scripts/phone-update.mjs';
export async function workoutSyncCase({ browserType, engine, databaseUrl, artifacts, executablePath }) {
const require=createRequire(new URL('../../../backend/package.json',import.meta.url));const {Pool}=require('pg');
const admin=new Pool({connectionString:databaseUrl});const schema='sync_browser_'+randomUUID().replaceAll('-','');await admin.query(`CREATE SCHEMA ${schema}`);
const pool=new Pool({connectionString:databaseUrl,options:`-c search_path=${schema}`,max:8});
const config={secret:'isolated_sync_browser_secret_1234567890123456789012',origins:[]};
let expireSecondPage=false;
let failedSecondPage=false,badAckNext=false,holdDownload=false,downloadStarted,releaseDownload;const blockedDevices=new Set();
let failed=false,loseNext=false,holdNext=false,heldCommit,releaseHeld;const requests=[];
const dist=fileURLToPath(new URL('../../dist',import.meta.url));
let api,frontend,browser,context,page;let userId;
const watchdog=setTimeout(()=>{releaseHeld?.();releaseDownload?.();void browser?.close();},120000);
const initialId=randomUUID(),historyId=randomUUID();
const exercise=()=>({id:randomUUID(),exerciseId:'bench-press',name:'Bench Press',sets:[{id:randomUUID(),weightKg:60,reps:8},{id:randomUUID(),weightKg:62.5,reps:6}]});
const initial={revision:4,active:{id:initialId,startedAt:'2026-10-27T09:00:00.000Z',exercises:[exercise()]},history:[{id:historyId,startedAt:'2026-10-26T09:00:00.000Z',completedAt:'2026-10-26T10:00:00.000Z',exercises:[exercise()]}]};
async function local(){return page.evaluate(async()=>{const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('strength-training');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});try{return await new Promise((resolve,reject)=>{const t=db.transaction('workouts');const store=t.objectStore('workouts');const state=store.get('state'),meta=store.get('sync:metadata'),operations=store.getAll(IDBKeyRange.bound('sync:pending:','sync:pending:\uffff'));t.oncomplete=()=>resolve({state:state.result??{revision:0,active:null,history:[]},meta:meta.result,pending:operations.result});t.onerror=()=>reject(t.error)})}finally{db.close()}})}
const account=()=>page.getByRole('region',{name:'Account settings'});const sync=()=>page.getByRole('region',{name:'Workout sync'});
async function openedAccount(){if(!await account().isVisible())await page.locator('.account-panel > summary').click();}
async function signup(name,email){await openedAccount();await account().getByRole('heading',{name:/^(Sign in|Create account)$/}).waitFor();if(await account().getByRole('button',{name:'Create an account',exact:true}).isVisible())await account().getByRole('button',{name:'Create an account',exact:true}).click();await account().getByLabel('Name',{exact:true}).fill(name);await account().getByLabel('Email',{exact:true}).fill(email);await account().getByLabel('Password',{exact:true}).fill('BrowserSyncPassword123!');await account().getByRole('button',{name:'Create account',exact:true}).click();await account().getByText(/Signed in as/).waitFor()}
async function signin(email){await openedAccount();await account().getByRole('heading',{name:/^(Sign in|Create account)$/}).waitFor();if(await account().getByRole('button',{name:'Use an existing account',exact:true}).isVisible())await account().getByRole('button',{name:'Use an existing account',exact:true}).click();await account().getByLabel('Email',{exact:true}).fill(email);await account().getByLabel('Password',{exact:true}).fill('BrowserSyncPassword123!');await account().getByRole('button',{name:'Sign in',exact:true}).click();await account().getByText(/Signed in as/).waitFor()}
const saved=()=>page.getByRole('status').filter({hasText:'Saved on this device',hasNot:page.locator('strong')}).first().waitFor();
const bench=()=>page.getByRole('region',{name:'Bench Press',exact:true});
async function addSet(weight,reps){await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await bench().getByLabel('Weight (kg)').fill(String(weight));await bench().getByLabel('Reps',{exact:true}).fill(String(reps));await bench().getByRole('button',{name:'Add set',exact:true}).click();await page.getByRole('status').filter({hasText:/^Saved on this device$/}).waitFor()}
async function synced(){await page.getByRole('status').filter({hasText:/^Saved on this device$/}).waitFor();await page.waitForFunction(async()=>{const db=await new Promise(resolve=>{const r=indexedDB.open('strength-training');r.onsuccess=()=>resolve(r.result)});try{return await new Promise(resolve=>{const t=db.transaction('workouts');const r=t.objectStore('workouts').getAll(IDBKeyRange.bound('sync:pending:','sync:pending:\uffff'));t.oncomplete=()=>resolve(r.result.length===0)})}finally{db.close()}});await sync().getByRole('status').filter({hasText:/^Synced to/}).waitFor();assert.equal((await local()).pending.length,0)}
async function serverWorkout(id){return page.evaluate(async id=>{const r=await fetch('/api/workouts/'+id);return {status:r.status,data:await r.json()}},id)}
try {
 const handleRequest=async(req,res)=>{
  const path=new URL(req.url,'http://localhost').pathname;
  if(path==='/api/sync'){
   const chunks=[];for await(const chunk of req)chunks.push(chunk);const body=Buffer.concat(chunks);const operation=JSON.parse(body);requests.push(operation);
   if(failed||blockedDevices.has(operation.deviceId)){res.writeHead(503,{'content-type':'application/json'});res.end('{"error":"Test connection interrupted"}');return;}
   const response=await new Promise((resolve,reject)=>{const outgoing=proxyRequest(apiUrl+'/api/sync',{method:'POST',headers:{host:req.headers.host,origin:req.headers.origin,cookie:req.headers.cookie??'','content-type':'application/json','x-strength-sync-protocol':req.headers['x-strength-sync-protocol']??'1'}},incoming=>{const chunks=[];incoming.on('data',chunk=>chunks.push(chunk));incoming.on('end',()=>resolve({status:incoming.statusCode,body:Buffer.concat(chunks).toString()}));incoming.on('error',reject)});outgoing.on('error',reject);outgoing.end(body)});let result=response.body;if(badAckNext){badAckNext=false;blockedDevices.add(operation.deviceId);const bad=JSON.parse(result);bad.operationId=randomUUID();result=JSON.stringify(bad);}
   if(loseNext){loseNext=false;failed=true;req.socket.destroy();return;}
   if(holdNext){holdNext=false;heldCommit?.();await new Promise(resolve=>releaseHeld=resolve);failed=true;}
   res.writeHead(response.status,{'content-type':'application/json','cache-control':'no-store'});res.end(result);return;
  }
  if(path==='/api/sync/workouts') {
   if(expireSecondPage&&new URL(req.url,'http://localhost').searchParams.has('cursor')){expireSecondPage=false;await pool.query(`UPDATE session SET "expiresAt"=now()-interval '1 second' WHERE "userId"=$1`,[userId]);}
   if(failedSecondPage&&new URL(req.url,'http://localhost').searchParams.has('cursor')){res.writeHead(503,{'content-type':'application/json'});res.end('{"error":"Interrupted download"}');return;}
   if(holdDownload){holdDownload=false;downloadStarted?.();await new Promise(resolve=>releaseDownload=resolve);if(res.destroyed)return;}
  }
  if(await handlePhoneUpdate(req,res,dist))return;
  if(path.startsWith('/api/')){const upstream=proxyRequest(apiUrl+req.url,{method:req.method,headers:{...req.headers,'x-forwarded-proto':'http'}},response=>{res.writeHead(response.statusCode,response.headers);response.pipe(res)});upstream.on('error',()=>{if(res.destroyed)return;if(res.headersSent){res.destroy();return;}res.writeHead(503,{'content-type':'application/json'});res.end('{\"error\":\"Test API restarting\"}')});req.pipe(upstream);return;}
  const asset=await loadPreviewAsset(dist,req.url);res.writeHead(asset?200:404,{'content-type':asset?.type??'text/plain','cache-control':'no-cache'});res.end(asset?.body??'Not found');
 };
 frontend=createServer((req,res)=>{void handleRequest(req,res).catch(()=>{if(res.destroyed)return;if(res.headersSent){res.destroy();return;}res.writeHead(503,{'content-type':'application/json'});res.end('{\"error\":\"Test request interrupted\"}')})});await new Promise(resolve=>frontend.listen(0,'127.0.0.1',resolve));
 const url='http://127.0.0.1:'+frontend.address().port;config.origins.push(url);
 await migrate(pool,config);api=createApp(pool,config).listen(0,'127.0.0.1');await once(api,'listening');const apiUrl='http://127.0.0.1:'+api.address().port;
 browser=await browserType.launch({headless:true,...(executablePath?{executablePath}:{})});
 context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});page=await context.newPage();page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept());
 await page.goto(url+'/api/app-update');await page.evaluate(async initial=>{const r=indexedDB.open('strength-training',1);r.onupgradeneeded=()=>r.result.createObjectStore('workouts');const db=await new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});await new Promise((resolve,reject)=>{const t=db.transaction('workouts','readwrite');t.objectStore('workouts').put(initial,'state');t.oncomplete=resolve;t.onabort=()=>reject(t.error)});db.close()},initial);
 await page.goto(url);await page.getByText('Ready for offline use',{exact:true}).waitFor();await bench().getByLabel('Weight (kg)').waitFor();assert.deepEqual((await local()).state,initial);
 const oldOpen=await page.evaluate(()=>new Promise(resolve=>{const request=indexedDB.open('strength-training',1);request.onerror=()=>resolve(request.error.name);request.onsuccess=()=>{request.result.close();resolve('opened')}}));assert.equal(oldOpen,'VersionError');
 const emailA=`sync-a-${randomUUID()}@example.test`,emailB=`sync-b-${randomUUID()}@example.test`;
 await signup('Sync Alice',emailA);userId=(await page.evaluate(()=>fetch('/api/me').then(r=>r.json()))).user.id;
 assert.equal((await page.evaluate(()=>fetch('/api/workouts').then(r=>r.json()))).workouts.length,0);assert((await local()).pending.every(item=>item.ownerId===null));
 await sync().getByRole('button',{name:'Enable sync for this device'}).click();await synced();assert.deepEqual((await local()).state,initial);assert.equal((await serverWorkout(initialId)).data.workout.exercises[0].sets.length,2);
 console.log('PASS '+engine+': legacy IndexedDB preserved; explicit account binding uploads active workout and history');
 // Fail the queue write, after local data is read, to prove transaction rollback.
 await page.evaluate(()=>{const original=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(value,key){if(typeof key==='string'&&key.startsWith('sync:pending:')){IDBObjectStore.prototype.put=original;throw new DOMException('Test quota failure','QuotaExceededError')}return original.call(this,value,key)}});
 const beforeFailure=(await local()).state;
 await bench().getByLabel('Weight (kg)').fill('65');await bench().getByLabel('Reps',{exact:true}).fill('5');await bench().getByRole('button',{name:'Add set',exact:true}).click();await bench().getByRole('alert').waitFor();assert.deepEqual((await local()).state,beforeFailure);assert.equal((await local()).pending.length,0);assert.equal(await bench().getByLabel('Weight (kg)').inputValue(),'65');
 await bench().getByRole('button',{name:'Add set',exact:true}).click();await synced();
 console.log('PASS '+engine+': queue-write failure rolls back the workout and keeps form inputs; retry saves once');
 loseNext=true;await addSet(67.5,4);await sync().getByRole('status').filter({hasText:/Waiting to retry/}).waitFor();
 let queued=await local();assert(queued.pending.length>0);const lostId=requests.at(-1).id;assert(queued.pending.some(item=>item.id===lostId));assert.equal((await serverWorkout(initialId)).data.workout.exercises[0].sets.length,4);
 await page.reload();await bench().getByLabel('Weight (kg)').waitFor();assert((await local()).pending.some(item=>item.id===lostId));
 const apiPort=api.address().port;api.closeAllConnections();await new Promise(resolve=>api.close(resolve));api=createApp(pool,config).listen(apiPort,'127.0.0.1');await once(api,'listening');
 failed=false;await sync().getByRole('button',{name:/^(Sync now|Retry sync)$/}).click();await synced();
 assert.equal((await pool.query('SELECT count(*)::int AS count FROM sync_operations WHERE user_id=$1 AND operation_id=$2',[userId,lostId])).rows[0].count,1);assert.equal((await serverWorkout(initialId)).data.workout.exercises[0].sets.length,4);
 console.log('PASS '+engine+': response lost after server commit; reload and backend restart keep the same receipt and do not duplicate sets');
 holdNext=true;const held=new Promise(resolve=>heldCommit=resolve);await addSet(70,3);await held;
 await addSet(72.5,2);await bench().getByRole('button',{name:'Delete Bench Press set 1',exact:true}).click();await page.getByRole('status').filter({hasText:/^Saved on this device$/}).waitFor();
 const newer=(await local()).pending.sort((a,b)=>b.sequence-a.sequence)[0];releaseHeld();
 await sync().getByRole('status').filter({hasText:/Waiting to retry/}).waitFor();assert((await local()).pending.some(item=>item.id===newer.id));
 failed=false;await sync().getByRole('button',{name:/^(Sync now|Retry sync)$/}).click();await synced();const updated=(await serverWorkout(initialId)).data.workout;assert.equal(updated.exercises[0].sets.length,5);assert.equal(updated.exercises[0].sets[0].weightKg,62.5);assert.equal(updated.exercises[0].sets.at(-1).weightKg,72.5);
 console.log('PASS '+engine+': newer edit/deletion survives an older acknowledgement and reaches the server');
 // True offline reopening: stop the server, close the tab, and open a new tab.
 const port=frontend.address().port;if(engine!=='webkit')await context.setOffline(true);frontend.closeAllConnections();await new Promise(resolve=>frontend.close(resolve));
 await bench().getByLabel('Weight (kg)').fill('75');await bench().getByLabel('Reps',{exact:true}).fill('2');await bench().getByRole('button',{name:'Add set',exact:true}).click();await page.getByRole('status').filter({hasText:/^Saved on this device$/}).waitFor();
 await bench().getByRole('button',{name:'Edit Bench Press set 6',exact:true}).click();await bench().getByLabel('Weight (kg)').fill('77.5');await bench().getByLabel('Reps',{exact:true}).fill('3');await bench().getByRole('button',{name:'Save changes',exact:true}).click();await page.getByRole('status').filter({hasText:/^Saved on this device$/}).waitFor();
 await addSet(79,1);await bench().getByRole('button',{name:'Delete Bench Press set 7',exact:true}).click();await page.getByRole('status').filter({hasText:/^Saved on this device$/}).waitFor();const offlineState=(await local()).state;assert.equal(offlineState.active.exercises[0].sets.length,6);assert.equal(offlineState.active.exercises[0].sets.at(-1).weightKg,77.5);
 await page.close();page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept());await page.goto(url);await bench().getByLabel('Weight (kg)').waitFor();assert.deepEqual((await local()).state,offlineState);assert((await local()).pending.length>0);
 await new Promise(resolve=>frontend.listen(port,'127.0.0.1',resolve));if(engine!=='webkit')await context.setOffline(false);else await page.evaluate(()=>window.dispatchEvent(new Event('online')));await synced();const offlineSynced=(await serverWorkout(initialId)).data.workout;assert.equal(offlineSynced.exercises[0].sets.length,6);assert.equal(offlineSynced.exercises[0].sets.at(-1).weightKg,77.5);assert(!offlineSynced.exercises[0].sets.some(set=>set.weightKg===79));
 console.log('PASS '+engine+': offline set edits and deletion before first upload survive reopening and reach the server once');
 if(engine!=='webkit')await context.setOffline(true);frontend.closeAllConnections();await new Promise(resolve=>frontend.close(resolve));

 await page.getByRole('button',{name:'Finish workout',exact:true}).click();await page.getByRole('heading',{name:'Workout complete',exact:true}).waitFor();await page.getByRole('button',{name:/^History \(/}).click();await page.locator('.history-button').first().click();await page.getByRole('button',{name:'Delete workout',exact:true}).click();assert.equal((await local()).state.history.some(workout=>workout.id===initialId),false);assert((await local()).pending.some(item=>item.kind==='delete'&&item.workoutId===initialId));
 await new Promise(resolve=>frontend.listen(port,'127.0.0.1',resolve));if(engine!=='webkit')await context.setOffline(false);else await page.evaluate(()=>window.dispatchEvent(new Event('online')));await synced();assert.equal((await serverWorkout(initialId)).status,404);
 console.log('PASS '+engine+': offline close/reopen retains queue; offline completion/deletion reconnects without restoring the workout');
 await page.getByRole('button',{name:/^(Home|Current workout)$/}).click();failed=true;await page.getByRole('button',{name:'Start another workout',exact:true}).click();await page.locator('#exercise').selectOption('bench-press');await page.getByRole('button',{name:'Add exercise',exact:true}).click();await addSet(80,3);const pendingBefore=(await local()).pending.length;
 await pool.query('UPDATE session SET "expiresAt"=now()-interval \'1 second\' WHERE "userId"=$1',[userId]);failed=false;await page.evaluate(()=>window.dispatchEvent(new Event('online')));await sync().getByRole('status').filter({hasText:/Sign in to sync/}).waitFor();assert((await local()).pending.length>=pendingBefore);
 await signup('Sync Bob',emailB);await sync().getByRole('status').filter({hasText:/Sync paused for this account/}).waitFor();assert((await local()).pending.every(item=>item.ownerId===userId));assert.equal((await page.evaluate(()=>fetch('/api/workouts').then(r=>r.json()))).workouts.length,0);
 const forbidden=await page.evaluate(async operation=>{const r=await fetch('/api/sync',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({accountId:operation.ownerId,id:operation.id,deviceId:operation.deviceId,sequence:operation.sequence,workoutId:operation.workoutId,kind:operation.kind,workout:operation.workout})});return r.status},(await local()).pending[0]);assert.equal(forbidden,403);
 await account().getByRole('button',{name:'Sign out',exact:true}).click();await signin(emailA);await synced();
 console.log('PASS '+engine+': expiry preserves queue; a different account cannot receive it; original-account sign-in resumes uploads');
 // Reconciliation also captures saves made by an older cached app tab.
 await page.evaluate(async()=>{const db=await new Promise(resolve=>{const r=indexedDB.open('strength-training');r.onsuccess=()=>resolve(r.result)});await new Promise(resolve=>{const t=db.transaction('workouts','readwrite');const store=t.objectStore('workouts');const r=store.get('state');r.onsuccess=()=>{const state=r.result;state.revision++;state.active.exercises[0].sets[0].weightKg=82.5;store.put(state,'state')};t.oncomplete=resolve});db.close()});
 await page.reload();await synced();const final=await local();assert.equal((await serverWorkout(final.state.active.id)).data.workout.exercises[0].sets[0].weightKg,82.5);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(errors,[]);
 await page.screenshot({path:join(artifacts,'sync-'+engine+'.png'),fullPage:true});console.log('PASS '+engine+': legacy-tab writes reconciled, phone layout fits, no browser errors');
 const pageA=page,contextA=context;const originalId=(await local()).state.active.id;
 const seeded=await page.evaluate(async()=>{
  const ids=[];
  for(let index=0;index<21;index++){
   const id=crypto.randomUUID();ids.push(id);const response=await fetch('/api/workouts/'+id,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({id,startedAt:`2026-10-25T09:${String(index).padStart(2,'0')}:00.000Z`,completedAt:`2026-10-25T10:${String(index).padStart(2,'0')}:00.000Z`,exercises:[{id:crypto.randomUUID(),exerciseId:'bench-press',name:'Bench Press',sets:[{id:crypto.randomUUID(),weightKg:50+index,reps:8}]}]})});if(!response.ok)throw new Error('Seed failed');
  }return ids;
 });
 const newPage=async ctx=>{const result=await ctx.newPage();result.setDefaultTimeout(15000);result.on('pageerror',error=>errors.push(error.message));result.on('dialog',dialog=>dialog.accept());return result;};
 const options={viewport:{width:390,height:844},hasTouch:true,isMobile:true};
 const contextB=await browser.newContext(options);page=await newPage(contextB);await page.goto(url);await page.getByText('Ready for offline use',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Start workout',exact:true}).click();await page.locator('#exercise').selectOption('bench-press');await page.getByRole('button',{name:'Add exercise',exact:true}).click();await addSet(15,8);const localBId=(await local()).state.active.id;
 await signin(emailA);await sync().getByRole('button',{name:'Enable sync for this device'}).click();await synced();
 const bState=await local();assert.equal(bState.state.active.id,localBId);assert.equal(bState.state.active.exercises[0].sets[0].weightKg,15);assert(bState.state.otherActive.some(workout=>workout.id===originalId));assert(seeded.every(id=>bState.state.history.some(workout=>workout.id===id)));
 await page.getByRole('region',{name:'Other unfinished workouts'}).getByRole('button',{name:/^Resume/}).click();await bench().getByLabel('Weight (kg)').waitFor();assert.equal((await local()).state.active.id,originalId);await addSet(75,4);await synced();const pageB=page;
 console.log('PASS '+engine+': fresh profile downloads multiple pages, preserves its unsynced workout, and resumes a downloaded session with a checked handoff');
 page=pageA;await bench().getByLabel('Weight (kg)').fill('999');await bench().getByLabel('Reps',{exact:true}).fill('2');await sync().getByRole('button',{name:/^(Sync now|Retry sync)$/}).click();await sync().getByRole('status').filter({hasText:/Server update waiting/}).waitFor();assert.equal(await bench().getByLabel('Weight (kg)').inputValue(),'999');assert.equal((await local()).state.active.exercises[0].sets.length,1);
 await bench().getByRole('button',{name:'Reset entry'}).click();await synced();assert.equal((await local()).state.active.exercises[0].sets.length,2);assert.equal(await bench().getByLabel('Weight (kg)').inputValue(),'75');
 console.log('PASS '+engine+': remote changes wait for unsaved inputs; resetting the entry applies the update and refreshes the next-set template');
 const aDevice=(await local()).meta.deviceId;blockedDevices.add(aDevice);await addSet(90,2);page=pageB;await addSet(80,3);await synced();page=pageA;await page.evaluate(()=>window.dispatchEvent(new Event('online')));await page.getByRole('region',{name:'Workout conflicts'}).waitFor();const conflict=await local();assert.equal(conflict.state.active.exercises[0].sets.at(-1).weightKg,90);assert(conflict.pending.length>0);
 // A failed conflict resolution must not remove the original pending queue.
 await page.evaluate(()=>{const original=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(value,key){if(key==='state'){IDBObjectStore.prototype.put=original;throw new DOMException('Test quota failure','QuotaExceededError')}return original.call(this,value,key)}});
 await page.getByRole('button',{name:'Keep both versions'}).click();await sync().getByText('Test quota failure',{exact:true}).waitFor();assert.deepEqual((await local()).state,conflict.state);assert((await local()).pending.length>0);
 blockedDevices.delete(aDevice);await page.getByRole('button',{name:'Keep both versions'}).click();await synced();const kept=await local(),copyId=kept.state.active.id;assert.notEqual(copyId,originalId);assert.equal(kept.state.active.exercises[0].sets.at(-1).weightKg,90);assert.equal(kept.state.otherActive.find(workout=>workout.id===originalId).exercises[0].sets.at(-1).weightKg,80);assert.equal((await serverWorkout(copyId)).data.workout.exercises[0].sets.at(-1).weightKg,90);assert.equal((await serverWorkout(originalId)).data.workout.exercises[0].sets.at(-1).weightKg,80);
 console.log('PASS '+engine+': stale edits are kept; conflict resolution rolls back on failure, then preserves both server and device versions with distinct IDs');
 // Downloads apply only after every page succeeds, even with zero uploads pending.
 const contextC=await browser.newContext(options);page=await newPage(contextC);await page.goto(url);await signin(emailA);failedSecondPage=true;await sync().getByRole('button',{name:'Enable sync for this device'}).click();await sync().getByRole('status').filter({hasText:/Server check waiting to retry/}).waitFor();assert.equal((await local()).state.history.length,0);assert.equal((await local()).state.active,null);assert.equal((await local()).pending.length,0);assert.equal(await sync().getByRole('status').filter({hasText:/^Synced to/}).count(),0);
 failedSecondPage=false;expireSecondPage=true;await page.evaluate(()=>window.dispatchEvent(new Event('online')));await sync().getByRole('status').filter({hasText:/Sign in to sync/}).waitFor();assert.equal((await local()).state.history.length,0);assert.equal((await local()).pending.length,0);
 await signin(emailA);await synced();const cState=await local();assert(seeded.every(id=>cState.state.history.some(workout=>workout.id===id)));assert.equal(cState.meta.nextSequence,0);assert.equal(requests.filter(operation=>operation.deviceId===cState.meta.deviceId).length,0);
 console.log('PASS '+engine+': failed and expired-session page two leave local data unchanged; signing back in imports all pages without re-uploading downloaded workouts or claiming an incomplete sync');
 // Aborting a hanging download updates the UI immediately, not after timeout.
 const pageC=page;holdDownload=true;const started=new Promise(resolve=>downloadStarted=resolve);await sync().getByRole('button',{name:/^(Sync now|Retry sync)$/}).click();await started;
 await page.evaluate(()=>{Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>false});window.dispatchEvent(new Event('offline'))});await sync().getByRole('status').filter({hasText:/^Offline/}).waitFor({timeout:2000});releaseDownload();
 context=contextC;const downloadPort=frontend.address().port;frontend.closeAllConnections();await new Promise(resolve=>frontend.close(resolve));if(engine!=='webkit')await contextC.setOffline(true);
 await addSet(83,2);const offline=await local();await pageC.close();page=await newPage(contextC);await page.goto(url);await bench().getByLabel('Weight (kg)').waitFor();assert.deepEqual((await local()).state,offline.state);assert((await local()).pending.length>0);
 await new Promise(resolve=>frontend.listen(downloadPort,'127.0.0.1',resolve));if(engine!=='webkit')await contextC.setOffline(false);else await page.evaluate(()=>window.dispatchEvent(new Event('online')));await synced();
 console.log('PASS '+engine+': offline event aborts an in-flight download immediately; the imported workout and new queued set survive close/reopen and reconnect');
 badAckNext=true;await addSet(85,1);await sync().getByRole('status').filter({hasText:/Waiting to retry/}).waitFor();const unacknowledged=(await local()).pending.at(-1);assert(unacknowledged);await page.reload();await bench().getByLabel('Weight (kg)').waitFor();assert((await local()).pending.some(operation=>operation.id===unacknowledged.id));blockedDevices.delete((await local()).meta.deviceId);await sync().getByRole('button',{name:/^(Sync now|Retry sync)$/}).click();await synced();assert.equal((await pool.query('SELECT count(*)::int AS count FROM sync_operations WHERE user_id=$1 AND operation_id=$2',[userId,unacknowledged.id])).rows[0].count,1);
 assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:join(artifacts,'downloads-'+engine+'.png'),fullPage:true});
 console.log('PASS '+engine+': a mismatched acknowledgement cannot clear queued changes; retry confirms the same receipt exactly once');
 // Simulate choosing Reps immediately before delayed animation callbacks.
 // Observe focus after each callback so a later test poll cannot mask a steal.
 await page.evaluate(()=>{
   window.e2eOriginalRaf=window.requestAnimationFrame.bind(window);
   window.requestAnimationFrame=callback=>window.e2eOriginalRaf(time=>{
     const input=document.querySelector('form.set-entry input[id$="-reps"]');
     if(window.e2eChooseReps&&input&&!input.closest('fieldset')?.disabled){input.dispatchEvent(new Event('pointerdown',{bubbles:true}));input.focus();callback(time);if(document.activeElement!==input)window.e2eFocusStolen=true;}
     else callback(time);
   });
   const original=IDBObjectStore.prototype.put;
   IDBObjectStore.prototype.put=function(value,key){
     const result=original.call(this,value,key);
     if(key==='state'){
       IDBObjectStore.prototype.put=original;const completed=this.transaction.oncomplete;
       this.transaction.oncomplete=function(event){window.e2eChooseReps=true;return completed.call(this,event)};
     }
     return result;
   };
 });
 await addSet(64,5);await page.evaluate(()=>new Promise(resolve=>window.e2eOriginalRaf(()=>window.e2eOriginalRaf(resolve))));
 const focusStolen=await page.evaluate(()=>{window.requestAnimationFrame=window.e2eOriginalRaf;return Boolean(window.e2eFocusStolen)});
 assert.equal(focusStolen,false,'A delayed save callback stole focus from the next chosen field');await synced();
 console.log('PASS '+engine+': delayed post-save focus does not move the cursor away from the next chosen field');
 // Commit a new local set between the completion transaction and the final
 // queue read. Pause the next account check to expose a premature Synced state.
 await bench().getByLabel('Weight (kg)').fill('87.5');await bench().getByLabel('Reps',{exact:true}).fill('2');
 const previousCompletion=(await local()).meta.lastCompletedAt;
 await page.evaluate(previous=>{
   const originalFetch=window.fetch.bind(window);
   window.fetch=(input,options)=>{
     const path=new URL(typeof input==='string'?input:input.url,location.href).pathname;
     if(window.e2eBlockAccount&&path==='/api/me'){
       window.e2eAccountBlocked=true;
       return new Promise(resolve=>{window.e2eReleaseAccount=()=>{window.e2eBlockAccount=false;window.fetch=originalFetch;resolve(originalFetch(input,options))}});
     }
     return originalFetch(input,options);
   };
   const original=IDBObjectStore.prototype.put;
   IDBObjectStore.prototype.put=function(value,key){
     const result=original.call(this,value,key);
     if(key==='sync:metadata'&&value.lastCompletedAt&&value.lastCompletedAt!==previous){
       IDBObjectStore.prototype.put=original;
       const completed=this.transaction.oncomplete;
       this.transaction.oncomplete=function(event){
         window.e2eBlockAccount=true;
         document.querySelector('form.set-entry').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
         return completed.call(this,event);
       };
     }
     return result;
   };
 },previousCompletion);
 await sync().getByRole('button',{name:/^(Sync now|Retry sync)$/}).click();await page.waitForFunction(()=>window.e2eAccountBlocked);
 assert((await local()).pending.length>0);assert(!/^Synced to/.test(await sync().getByRole('status').innerText()),'Sync claimed completion while a newly committed set was still pending');
 await page.evaluate(()=>window.e2eReleaseAccount());await synced();assert.equal((await local()).state.active.exercises[0].sets.at(-1).weightKg,87.5);
 console.log('PASS '+engine+': a set saved at the completion boundary stays pending and cannot show a premature Synced state');
 await contextA.close();await contextB.close();await contextC.close();

} catch(error){await page?.screenshot({path:join(artifacts,'sync-failure-'+engine+'.png'),fullPage:true}).catch(()=>{});await page?.evaluate(()=>{window.e2eHoldLocalSave=false;window.e2eReleaseAccount?.()}).catch(()=>{});console.log('FAILURE STATE',await page?.locator('body').innerText().catch(()=>''));console.log('QUEUE',await local().then(value=>({revision:value.state.revision,active:value.state.active?.id,history:value.state.history.length,pending:value.pending.map(operation=>({id:operation.id,sequence:operation.sequence,kind:operation.kind,blocked:operation.blocked})),conflicts:Object.keys(value.meta.conflicts??{}),deferred:value.meta.deferred})).catch(()=>null));throw error}finally{clearTimeout(watchdog);releaseHeld?.();releaseDownload?.();if(browser)await browser.close();for(const server of [frontend,api])if(server?.listening){server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}await pool.end();await admin.query(`DROP SCHEMA ${schema} CASCADE`);await admin.end()}

}
