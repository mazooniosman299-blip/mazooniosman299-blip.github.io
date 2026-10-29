import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
const server=spawn('python3',['-m','http.server','8765','--bind','127.0.0.1','--directory','ofuq-tv'],{stdio:'ignore'});
let browser;
const sleep=t=>new Promise(resolve=>setTimeout(resolve,t));
const details=page=>page.locator('#nativePlayer').evaluate(v=>({time:v.currentTime,paused:v.paused,ready:v.readyState,network:v.networkState,width:v.videoWidth,height:v.videoHeight,error:v.error?.code||null,src:v.currentSrc?.slice(0,140)}));
async function videoProgress(page,label){
 try{
  await page.waitForFunction(()=>{const v=document.getElementById('nativePlayer');return v&&!v.paused&&v.readyState>=2&&v.videoWidth>0&&v.currentTime>2.0},null,{timeout:24000});
  const state=await details(page);
  console.log('VIDEO WORKING: '+label+' '+JSON.stringify(state));
  return true;
 }catch(e){console.log('PLAYBACK FAILED '+label+' '+JSON.stringify(await details(page))+' Hls='+String(await page.evaluate(()=>Boolean(window.Hls?.isSupported?.()))));return false}
}
try{
 await sleep(1100);
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
 const page=await browser.newPage({viewport:{width:1366,height:900}});
 const errs=[];page.on('requestfailed',req=>{if(/m3u8|\.ts(?:\?|$)|\.m4s/.test(req.url()))console.log('NETWORK FAILED '+req.url().slice(0,190)+' '+req.failure()?.errorText)});page.on('response',res=>{if(res.status()>=400&&/m3u8|\.ts(?:\?|$)|\.m4s/.test(res.url()))console.log('NETWORK HTTP '+res.status()+' '+res.url().slice(0,190))});page.on('pageerror',e=>{errs.push(e.message);console.log('PAGE ERROR '+e.message)});
 page.on('console',msg=>{if(['error','warning','info'].includes(msg.type())&&/HLS-|HLS |m3u8|MEDIA|MANIFEST|CORS|error/i.test(msg.text()))console.log('CONSOLE '+msg.type()+' '+msg.text().slice(0,250))});
 await page.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded',timeout:30000});
 if(await page.locator('iframe[src*="youtube"]').count()||await page.locator('#youtubeStage').count())throw Error('YouTube player must not exist');
 if(!(await page.locator('#adVideo').count()))throw Error('Top advertising video missing');
 await page.waitForFunction(()=>document.querySelectorAll('#channelList .channel').length>10,{timeout:18000});
 console.log('CHANNEL BUTTONS '+await page.locator('#channelList .channel').count());
 console.log('CODEC SUPPORT '+JSON.stringify(await page.evaluate(()=>({userAgent:navigator.userAgent,mp4:MediaSource.isTypeSupported('video/mp4; codecs="avc1.42E01E"'),mp3:MediaSource.isTypeSupported('audio/mp4; codecs="mp4a.40.2"')}))));
 const passed=[];
 if(await videoProgress(page,'autoplay initial channel'))passed.push('autoplay');
 const attempts=[['الجزيرة','الجزيرة'],['سكاي نيوز عربية','سكاي نيوز عربية'],['العربية','العربية']];
 for(const [label,channel] of attempts){
  const btn=page.getByRole('button',{name:new RegExp(channel)}).first();if(!await btn.count())continue;
  await btn.click();if(await videoProgress(page,label))passed.push(label);
  if(passed.length>=2)break;
 }
 if(passed.length<2)throw Error('Only '+passed.length+' direct channels decoded video; need at least 2.');
 const ad=await page.locator('#adVideo').evaluate(v=>({time:v.currentTime,width:v.videoWidth,height:v.videoHeight,src:v.currentSrc,paused:v.paused,error:v.error?.code||null}));
 console.log('AD STATE '+JSON.stringify(ad));
 if(ad.width<100||ad.time<1)throw Error('Upper advertising MP4 did not play');
 if(errs.length)throw Error('Unexpected page errors: '+errs.slice(0,4).join(' | '));
 console.log('OFUQ BROWSER SMOKE TEST PASS');
}finally{await browser?.close();server.kill()}
