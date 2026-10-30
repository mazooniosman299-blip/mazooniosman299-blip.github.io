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
 if(!(await page.locator('#adVideo').count()&&await page.locator('#reelSound').count()))throw Error('Real video news promo or sound button missing');
 if(await page.locator('#newsPromo,#heroLiveVideo,#adTitle').count())throw Error('Disallowed fake static promo or live rebroadcast persists');
 const desktopLayout=await page.evaluate(()=>{const hero=document.querySelector('.hero'),copy=document.querySelector('.hero-copy'),ad=document.querySelector('#newsReelScreen'),channels=document.querySelector('#channels'),news=document.querySelector('#news');const a=ad.getBoundingClientRect(),c=copy.getBoundingClientRect();return {direction:getComputedStyle(hero).direction,layout:getComputedStyle(hero).flexDirection,adX:a.x,copyX:c.x,adW:a.width,adH:a.height,liveY:channels.getBoundingClientRect().top,newsY:news.getBoundingClientRect().top}});
 console.log('DESKTOP LAYOUT '+JSON.stringify(desktopLayout));
 if(!(desktopLayout.adX<desktopLayout.copyX&&desktopLayout.liveY<desktopLayout.newsY&&desktopLayout.adW<740&&desktopLayout.adW>250))throw Error('Incorrect ad-left, title-right, or channels-first layout');

 await page.waitForFunction(()=>document.querySelectorAll('#channelList .channel').length>10,{timeout:18000});
 console.log('CHANNEL BUTTONS '+await page.locator('#channelList .channel').count());
 console.log('CODEC SUPPORT '+JSON.stringify(await page.evaluate(()=>({userAgent:navigator.userAgent,mp4:MediaSource.isTypeSupported('video/mp4; codecs="avc1.42E01E"'),mp3:MediaSource.isTypeSupported('audio/mp4; codecs="mp4a.40.2"')}))));
 const passed=[];
 if(await videoProgress(page,'autoplay initial channel'))passed.push('autoplay');
 const picture=await page.evaluate(()=>window.ofuqQualityInfo?.());
 console.log('2026 ADAPTIVE HLS QUALITY '+JSON.stringify(picture));
 if(!picture||!['hls.js','browser-native'].includes(picture.engine)||picture.decodedHeight===0)throw Error('The new native picture-quality feature is unavailable');
 if(picture.engine==='hls.js'&&(picture.testBandwidth!==false||picture.auto!==true))throw Error('HLS automatic high-quality startup not configured');
 if(!await page.locator('#qualitySelect').count())throw Error('Manual quality selector missing');

 const attempts=[['الجزيرة','الجزيرة'],['سكاي نيوز عربية','سكاي نيوز عربية'],['العربية','العربية']];
 for(const [label,channel] of attempts){
  const btn=page.getByRole('button',{name:new RegExp(channel)}).first();if(!await btn.count())continue;
  await btn.click();if(await videoProgress(page,label))passed.push(label);
  if(passed.length>=2)break;
 }
 if(passed.length<2)throw Error('Only '+passed.length+' direct channels decoded video; need at least 2.');
 await page.waitForFunction(()=>window.ofuqNewsReelInfo?.().storyCount>=4,null,{timeout:18000});
 await page.waitForFunction(()=>{const r=window.ofuqNewsReelInfo?.();return r&&r.videoWidth>=320&&r.currentTime>1.5&&r.playing},{timeout:40000});
 const first=await page.evaluate(()=>({state:window.ofuqNewsReelInfo(),src:document.getElementById('adVideo').currentSrc}));
 console.log('REAL NEWS VIDEO 1 '+JSON.stringify(first));
 if(!first.src.includes('videos.pexels.com/video-files/'))throw Error('Actual stock footage MP4 did not load');
 const list=await page.evaluate(async()=> (await (await fetch('news.json')).json()).items.map(x=>x.title));
 if(!list.includes(first.state.headline))throw Error('News advertisement is not using a real current article title');
 await page.getByRole('button',{name:/تشغيل التعليق الصوتي/}).click();
 const voice=await page.evaluate(()=>window.ofuqNewsReelInfo());
 if(!voice.soundEnabled||!voice.speechAvailable)throw Error('Narrated news audio could not be enabled');
 console.log('NARRATED AUDIO BUTTON PASS '+JSON.stringify(voice));
 await page.waitForFunction(src=>{const v=document.getElementById('adVideo');return v.currentSrc!==src&&v.videoWidth>320&&v.currentTime>1},first.src,{timeout:35000});
 const second=await page.evaluate(()=>({state:window.ofuqNewsReelInfo(),src:document.getElementById('adVideo').currentSrc}));
 console.log('REAL NEWS VIDEO 2 '+JSON.stringify(second));
 if(second.src===first.src||second.state.headline===first.state.headline)throw Error('News video promos are not rotating');
 if(!list.includes(second.state.headline))throw Error('Second news promo is not a genuine news item');
 if(await page.locator('#nativePlayer').evaluate(v=>v.paused))throw Error('Lower native news channel was interrupted by the film promo');
 console.log('REAL FOOTAGE NEWS BUMPERS PASS');
 await page.setViewportSize({width:390,height:844});
 const mobile=await page.evaluate(()=>{const hero=document.querySelector('.hero').getBoundingClientRect(),copy=document.querySelector('.hero-copy').getBoundingClientRect(),ad=document.querySelector('#newsReelScreen').getBoundingClientRect();return {copyY:copy.y,adY:ad.y,adWidth:ad.width,viewport:innerWidth,heroWidth:hero.width,scrollWidth:document.documentElement.scrollWidth}});
 console.log('MOBILE LAYOUT '+JSON.stringify(mobile));
 if(!(mobile.copyY<mobile.adY&&mobile.adWidth<=mobile.viewport&&mobile.scrollWidth<=mobile.viewport+2))throw Error('Mobile layout overflow or wrong stacked order');
 const columns=await page.evaluate(()=>{const watch=document.querySelector('.watch-column').getBoundingClientRect(),list=document.querySelector('.channel-directory').getBoundingClientRect();const grid=getComputedStyle(document.querySelector('.player-grid'));const editorial=document.querySelector('.about-policy');const date=document.querySelector('.news-card .date');return {watchX:watch.x,watchW:watch.width,listX:list.x,listW:list.width,grid: grid.gridTemplateColumns,dateColor:date?getComputedStyle(date).color:null,dateSize:date?parseFloat(getComputedStyle(date).fontSize):null,editorialColor:editorial?getComputedStyle(editorial).color:null}});
 console.log('MOBILE CHANNELS / NEWS STYLE '+JSON.stringify(columns));
 if(!(columns.watchW>100&&columns.listW>80&&Math.abs(columns.watchX-columns.listX)>70))throw Error('Channel guide is not beside the video on mobile');
 if(!columns.dateColor?.includes('255, 255, 255')||columns.dateSize<11||columns.dateSize>13)throw Error('News date should be legible 12px and white');
 if(!columns.editorialColor?.includes('255, 255, 255'))throw Error('Editorial link is not white');
 if((await page.locator('body').innerText()).includes('تغطية متجددة مع أقسام متخصصة'))throw Error('Unwanted news description persists');
 if(!(await page.locator('[data-group="world"]').count()))throw Error('World section filter is missing');
 const articles=await page.evaluate(async()=>{const r=await fetch('news.json');const d=await r.json();return d.items.slice(0,3).map(x=>x.id)});
 await page.goto('http://127.0.0.1:8765/story.html?id='+articles[0],{waitUntil:'domcontentloaded'});
 await page.locator('#article h1').waitFor({timeout:18000});
 await page.waitForFunction(()=>document.querySelectorAll('#article .article-more-card').length>=1,{timeout:12000});
 const body=await page.locator('#article').innerText();
 for(const banned of ['اقرأ التقرير الكامل لدى المصدر','نسبت الصور والمعلومات إلى الجهة الناشرة','صورة الخبر:'])if(body.includes(banned))throw Error('Old source caption remains: '+banned);
