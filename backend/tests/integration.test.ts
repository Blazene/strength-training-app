import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { request } from "node:http";
import pg from "pg";
import { createApp } from "../src/app.js";
import { migrate } from "../src/migrations.js";
const databaseUrl=process.env.TEST_DATABASE_URL;
test("PostgreSQL accounts, isolation, validated CRUD and sessions",{skip:!databaseUrl},async(t)=>{
  if(!/(_test|_integration)$/.test(new URL(databaseUrl!).pathname))throw new Error("Use a dedicated _test or _integration database.");
  const admin=new pg.Pool({connectionString:databaseUrl});const schema=`account_test_${randomUUID().replaceAll('-','')}`;
  await admin.query(`CREATE SCHEMA ${schema}`);const pool=new pg.Pool({connectionString:databaseUrl,options:`-c search_path=${schema}`,max:5});
  let origin="http://127.0.0.1";let port=0;const config={secret:"isolated_integration_secret_123456789012345678901234",origins:[origin]};
  let server: ReturnType<ReturnType<typeof createApp>["listen"]>|undefined;
  try {
    await migrate(pool,config);await migrate(pool,config);assert.equal((await pool.query("SELECT count(*)::int AS count FROM exercises")).rows[0].count,8);
    server=createApp(pool,config).listen(0,"127.0.0.1");await once(server,"listening");const address=server.address();if(!address||typeof address==="string")throw new Error("No test port");port=address.port;origin=`http://127.0.0.1:${port}`;config.origins.splice(0,config.origins.length,origin,origin.replace("http:","https:"));
    const call=async(path:string,method="GET",body?:unknown,cookie?:string,extra:Record<string,string>={})=>{
      const r=await fetch(origin+path,{method,headers:{origin,...(body!==undefined?{"content-type":"application/json"}:{}),...(cookie?{cookie}:{}),...extra},body:body!==undefined?JSON.stringify(body):undefined});
      const text=await r.text();return{status:r.status,data:text?JSON.parse(text):null,cookies:r.headers.getSetCookie()};
    };
    await t.test("rejects unauthenticated, forged host and cross-origin requests",async()=>{
      assert.equal((await call("/api/workouts")).status,401);
      assert.equal((await call("/api/auth/sign-up/email","POST",{name:"Evil",email:"evil@example.test",password:"TestPassword123!"},undefined,{origin:"https://evil.test"})).status,403);
      const forged=await new Promise<number>(resolve=>request({hostname:"127.0.0.1",port,path:"/api/health",headers:{host:"evil.test",origin}},res=>{res.resume();resolve(res.statusCode!)}).end());assert.equal(forged,403);
    });
    const signup=async(name:string)=>{const r=await call("/api/auth/sign-up/email","POST",{name,email:`${name.toLowerCase()}@example.test`,password:"TestPassword123!"});assert.equal(r.status,200,JSON.stringify(r.data));return{user:r.data.user,cookie:r.cookies.map(x=>x.split(';')[0]).join('; '),raw:r.cookies.join(';')}};
    const a=await signup("Alice");const b=await signup("Bob");
    await t.test("hashes passwords and uses HttpOnly, path-scoped, secure HTTPS cookies",async()=>{
      assert.match(a.raw,/HttpOnly/i);assert.match(a.raw,/Path=\/api/i);assert.match(a.raw,/SameSite=Lax/i);
      const stored=await pool.query('SELECT password FROM account WHERE "userId"=$1',[a.user.id]);assert.notEqual(stored.rows[0].password,"TestPassword123!");assert(stored.rows[0].password.length>32);
      assert.equal((await call("/api/me","GET",undefined,a.cookie)).data.user.email,"alice@example.test");
      const secure=await call("/api/auth/sign-in/email","POST",{email:"alice@example.test",password:"TestPassword123!"},undefined,{origin:origin.replace("http:","https:"),"x-forwarded-proto":"https"});assert.equal(secure.status,200);assert.match(secure.cookies.join(';'),/; Secure/i);
      assert.equal((await call("/api/auth/sign-in/email","POST",{email:"alice@example.test",password:"wrong password"})).status,401);
    });
    const id=randomUUID();const workout={id,startedAt:"2026-10-27T10:00:00.000Z",completedAt:"2026-10-27T11:00:00.000Z",exercises:[{id:randomUUID(),exerciseId:"bench-press",name:"Untrusted name",sets:[{id:randomUUID(),weightKg:62.5,reps:8},{id:randomUUID(),weightKg:0,reps:10}]}]};
    await t.test("round-trips order and canonical names; replay does not duplicate sets",async()=>{
      assert.equal((await call(`/api/workouts/${id}`,"PUT",workout,a.cookie)).status,200);assert.equal((await call(`/api/workouts/${id}`,"PUT",workout,a.cookie)).status,200);
      const loaded=await call(`/api/workouts/${id}`,"GET",undefined,a.cookie);assert.deepEqual(loaded.data.workout.exercises[0].sets,workout.exercises[0].sets);assert.equal(loaded.data.workout.exercises[0].name,"Bench Press");
      assert.equal((await pool.query("SELECT count(*)::int AS count FROM workout_sets WHERE user_id=$1",[a.user.id])).rows[0].count,2);
      assert.equal((await call("/api/workouts?limit=1","GET",undefined,a.cookie)).data.workouts[0].setCount,2);
    });
    await t.test("accounts cannot read, delete or overwrite another owner's data",async()=>{
      assert.equal((await call(`/api/workouts/${id}`,"GET",undefined,b.cookie)).status,404);assert.equal((await call(`/api/workouts/${id}`,"DELETE",undefined,b.cookie)).status,404);assert.equal((await call("/api/workouts","GET",undefined,b.cookie)).data.workouts.length,0);
      const ownCopy=structuredClone(workout);ownCopy.exercises[0].sets[0].reps=99;assert.equal((await call(`/api/workouts/${id}`,"PUT",ownCopy,b.cookie)).status,200);
      assert.equal((await call(`/api/workouts/${id}`,"GET",undefined,a.cookie)).data.workout.exercises[0].sets[0].reps,8);
    });
    await t.test("validation preserves existing data; edits and cascading deletion persist",async()=>{
      assert.equal((await call(`/api/workouts/${id}`,"PUT",{...workout,userId:b.user.id},a.cookie)).status,400);
      const invalid=structuredClone(workout);invalid.exercises[0].sets[0].reps=-1;assert.equal((await call(`/api/workouts/${id}`,"PUT",invalid,a.cookie)).status,400);
      assert.equal((await call(`/api/workouts/${id}`,"GET",undefined,a.cookie)).data.workout.exercises[0].sets.length,2);
      const collision={...structuredClone(workout),id:randomUUID()};assert.equal((await call(`/api/workouts/${collision.id}`,"PUT",collision,a.cookie)).status,409);assert.equal((await call(`/api/workouts/${collision.id}`,"GET",undefined,a.cookie)).status,404);
      assert.equal((await call(`/api/workouts/${id}`,"PUT",{...workout,note:"x".repeat(300000)},a.cookie)).status,413);
      const updated=structuredClone(workout);updated.exercises[0].sets.pop();updated.exercises[0].sets[0].weightKg=65;assert.equal((await call(`/api/workouts/${id}`,"PUT",updated,a.cookie)).status,200);
      assert.equal((await call(`/api/workouts/${id}`,"GET",undefined,a.cookie)).data.workout.exercises[0].sets.length,1);
      assert.equal((await call("/api/workouts?limit=1000","GET",undefined,a.cookie)).status,400);
      assert.equal((await call(`/api/workouts/${id}`,"DELETE",undefined,a.cookie)).status,204);assert.equal((await call(`/api/workouts/${id}`,"GET",undefined,a.cookie)).status,404);
      assert.equal((await pool.query("SELECT count(*)::int AS count FROM workout_sets WHERE user_id=$1",[a.user.id])).rows[0].count,0);
    });
    await t.test("sync receipts, stale retries, deletion markers and account assertions",async()=>{
      const deviceId=randomUUID();const syncId=randomUUID();
      const data={...structuredClone(workout),id:syncId,exercises:[{...structuredClone(workout.exercises[0]),id:randomUUID(),sets:workout.exercises[0].sets.map(set=>({...set,id:randomUUID()}))}]};
      const operation={accountId:a.user.id,id:randomUUID(),deviceId,sequence:1,workoutId:syncId,kind:"put",workout:data};
      const send=(body:unknown,cookie=a.cookie)=>call("/api/sync","POST",body,cookie);
      const first=await send(operation);assert.equal(first.status,200);assert.equal(first.data.replayed,false);
      assert.equal((await send(operation)).data.replayed,true);
      assert.equal((await send({...operation,sequence:2})).status,409);
      assert.equal((await send(operation,b.cookie)).status,403);
      const newer=structuredClone(operation);newer.id=randomUUID();newer.sequence=3;newer.workout.exercises[0].sets.pop();newer.workout.exercises[0].sets[0].weightKg=70;
      assert.equal((await send(newer)).status,200);
      const delayed={...operation,id:randomUUID(),sequence:2};assert.equal((await send(delayed)).data.outcome,"superseded");
      await send(operation);
      const loaded=(await call(`/api/workouts/${syncId}`,"GET",undefined,a.cookie)).data.workout;
      assert.equal(loaded.exercises[0].sets.length,1);assert.equal(loaded.exercises[0].sets[0].weightKg,70);
      assert.equal((await send({...newer,id:randomUUID(),deviceId:randomUUID(),sequence:4})).status,409);
      const deletion={...operation,id:randomUUID(),sequence:4,kind:"delete",workout:null};
      assert.equal((await send(deletion)).status,200);assert.equal((await send(deletion)).data.replayed,true);
      assert.equal((await send({...operation,id:randomUUID(),sequence:2})).data.outcome,"superseded");
      assert.equal((await call(`/api/workouts/${syncId}`,"GET",undefined,a.cookie)).status,404);
      assert.equal((await send({...operation,id:randomUUID(),sequence:5})).status,409);
      assert.equal((await call(`/api/workouts/${syncId}`,"PUT",data,a.cookie)).status,409);
      assert.equal((await call(`/api/workouts/${syncId}`,"DELETE",undefined,a.cookie)).status,409);
      assert.equal((await pool.query("SELECT deleted FROM workout_sync_state WHERE user_id=$1 AND workout_id=$2",[a.user.id,syncId])).rows[0].deleted,true);
      const concurrent={...operation,id:randomUUID(),sequence:6,workoutId:randomUUID()};concurrent.workout={...structuredClone(data),id:concurrent.workoutId};
      const simultaneous=await Promise.all([send(concurrent),send(concurrent)]);assert(simultaneous.every(result=>result.status===200));assert.equal(simultaneous.filter(result=>result.data.replayed).length,1);
      const conflict={...concurrent,id:randomUUID(),sequence:7,workoutId:randomUUID()};conflict.workout={...structuredClone(concurrent.workout),id:conflict.workoutId};
      assert.equal((await send(conflict)).status,409);
      assert.equal((await pool.query("SELECT 1 FROM sync_operations WHERE user_id=$1 AND operation_id=$2",[a.user.id,conflict.id])).rowCount,0);
      assert.equal((await pool.query("SELECT 1 FROM workouts WHERE user_id=$1 AND id=$2",[a.user.id,conflict.workoutId])).rowCount,0);
      assert.equal((await send({...concurrent,id:randomUUID(),sequence:0})).status,400);
      assert.equal((await call("/api/sync","POST",operation)).status,401);
      assert.equal((await send({...operation,accountId:b.user.id},b.cookie)).status,200);
      assert.equal((await call(`/api/workouts/${syncId}`,"GET",undefined,a.cookie)).status,404);
      assert.equal((await call(`/api/workouts/${syncId}`,"GET",undefined,b.cookie)).status,200);
    });
    await t.test("sign-out and expiry prevent reuse of sessions",async()=>{
      assert.equal((await call("/api/auth/sign-out","POST",{},a.cookie)).status,200);assert.equal((await call("/api/me","GET",undefined,a.cookie)).status,401);
      await pool.query('UPDATE session SET "expiresAt"=now()-interval \'1 second\' WHERE "userId"=$1',[b.user.id]);assert.equal((await call("/api/me","GET",undefined,b.cookie)).status,401);
    });
    await t.test("rate limits repeated password attempts",async()=>{
      let limited=false;
      for(let i=0;i<12;i++){if((await call("/api/auth/sign-in/email","POST",{email:"nobody@example.test",password:"WrongPassword123!"})).status===429){limited=true;break;}}
      assert.equal(limited,true);
    });
  }finally{
    if(server){server.closeAllConnections();await new Promise<void>(resolve=>server!.close(()=>resolve()));}
    await pool.end();await admin.query(`DROP SCHEMA ${schema} CASCADE`);await admin.end();
  }
});
