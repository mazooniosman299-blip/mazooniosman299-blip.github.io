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
 console.log('CHANNEL BUTTONS '+await page.locator('#channelList .channel').count());
 console.log('CODEC SUPPORT '+JSON.stringify(await page.evaluate(()=>({userAgent:navigator.userAgent,mp4:MediaSource.isTypeSupported('video/mp4; codecs="avc1.42E01E"'),mp3:MediaSource.isTypeSupported('audio/mp4; codecs="mp4a.40.2"')}))));
 const passed=[];
 if(await videoProgress(page,'autoplay initial channel'))passed.push('autoplay');
 const picture=await page.evaluate(()=>window.ofuqQualityInfo?.());
 console.log('2026 ADAPTIVE HLS QUALITY '+JSON.stringify(picture));
 if(!picture||!['hls.js','browser-native'].includes(picture.engine)||picture.decodedHeight===0)throw Error('The new native picture-quality feature is unavailable');
 if(picture.engine==='hls.js'&&(picture.testBandwidth!==false||picture.auto!==true))throw Error('HLS automatic high-quality startup not configured');
 if(!await page.locator('#qualitySelect').count())throw Error('Manual quality selector missing');
 // Mix the newest headlines with verifiably complete, licensed article cards.
 await page.waitForFunction(()=>document.querySelectorAll('#newsGrid .news-card').length>=12,{timeout:12000});
 const homeFull=await page.locator('#newsGrid .full-news-tag').count();
 if(homeFull<4)throw Error('Licensed full stories are not visible in the default newsroom: '+homeFull);
 await page.locator('#newsGrid').scrollIntoViewIfNeeded();
 await page.waitForTimeout(2500);
 const thumbs=await page.locator('#newsGrid .news-photo img').evaluateAll(images=>({total:images.length,loaded:images.filter(x=>x.complete&&x.naturalWidth>0).length,broken:images.filter(x=>x.complete&&x.naturalWidth===0).length,waiting:images.filter(x=>!x.complete).length}));
 console.log('PUBLISHER NEWS PHOTO CHECK '+JSON.stringify(thumbs));
 const cardVisuals=await page.locator('#newsGrid .news-card').evaluateAll(cards=>cards.map(card=>{
  const figure=card.querySelector('.news-photo');
  return {hasPublisherImage:!!figure?.querySelector('img'),hasEditorialArt:!!figure?.querySelector('svg.ofuq-editorial-visual')};
 }));
 if(cardVisuals.some(x=>!x.hasPublisherImage&&!x.hasEditorialArt))throw Error('Empty news thumbnail container');
 if(!cardVisuals.some(x=>x.hasEditorialArt))throw Error('No fallback editorial illustration for image-free news');
 console.log('VISIBLE NEWS VISUALS PASS '+JSON.stringify({total:cardVisuals.length,editorial:cardVisuals.filter(x=>x.hasEditorialArt).length}));



 const attempts=[['الجزيرة','الجزيرة'],['سكاي نيوز عربية','سكاي نيوز عربية'],['العربية','العربية']];
 for(const [label,channel] of attempts){
  const btn=page.getByRole('button',{name:new RegExp(channel)}).first();if(!await btn.count())continue;
  await btn.click();if(await videoProgress(page,label))passed.push(label);
  if(passed.length>=2)break;
 }
 if(passed.length<2)throw Error('Only '+passed.length+' direct channels decoded video; need at least 2.');
 // Staged public HLS candidates: do not merge them without a decoded video frame for every new channel.
 for(const countryChannel of ['تلفزيون سلطنة عُمان','تلفزيون قطر','قناة الريان','تلفزيون السودان','عُمان مباشر','عُمان الثقافية','عُمان الرياضية','تلفزيون قطر 2','الريان القديم']){
  const btn=page.getByRole('button',{name:new RegExp(countryChannel)}).first();
  if(!(await btn.count()))throw Error('Candidate channel missing: '+countryChannel);
  await btn.click();
  if(!(await videoProgress(page,countryChannel)))throw Error('Candidate cannot decode: '+countryChannel);
 }

 const ad=await page.locator('#adVideo').evaluate(v=>({time:v.currentTime,width:v.videoWidth,height:v.videoHeight,src:v.currentSrc,paused:v.paused,error:v.error?.code||null}));
 console.log('AD STATE '+JSON.stringify(ad));
 if(ad.width<100||ad.time<1)throw Error('Upper advertising MP4 did not play');

 // Assert that the upper screen contains real time-rotating COUNTRY news rather
 // than a static pasted headline or an unverified paid advertisement.
 await page.waitForFunction(()=>window.ofuqBroadcastInfo?.().count>=4,null,{timeout:16000});
 const promoCandidates=await page.evaluate(()=>window.ofuqBroadcastInfo());
 if(promoCandidates.count<4)throw Error('Not enough distinct real country headlines in video billboard');
 await page.waitForFunction(()=>window.ofuqBroadcastInfo?.().active===true,null,{timeout:30000});
 const beforePromo=await page.evaluate(()=>({
  country:document.getElementById('newsPromoCountry').textContent,
  title:document.getElementById('newsPromoTitle').textContent,
  source:document.getElementById('newsPromoSource').textContent,
  videoTime:document.getElementById('adVideo').currentTime,
  videoWidth:document.getElementById('adVideo').videoWidth,
  adPaidShown:!document.getElementById('networkAdOverlay').hidden,
  promoVisible:getComputedStyle(document.getElementById('newsPromo')).display!=='none',
  nativePlaying:!document.getElementById('nativePlayer').paused
 }));
 const currentNews=await page.evaluate(async()=> (await (await fetch('news.json')).json()).items.map(x=>x.title));
 if(!currentNews.includes(beforePromo.title)||!beforePromo.source.includes('المصدر:')||!beforePromo.promoVisible)throw Error('Promo is not a real attributed news headline');
 if(beforePromo.adPaidShown)throw Error('Unapproved paid advertising overlay must remain dormant');
 if(!beforePromo.nativePlaying||beforePromo.videoWidth<100)throw Error('News breaks interrupted TV or advertising video');
 await page.waitForFunction(title=>window.ofuqBroadcastInfo?.().active && document.getElementById('newsPromoTitle').textContent!==title,beforePromo.title,{timeout:15000});
 const secondPromo=await page.evaluate(()=>({country:document.getElementById('newsPromoCountry').textContent,title:document.getElementById('newsPromoTitle').textContent,step:window.ofuqBroadcastInfo().step,videoTime:document.getElementById('adVideo').currentTime}));
 if(!currentNews.includes(secondPromo.title)||secondPromo.step<2)throw Error('News interlude is not rotating');
 console.log('BROADCAST NEWS BREAK PASS '+JSON.stringify({first:beforePromo,second:secondPromo,countries:promoCandidates.count}));

 await page.setViewportSize({width:390,height:844});
 const mobile=await page.evaluate(()=>{const hero=document.querySelector('.hero').getBoundingClientRect(),copy=document.querySelector('.hero-copy').getBoundingClientRect(),ad=document.querySelector('#adScreen').getBoundingClientRect();return {copyY:copy.y,adY:ad.y,adWidth:ad.width,viewport:innerWidth,heroWidth:hero.width,scrollWidth:document.documentElement.scrollWidth}});
 console.log('MOBILE LAYOUT '+JSON.stringify(mobile));
 if(!(mobile.copyY<mobile.adY&&mobile.adWidth<=mobile.viewport&&mobile.scrollWidth<=mobile.viewport+2))throw Error('Mobile layout overflow or wrong stacked order');
 const columns=await page.evaluate(()=>{const watch=document.querySelector('.watch-column').getBoundingClientRect(),list=document.querySelector('.channel-directory').getBoundingClientRect();const grid=getComputedStyle(document.querySelector('.player-grid'));const editorial=document.querySelector('.about-policy');const date=document.querySelector('.news-card .date');return {watchX:watch.x,watchW:watch.width,listX:list.x,listW:list.width,grid: grid.gridTemplateColumns,dateColor:date?getComputedStyle(date).color:null,dateSize:date?parseFloat(getComputedStyle(date).fontSize):null,editorialColor:editorial?getComputedStyle(editorial).color:null}});
 console.log('MOBILE CHANNELS / NEWS STYLE '+JSON.stringify(columns));
 if(!(columns.watchW>100&&columns.listW>80&&Math.abs(columns.watchX-columns.listX)>70))throw Error('Channel guide is not beside the video on mobile');
 if(!columns.dateColor?.includes('255, 255, 255')||columns.dateSize<14)throw Error('News date must be readable at 14px or larger in white');
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
 const relatedTile=await page.locator('#related a').first().evaluate(el=>({height:el.getBoundingClientRect().height,pad:getComputedStyle(el).paddingTop}));
 if(relatedTile.height>120||parseFloat(relatedTile.pad)>12)throw Error('Related story box remains over-tall '+JSON.stringify(relatedTile));
 const articleVisual=await page.locator('#article .article-photo').evaluate(el=>Boolean(el.querySelector('img,svg.ofuq-editorial-visual')));
 if(!articleVisual)throw Error('Article feature image/illustration missing');

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
