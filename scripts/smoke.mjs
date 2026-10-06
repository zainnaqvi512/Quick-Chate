import { spawn } from 'node:child_process';
import { once } from 'node:events';
import assert from 'node:assert/strict';

// No real database or user credentials; this verifies HTTP wiring, not messaging.
const port = 4399;
const child = spawn(process.execPath,['dist/boot.js'],{
  env:{...process.env,NODE_ENV:'production',PORT:String(port),APP_SECRET:'local-smoke-test-only-not-a-production-secret',DATABASE_URL:'mysql://unused:unused@127.0.0.1:1/unused'},
  stdio:['ignore','pipe','pipe'],
});
try {
  await Promise.race([new Promise((resolve,reject)=>{
    child.stdout.on('data',chunk=>{if(String(chunk).includes('Server running'))resolve();});
    child.once('exit',code=>reject(new Error(`Server exited ${code}`)));
  }),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Startup timeout')),5000).unref())]);
  const root=`http://127.0.0.1:${port}`;
  const health=await fetch(`${root}/api/health`);
  assert.equal(health.status,200);assert.equal((await health.json()).service,'quick-chat');
  const shell=await fetch(`${root}/auth`,{headers:{Accept:'text/html'}});
  assert.equal(shell.status,200);assert.match(await shell.text(),/Quick Chat/);
  const privateMedia=await fetch(`${root}/api/media?key=anything`);
  assert.equal(privateMedia.status,401);assert.match(privateMedia.headers.get('cache-control'),/no-store/);
  console.log('PASS: process health, SPA route and unauthenticated media denial (3 smoke checks).');
} finally {child.kill('SIGTERM');await once(child,'exit').catch(()=>{});}
