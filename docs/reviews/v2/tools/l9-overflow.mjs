// Run: node l9-overflow.mjs <mockup dir> <width>. Forces the 390 frames to the width and lists anything that overflows horizontally.
import {createRequire} from 'module';const require=createRequire('/opt/npm-tools/node_modules/');
const {chromium}=require('playwright');import fs from 'fs';
const dir=process.argv[2];const W=+process.argv[3]||360;
const b=await chromium.launch();
for(const f of fs.readdirSync(dir).filter(f=>/^S16\d_.*_m\.dc\.html$/.test(f))){
 const p=await b.newPage({viewport:{width:W,height:900}});await p.goto('file://'+dir+'/'+f);await p.waitForTimeout(200);
 const r=await p.evaluate((W)=>{document.querySelectorAll('[style*="width:390px"]').forEach(e=>{e.style.width=W+'px'});
  const bad=[];document.querySelectorAll('body *').forEach(e=>{const r=e.getBoundingClientRect();if(r.width===0||r.height===0)return;if(r.right<=W+1&&r.left>=-1)return;
   let a=e.parentElement,clipped=false;while(a&&a!==document.body){const o=getComputedStyle(a);if(/(hidden|auto|scroll|clip)/.test(o.overflowX)&&a.getBoundingClientRect().right<=W+1){clipped=true;break}a=a.parentElement}
   if(!clipped&&!['svg','path','circle','rect','line','g'].includes(e.tagName.toLowerCase()))bad.push(`${e.tagName.toLowerCase()}.${(e.className+'').split(' ')[0]} "${(e.textContent||'').trim().slice(0,30)}" ${Math.round(r.left)}..${Math.round(r.right)}`)});
  return {sw:document.documentElement.scrollWidth,bad:[...new Set(bad)].slice(0,8)}},W);
 console.log(f,W,'sw',r.sw,r.bad.length?'\n  '+r.bad.join('\n  '):'');await p.close()}
await b.close();
