import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const platform=process.argv[2];
if(!['android','ios'].includes(platform)) throw new Error('Choose android or ios');
const origin=process.env.VITE_API_ORIGIN;
if(!origin || !origin.startsWith('https://') || new URL(origin).origin!==origin) {
  throw new Error('Set VITE_API_ORIGIN to the deployed HTTPS API origin, without a trailing slash');
}
function run(cmd,args) {
  const result=spawnSync(cmd,args,{stdio:'inherit',env:process.env,shell:process.platform==='win32'});
  if(result.status!==0) process.exit(result.status || 1);
}
run('npm',['run','build']);
if(!existsSync(platform)) run('npx',['cap','add',platform]);
run('npx',['cap','sync',platform]);
if(platform==='android') {
  const manifest='android/app/src/main/AndroidManifest.xml';
  writeFileSync(manifest,readFileSync(manifest,'utf8').replace('android:allowBackup="true"','android:allowBackup="false"'));
}
console.log(`${platform} project prepared. Open it with npx cap open ${platform}; device build/signing is a separate step.`);
