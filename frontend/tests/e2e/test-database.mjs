import { existsSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function validate(url) {
  const parsed = new URL(url);
  if (!['postgres:','postgresql:'].includes(parsed.protocol) || !['127.0.0.1','localhost','[::1]'].includes(parsed.hostname)
    || parsed.search || parsed.hash || !/(_test|_integration)$/.test(parsed.pathname)) throw new Error('E2E_DATABASE_URL must use a loopback host and a dedicated _test or _integration database.');
  return url;
}
function binaryDirectory() {
  const complete=directory=>['initdb','pg_ctl','createdb'].every(name=>existsSync(join(directory,process.platform==='win32'?name+'.exe':name)));
  if (process.env.POSTGRES_BIN) {if(!complete(process.env.POSTGRES_BIN))throw new Error('POSTGRES_BIN must contain initdb, pg_ctl and createdb.');return process.env.POSTGRES_BIN;}
  for (const command of ['pg_config','/opt/homebrew/opt/postgresql@17/bin/pg_config','/usr/local/opt/postgresql@17/bin/pg_config']) {
    try { const directory=execFileSync(command,['--bindir'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();if(complete(directory))return directory; } catch { /* Try the next standard installation. */ }
  }
  throw new Error('Install PostgreSQL or set POSTGRES_BIN to its bin directory. Tests do not use the app database or backend/.env.');
}
export async function testDatabase() {
  if (process.env.E2E_DATABASE_URL) return { url:validate(process.env.E2E_DATABASE_URL),close:async()=>{} };
  const binaries = binaryDirectory();
  const directory = await mkdtemp(join(tmpdir(),'strength-e2e-postgres-'));
  const data=join(directory,'data');let running=false;
  const command=(name,args)=>execFileSync(join(binaries,name),args,{encoding:'utf8',stdio:['ignore','pipe','pipe']});
  const onExit=()=>{if(running){try{command('pg_ctl',['-D',data,'-m','fast','stop']);running=false;}catch{/* Preserve the directory if the server could not stop. */}}if(!running)rmSync(directory,{recursive:true,force:true});};
  const interrupted=()=>{onExit();process.exit(130);};
  process.once('exit',onExit);process.once('SIGINT',interrupted);process.once('SIGTERM',interrupted);
  const close=async()=>{process.removeListener('exit',onExit);process.removeListener('SIGINT',interrupted);process.removeListener('SIGTERM',interrupted);try{if(running){command('pg_ctl',['-D',data,'-m','fast','stop']);running=false;}}finally{if(!running)await rm(directory,{recursive:true,force:true});}};
  try {
    const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const port=server.address().port;await new Promise(resolve=>server.close(resolve));
    command('initdb',['-D',data,'-U','strength_e2e','--auth=trust','--encoding=UTF8','--no-locale']);
    command('pg_ctl',['-D',data,'-l',join(directory,'postgres.log'),'-o',`-h 127.0.0.1 -p ${port} -F`,'start']);running=true;
    command('createdb',['-h','127.0.0.1','-p',String(port),'-U','strength_e2e','strength_e2e_test']);
    return {url:`postgresql://strength_e2e@127.0.0.1:${port}/strength_e2e_test`,close};
  } catch(error) {await close();throw error;}
}
