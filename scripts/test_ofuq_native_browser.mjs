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
 if(!(await page.locator('#networkAdOverlay').count()))throw Error('Network video slot missing');
 if(!(await page.locator('#networkAdOverlay').isHidden()))throw Error('Ad network overlay should be hidden when no approved VAST inventory is configured');
 if(await page.evaluate(()=>Boolean(window.google?.ima)))throw Error('External IMA SDK should not load without active publisher ad tag');

 const desktopLayout=await page.evaluate(()=>{const hero=document.querySelector('.hero'),copy=document.querySelector('.hero-copy'),ad=document.querySelector('#adScreen'),channels=document.querySelector('#channels'),news=document.querySelector('#news');const a=ad.getBoundingClientRect(),c=copy.getBoundingClientRect();return {direction:getComputedStyle(hero).direction,layout:getComputedStyle(hero).flexDirection,adX:a.x,copyX:c.x,adW:a.width,adH:a.height,liveY:channels.getBoundingClientRect().top,newsY:news.getBoundingClientRect().top}});
 console.log('DESKTOP LAYOUT '+JSON.stringify(desktopLayout));
 if(!(desktopLayout.adX<desktopLayout.copyX&&desktopLayout.liveY<desktopLayout.newsY&&desktopLayout.adW<740&&desktopLayout.adW>250))throw Error('Incorrect ad-left, title-right, or channels-first layout');

 await page.waitForFunction(()=>document.querySelectorAll('#channelList .channel').length>10,{timeout:18000});
 if(!await page.locator('#qualitySelect').count())throw Error('Quality selector is absent');
 if((await page.locator('#qualitySelect').inputValue())!=='auto')throw Error('Automatic playback is not the default');

 console.log('CHANNEL BUTTONS '+await page.locator('#channelList .channel').count());
 console.log('CODEC SUPPORT '+JSON.stringify(await page.evaluate(()=>({userAgent:navigator.userAgent,mp4:MediaSource.isTypeSupported('video/mp4; codecs="avc1.42E01E"'),mp3:MediaSource.isTypeSupported('audio/mp4; codecs="mp4a.40.2"')}))));
 const passed=[];
 if(await videoProgress(page,'autoplay initial channel'))passed.push('autoplay');
 const firstQuality=await page.evaluate(()=>({played:document.getElementById('nativePlayer').videoHeight,options:[...document.getElementById('qualitySelect').options].map(x=>({name:x.textContent,value:x.value})),hlsLevels:typeof hlsController==='undefined'?[]:hlsController?.levels?.map(x=>({height:x.height,bitrate:x.bitrate}))||[],startEstimate:typeof hlsController==='undefined'?0:hlsController?.config?.abrEwmaDefaultEstimate||0,testBandwidth:typeof hlsController==='undefined'?null:hlsController?.config?.testBandwidth}));
 console.log('FIRST CHANNEL QUALITY '+JSON.stringify(firstQuality));
 if(firstQuality.testBandwidth!==false)throw Error('HLS still probes lowest quality at startup');
 if(firstQuality.hlsLevels.length>1&&firstQuality.options.length<2)throw Error('Missing manual quality levels');
 if(firstQuality.hlsLevels.length&&firstQuality.played===0)throw Error('No decoded first channel resolution');

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
 await page.setViewportSize({width:390,height:844});
 const mobile=await page.evaluate(()=>{const hero=document.querySelector('.hero').getBoundingClientRect(),copy=document.querySelector('.hero-copy').getBoundingClientRect(),ad=document.querySelector('#adScreen').getBoundingClientRect();return {copyY:copy.y,adY:ad.y,adWidth:ad.width,viewport:innerWidth,heroWidth:hero.width,scrollWidth:document.documentElement.scrollWidth}});
 console.log('MOBILE LAYOUT '+JSON.stringify(mobile));
 if(!(mobile.copyY<mobile.adY&&mobile.adWidth<=mobile.viewport&&mobile.scrollWidth<=mobile.viewport+2))throw Error('Mobile layout overflow or wrong stacked order');
 if(!(await page.locator('[data-group="world"]').count()))throw Error('World section filter is missing');
 const articles=await page.evaluate(async()=>{const r=await fetch('news.json');const d=await r.json();return d.items.slice(0,3).map(x=>x.id)});
 await page.goto('http://127.0.0.1:8765/story.html?id='+articles[0],{waitUntil:'domcontentloaded'});
 await page.locator('#article h1').waitFor({timeout:18000});
 await page.waitForFunction(()=>document.querySelectorAll('#article .article-more-card').length>=1,{timeout:12000});
 const body=await page.locator('#article').innerText();
 for(const banned of ['اقرأ التقرير الكامل لدى المصدر','نسبت الصور والمعلومات إلى الجهة الناشرة','صورة الخبر:'])if(body.includes(banned))throw Error('Old source caption remains: '+banned);
 if(!await page.locator('#article .article-source a').count())throw Error('Original reference missing');
 console.log('ON-SITE STORY PASS with '+await page.locator('#article .article-more-card').count()+' connected articles');
 if(errs.length)throw Error('Unexpected page errors: '+errs.slice(0,4).join(' | '));
 console.log('OFUQ QUALITY CHECK PASS');
 console.log('OFUQ BROWSER SMOKE TEST PASS');
}finally{await browser?.close();server.kill()}
