import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { testDatabase } from './test-database.mjs';

const root=fileURLToPath(new URL('../../../',import.meta.url));
const require=createRequire(new URL('../../package.json',import.meta.url));
const args=new Map(process.argv.slice(2).map(argument=>{const match=argument.match(/^--(browser|only)=(.+)$/);if(!match)throw new Error('Use --browser=all|chromium|webkit and optionally --only=sync|offline-update.');return[match[1],match[2]];}));
const engines=args.get('browser')??'all',only=args.get('only');
if(!['all','chromium','webkit'].includes(engines)||only&&!['sync','offline-update'].includes(only))throw new Error('Invalid browser or case selection.');
const artifacts=join(root,'.local','e2e',new Date().toISOString().replaceAll(':','-'));
await mkdir(artifacts,{recursive:true});
const npm=(directory,script,env={})=>{
  const options={cwd:root,stdio:['ignore','pipe','pipe'],encoding:'utf8',env:{...process.env,...env}};
  const log=join(artifacts,`${directory}-${script.replaceAll(':','-')}.log`);
  try {
    const output=process.env.npm_execpath
      ?execFileSync(process.execPath,[process.env.npm_execpath,'--prefix',join(root,directory),'run',script],options)
      :execFileSync(process.platform==='win32'?'npm.cmd':'npm',['--prefix',join(root,directory),'run',script],options);
    writeFileSync(log,output);console.log(`PASS ${directory}: ${script}`);
  } catch(error) {writeFileSync(log,String(error.stdout??'')+String(error.stderr??''));console.error(`Failed ${directory}: ${script}. See ${log}`);throw error;}

};
let database;const results=[];
try {
  npm('frontend','test');npm('frontend','lint');npm('frontend','build');
  if(only!=='offline-update'){
    database=await testDatabase();npm('backend','build');npm('backend','test',{TEST_DATABASE_URL:database.url});
  }
  const {chromium,webkit}=require('playwright');
  const {offlineUpdateCase}=await import('./offline-update.mjs');
  const {workoutSyncCase}=only==='offline-update'?{}:await import('./workout-sync.mjs');
  for(const engine of engines==='all'?['chromium','webkit']:[engines]){
    const options={browserType:engine==='chromium'?chromium:webkit,engine,artifacts,databaseUrl:database?.url,
      executablePath:engine==='chromium'?process.env.E2E_CHROMIUM_EXECUTABLE:undefined};
    if(only!=='sync'){await offlineUpdateCase(options);results.push({engine,case:'offline-update-and-browser-restart',passed:true});}
    if(only!=='offline-update'){await workoutSyncCase(options);results.push({engine,case:'workout-sync-and-recovery',passed:true});}
  }
  await writeFile(join(artifacts,'results.json'),JSON.stringify({passed:true,results},null,2));
  console.log('Reliability checks passed. Artifacts: '+artifacts);
} catch(error) {
  await writeFile(join(artifacts,'results.json'),JSON.stringify({passed:false,results,error:error instanceof Error?error.message:String(error)},null,2));
  console.error(error);console.error('Failure artifacts: '+artifacts);process.exitCode=1;
} finally {if(database)await database.close();}
