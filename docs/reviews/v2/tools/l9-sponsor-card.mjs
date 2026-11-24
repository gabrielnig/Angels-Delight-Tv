// Run: node l9-sponsor-card.mjs <file> <viewport width> [type scale]. Prints box size, clipping, label width and truncation for every sponsor card.
import {createRequire} from 'module';const require=createRequire('/opt/npm-tools/node_modules/');
const {chromium}=require('playwright');
const [,,f,W,scale='']=process.argv;
const b=await chromium.launch();const p=await b.newPage({viewport:{width:+W,height:800}});
await p.goto('file://'+f);await p.waitForTimeout(250);
const r=await p.evaluate(([W,scale])=>{document.querySelectorAll('[style*="width:390px"]').forEach(e=>{e.style.width=W+'px'});
 if(scale)document.documentElement.style.setProperty('--type-scale',scale);
 return [...document.querySelectorAll('a.spc')].map((c,i)=>{const cr=c.getBoundingClientRect();const tx=c.querySelector('.tx');const sl=c.querySelector('.slab');const h3=c.querySelector('h3');const nm=c.querySelector('.nm');
 return `#${i} ${c.classList.contains('m')?'compact':'wide'} card=${cr.width.toFixed(0)}x${cr.height.toFixed(1)} txClip=${tx.scrollHeight>tx.clientHeight+1} cardClip=${c.scrollHeight>c.clientHeight+1} slabInTx=${sl.getBoundingClientRect().right<=tx.getBoundingClientRect().right+0.5} nameTruncated=${nm.scrollWidth>nm.clientWidth+1} h3lines=${Math.round(h3.getBoundingClientRect().height/parseFloat(getComputedStyle(h3).lineHeight))} labelW=${sl.scrollWidth} slabH=${sl.getBoundingClientRect().height.toFixed(1)} used=${(()=>{const k=[...tx.children];return (k[k.length-1].getBoundingClientRect().bottom-k[0].getBoundingClientRect().top).toFixed(0)})()}/${tx.clientHeight}`})},[W,scale]);
console.log(r.join('\n'));await b.close();
