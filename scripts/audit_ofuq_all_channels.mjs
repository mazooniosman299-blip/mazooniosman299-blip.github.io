import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
const channels=JSON.parse(fs.readFileSync('ofuq-tv/channels.json','utf8')).channels;
const batch=Number(process.env.BATCH||'0');
const count=4,subset=channels.filter((_,i)=>i%count===batch);
const server=spawn('python3',['-m','http.server',String(8770+batch),'--bind','127.0.0.1','--directory','ofuq-tv'],{stdio:'ignore'});
let browser;const outcomes=[];
const sleep=t=>new Promise(r=>setTimeout(r,t));
try{
 await sleep(900);
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
 const page=await browser.newPage({viewport:{width:1280,height:750}});
 const networkErrors=[];
 page.on('response',r=>{if(r.status()>=400&&/m3u8|\\.ts(?:\\?|$)/.test(r.url()))networkErrors.push('HTTP '+r.status()+' '+r.url().slice(0,125))});
 page.on('requestfailed',r=>{if(/m3u8|\\.ts(?:\\?|$)/.test(r.url())&&!String(r.failure()?.errorText).includes('ERR_ABORTED'))networkErrors.push('NET '+r.failure()?.errorText+' '+r.url().slice(0,125))});

 await page.goto('http://127.0.0.1:'+(8770+batch)+'/',{waitUntil:'domcontentloaded',timeout:30000});
 await page.waitForFunction(()=>document.querySelectorAll('#channelList .channel').length>=20,{timeout:15000});
 for(const ch of subset){
  const button=page.locator('#channelList .channel').filter({has:page.locator('b', {hasText:ch.title})}).first();
  if(!await button.count()){outcomes.push({id:ch.id,ok:false,error:'CHANNEL NOT LISTED'});continue}
  networkErrors.length=0;
  await button.click();
  const started=Date.now();
  let ok=false;
  while(Date.now()-started<Math.min(110000,26000*ch.streams.length+5000)){
   await sleep(750);
   const state=await page.locator('#nativePlayer').evaluate(v=>({time:v.currentTime,width:v.videoWidth,height:v.videoHeight,paused:v.paused,error:v.error?.code||null}));
   if(state.time>1.5&&state.width>0&&!state.paused){ok=true;outcomes.push({id:ch.id,ok:true,video:state.width+'x'+state.height,seconds:Number(state.time.toFixed(1))});break}
   const no=await page.locator('#playState').textContent();
   if(no?.includes('غير متاح'))break;
  }
  if(!ok)outcomes.push({id:ch.id,ok:false,error:'NO DECODED VIDEO',network:networkErrors.slice(0,5)});
  console.log('CHANNEL AUDIT '+JSON.stringify(outcomes.at(-1)));
 }
 console.log('CHANNEL BATCH RESULT '+JSON.stringify({batch,total:subset.length,passed:outcomes.filter(r=>r.ok).length,failed:outcomes.filter(r=>!r.ok).map(r=>r.id)}));
 if(outcomes.some(r=>!r.ok))process.exitCode=1;
}finally{await browser?.close();server.kill()}