if(!await page.locator('#article .article-credits a, #article .licensed-byline a').count())throw Error('Original source documentation absent');
 await page.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'مقالات كاملة'}).click();
 await page.waitForFunction(()=>document.querySelectorAll('#newsGrid .news-card').length>=10,{timeout:10000});
 if(await page.locator('#newsGrid .news-card').count()<10)throw Error('Licensed complete reports missing from dedicated newsroom filter');
 const fullRecords=await page.evaluate(async()=>{const d=await fetch('full-articles.json').then(r=>r.json());return Object.entries(d).map(([id,x])=>({id,expected:x.word_count}))});
 if(fullRecords.length<10)throw Error('Not enough verified complete licensed articles available');
 for(const article of fullRecords){
  await page.goto('http://127.0.0.1:8765/story.html?id='+article.id,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelectorAll('#article .complete-article p,#article .complete-article h2,#article .complete-article h3').length>=5,{timeout:12000});
  const text=await page.locator('#article .complete-article').innerText();
  const count=text.trim().split(/\s+/).length;
  if(count<220||count<article.expected*.8)throw Error('Incomplete article '+article.id+': expected '+article.expected+' words, got '+count);
  if(!await page.locator('#article .licensed-byline a').count()||!await page.locator('#article .license-credit a').count())throw Error('Missing author/source/license in '+article.id);
  console.log('COMPLETE STORY VERIFIED '+article.id+': '+count+' words');
 }
 const licensed=fullRecords[0].id;
 if(!licensed)throw Error('No genuine complete CC BY article was ingested from the source');
 await page.goto('http://127.0.0.1:8765/story.html?id='+licensed,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.querySelectorAll('#article .complete-article p').length>=5,{timeout:13000});
 const fullText=await page.locator('#article .complete-article').innerText();
 if(fullText.trim().split(/\s+/).length<220)throw Error('RSS excerpt incorrectly presented as complete news');
 if(!await page.locator('#article .licensed-byline a').count()||!await page.locator('#article .license-credit a').count())throw Error('Creative Commons author and license attribution missing');
 console.log('FULL-LENGTH ARABIC NEWS PASS:',fullText.trim().split(/\s+/).length,'words')
 console.log('ON-SITE STORY PASS with '+await page.locator('#article .article-more-card').count()+' connected articles');
 if(errs.length)throw Error('Unexpected page errors: '+errs.slice(0,4).join(' | '));
 console.log('OFUQ BROWSER SMOKE TEST PASS');
}finally{await browser?.close();server.kill()}
