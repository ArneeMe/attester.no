import { chromium } from '@playwright/test';
import { createHash } from 'crypto';
const OUT = process.argv[2];
const T='11111111-1111-1111-1111-111111111111';
const F={id:'sub-e2e-1',name:'Ola Nordmann',group:'Kjelleren'};
const p2=new URLSearchParams(F); const sorted=[...p2.entries()].sort((a,b)=>a[0]<b[0]?-1:1).map(([k,v])=>`${k}=${v}`).join('&');
const hash=createHash('sha512').update(sorted,'utf8').digest('hex');
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
async function shot(name,w,h,fields){
  const pg=await b.newPage({viewport:{width:w,height:h}});
  await pg.route('**/api/org/testorg/certificates/verify*',r=>r.fulfill({json:{hash}}));
  await pg.route(`**/api/org/testorg/templates/${T}*`,r=>r.fulfill({json:{template:{id:T,form_schema:[{key:'name',label:'Navn',type:'text'},{key:'group',label:'Gruppe',type:'text'}]}}}));
  await pg.route('**/api/org/testorg**', r=> r.request().url().includes('certificates')||r.request().url().includes('templates') ? r.fallback() : r.fulfill({json:{}}));
  const q=new URLSearchParams({t:T,...fields});
  await pg.goto(`http://localhost:3220/org/testorg/verify?${q}`,{waitUntil:'networkidle',timeout:45000});
  await pg.waitForTimeout(1500);
  await pg.screenshot({path:`${OUT}/${name}.png`,fullPage:true});
  console.log('ok',name); await pg.close();
}
await shot('verify-desktop',1150,780,F);
await shot('verify-phone',390,844,F);
await shot('verify-invalid',1150,780,{...F,name:'Kari Nordmann'});
await b.close();
