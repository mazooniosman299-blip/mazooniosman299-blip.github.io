import fs from 'node:fs';
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
const country=process.env.COUNTRY||'om';
const countryName={om:'عُمان',qa:'قطر',sd:'السودان'}[country];
if(!countryName)throw Error('Unsupported country');
const all=JSON.parse(fs.readFileSync('ofuq-tv/channels.json','utf8')).channels;
const listed=all.filter(c=>c.candidate===true&&c.country===countryName);
if(!listed.length)throw Error('No staged candidates for '+countryName);
const port={om:8771,qa:8772,sd:8773}[country];
const server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1','--directory','ofuq-tv'],{stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let browser,failures=0;
try{
 await sleep(1100);
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 page.on('pageerror',e=>console.log('PAGE ERROR '+e.message));
 await page.goto('http://127.0.0.1:'+port+'/',{waitUntil:'domcontentloaded',timeout:30000});
 await page.waitForFunction(()=>document.querySelectorAll('#channelList .channel').length>=35,{timeout:16000});
 for(const ch of listed){
  const btn=page.locator('#channelList .channel').filter({has:page.locator('b',{hasText:ch.title})}).first();
  if(!await btn.count()){failures++;console.log('COUNTRY VIDEO FAILED '+JSON.stringify({country,id:ch.id,title:ch.title,error:'CHANNEL NOT RENDERED'}));continue}
  await btn.click();
  let played=false,last={};
  const start=Date.now();
  while(Date.now()-start<27000){
   await sleep(1100);
   last=await page.locator('#nativePlayer').evaluate(v=>({seconds:v.currentTime,width:v.videoWidth,height:v.videoHeight,paused:v.paused,ready:v.readyState,code:v.error?.code||null}));
   if(last.seconds>=2.2&&last.width>100&&last.height>80&&!last.paused&&last.ready>=2){played=true;break}
   if(await page.locator('#idle').isVisible())break;
  }
  if(played)console.log('COUNTRY VIDEO VERIFIED '+JSON.stringify({country,id:ch.id,title:ch.title,src:ch.streams[0],resolution:last.width+'x'+last.height,seconds:last.seconds}));
  else{failures++;console.log('COUNTRY VIDEO FAILED '+JSON.stringify({country,id:ch.id,title:ch.title,src:ch.streams[0],last}))}
 }
 console.log('COUNTRY BROWSER RESULT '+JSON.stringify({country,total:listed.length,verified:listed.length-failures,failed:failures}));
 if(failures>0)process.exitCode=1;
}finally{await browser?.close();server.kill()}
