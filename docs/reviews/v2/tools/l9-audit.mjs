// Run: node l9-audit.mjs <mockup dir> [name filter]. Needs Playwright (NODE_PATH or /opt/npm-tools). Lists targets under 44 px, text contrast under AA, fonts under 12 px, dashes and emoji.
import {createRequire} from 'module';const require=createRequire('/opt/npm-tools/node_modules/');
const {chromium}=require('playwright');
import fs from 'fs';
const dir=process.argv[2]; const only=process.argv[3]||'';
const files=fs.readdirSync(dir).filter(f=>f.endsWith('.dc.html')&&f.includes(only)).sort();
const b=await chromium.launch();
const fn=()=>{
 const parse=c=>{const m=c.match(/rgba?\(([^)]+)\)/);if(!m)return null;const p=m[1].split(/[ ,\/]+/).filter(Boolean).map(Number);return {r:p[0],g:p[1],b:p[2],a:p.length>3?p[3]:1}};
 const over=(f,b)=>({r:f.r*f.a+b.r*(1-f.a),g:f.g*f.a+b.g*(1-f.a),b:f.b*f.a+b.b*(1-f.a),a:1});
 const lum=c=>{const f=v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)};return .2126*f(c.r)+.7152*f(c.g)+.0722*f(c.b)};
 const cr=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
 const bgOf=el=>{let layers=[];let e=el;let img=false;while(e&&e.nodeType===1){const cs=getComputedStyle(e);if(cs.backgroundImage!=='none')img=true;const c=parse(cs.backgroundColor);if(c&&c.a>0){layers.push(c);if(c.a>=1)break}e=e.parentElement}
  let base={r:255,g:255,b:255,a:1};for(let i=layers.length-1;i>=0;i--)base=over(layers[i],base);return {base,img}};
 const vis=el=>{const r=el.getBoundingClientRect();const cs=getComputedStyle(el);return r.width>0&&r.height>0&&cs.visibility!=='hidden'&&cs.display!=='none'&&cs.opacity!=='0'};
 const out={small:[],contrast:[],dash:[],noOutline:[],hex:0};
 const sel='a,button,input,select,textarea,summary,[role=button],[role=tab],[role=switch],[role=radio],[role=checkbox],[tabindex]:not([tabindex="-1"])';
 const label=el=>(el.getAttribute('aria-label')||el.textContent||el.id||el.className||'').trim().replace(/\s+/g,' ').slice(0,40);
 document.querySelectorAll(sel).forEach(el=>{if(!vis(el))return;const r=el.getBoundingClientRect();
   if(el.tagName==='INPUT'&&['radio','checkbox'].includes(el.type)){const l=el.closest('label');if(l){const lr=l.getBoundingClientRect();if(lr.width>=44&&lr.height>=44)return}}
   if(r.width<43.5||r.height<43.5)out.small.push(`${el.tagName.toLowerCase()}.${(el.className+'').split(' ')[0]} "${label(el)}" ${Math.round(r.width)}x${Math.round(r.height)}`)});
 const tw=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let n;
 while(n=tw.nextNode()){const t=n.textContent.trim();if(!t)continue;const el=n.parentElement;if(!el||!vis(el)||['SCRIPT','STYLE'].includes(el.tagName))continue;
  if(/[\u2013\u2014]/.test(t))out.dash.push(t.slice(0,50));
  if(/[\u{1F300}-\u{1FAFF}☀-➿]/u.test(t))out.dash.push('EMOJI '+t.slice(0,40));
  const cs=getComputedStyle(el);const fg=parse(cs.color);if(!fg)continue;const {base,img}=bgOf(el);
  const f=over({...fg,a:fg.a*(parseFloat(cs.opacity)||1)},base);const ratio=cr(f,base);
  const px=parseFloat(cs.fontSize),bold=parseInt(cs.fontWeight)>=700;const large=px>=24||(px>=18.66&&bold);
  const need=large?3:4.5;
  if(ratio<need)out.contrast.push(`${ratio.toFixed(2)} need ${need} ${px}px "${t.slice(0,35)}" fg=${cs.color} bg=rgb(${Math.round(base.r)},${Math.round(base.g)},${Math.round(base.b)})${img?' (bg image)':''}`);
  if(px<12)out.contrast.push(`SMALLFONT ${px}px "${t.slice(0,30)}"`);
 }
 return out};
for(const f of files){
 const widths=f.endsWith('_m.dc.html')?[360,390]:[1360];
 for(const w of widths){const p=await b.newPage({viewport:{width:w,height:800}});await p.goto('file://'+dir+'/'+f);await p.waitForTimeout(250);
  const o=await p.evaluate(fn);const sw=await p.evaluate(()=>document.documentElement.scrollWidth);
  console.log(`\n== ${f} @${w} scrollW=${sw}${sw>w?' OVERFLOW':''}`);
  const u=a=>[...new Set(a)];
  if(o.small.length)console.log(' SMALL',u(o.small).length,'\n  '+u(o.small).slice(0,25).join('\n  '));
  if(o.contrast.length)console.log(' CONTRAST',u(o.contrast).length,'\n  '+u(o.contrast).slice(0,25).join('\n  '));
  if(o.dash.length)console.log(' DASH/EMOJI',u(o.dash).slice(0,10));
  await p.close();}}
await b.close();
