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
 if(!(await page.locator('#reportVideo').count()))throw Error('Real news report player missing');
 if(await page.locator('#adVideo,#adScreen,#adTitle,#networkAdOverlay,#newsPromo').count())throw Error('Removed advertising/news text player returned');
 if(await page.evaluate(()=>/speechSynthesis/.test(document.documentElement.outerHTML)))throw Error('Synthetic voice found in homepage');
 const desktopLayout=await page.evaluate(()=>{const hero=document.querySelector('.hero'),copy=document.querySelector('.hero-copy'),ad=document.querySelector('#reportScreen'),channels=document.querySelector('#channels'),news=document.querySelector('#news');const a=ad.getBoundingClientRect(),c=copy.getBoundingClientRect();return {direction:getComputedStyle(hero).direction,layout:getComputedStyle(hero).flexDirection,adX:a.x,copyX:c.x,adW:a.width,adH:a.height,liveY:channels.getBoundingClientRect().top,newsY:news.getBoundingClientRect().top}});
 console.log('DESKTOP LAYOUT '+JSON.stringify(desktopLayout));
 if(!(desktopLayout.adX<desktopLayout.copyX&&desktopLayout.liveY<desktopLayout.newsY&&desktopLayout.adW<740&&desktopLayout.adW>250))throw Error('Incorrect video-left, title-right, or channels-first layout');

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
   return {sourceImage:!!figure?.querySelector('img'),hidden:!!figure?.hidden,svg:!!figure?.querySelector('svg'),broken:!!figure?.querySelector('img')?.complete&&!figure.querySelector('img').naturalWidth};
 }));
 if(cardVisuals.some(x=>x.svg||(!x.hidden&&!x.sourceImage)))throw Error('Story cards must use real source images or a clean text-only layout');
 if(cardVisuals.some(x=>x.broken))throw Error('Broken publisher image detected');
 console.log('ORIGINAL NEWS PHOTOS PASS '+JSON.stringify({total:cardVisuals.length,sourcePhotos:cardVisuals.filter(x=>x.sourceImage).length,textOnly:cardVisuals.filter(x=>x.hidden).length}));



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

 // Only authentic source footage with the human's original recorded voice.
 await page.waitForFunction(()=>window.ofuqReportInfo?.().count===3,null,{timeout:14000});
 if(await page.evaluate(()=>document.body.innerText.includes('إعلانك على شاشة أُفُق')))throw Error('Old OFUQ advertising message remains');
 await page.waitForFunction(()=>{const v=document.getElementById('reportVideo');return v&&v.currentTime>1.5&&v.videoWidth>=600&&!v.paused},null,{timeout:55000});
 const initialReport=await page.locator('#reportVideo').evaluate(v=>({time:v.currentTime,videoWidth:v.videoWidth,videoHeight:v.videoHeight,muted:v.muted,src:v.currentSrc}));
 console.log('REAL REPORT FILM '+JSON.stringify(initialReport));
 if(!initialReport.muted||!/wikimedia.org/i.test(initialReport.src))throw Error('Source archival report must start playing silently');
 await page.locator('#reportSound').click();
 const audible=await page.locator('#reportVideo').evaluate(v=>({muted:v.muted,paused:v.paused,time:v.currentTime,webkitAudioDecodedByteCount:v.webkitAudioDecodedByteCount??null}));
 if(audible.muted||audible.webkitAudioDecodedByteCount===0)throw Error('Original report audio did not decode after enabling human source sound');
 console.log('HUMAN SOURCE SOUND ACTIVATED '+JSON.stringify(audible));
 if(await page.locator('#reportNext').count())throw Error('Manual next-report control must be removed');
 const first=await page.locator('#reportTitle').innerText();
 await page.locator('#reportVideo').evaluate(v=>v.dispatchEvent(new Event('ended')));
 await page.waitForFunction(prev=>document.getElementById('reportTitle').textContent!==prev,first,{timeout:14000});
 await page.waitForFunction(()=>document.getElementById('reportVideo').videoWidth>0&&document.getElementById('reportVideo').currentTime>1.1,null,{timeout:55000});
 console.log('AUTO ADVANCE SECOND REPORT PASS '+await page.locator('#reportTitle').innerText());
 await page.locator('#reportVideo').evaluate(v=>v.dispatchEvent(new Event('ended')));
 await page.waitForFunction(()=>window.ofuqReportInfo?.().index===2,null,{timeout:8000});
 await page.waitForFunction(()=>{const v=document.getElementById('reportVideo');return v&&v.videoWidth>=600&&v.currentTime>1&&!v.paused},null,{timeout:55000});
 console.log('AUTO ADVANCE THIRD REPORT PASS '+await page.locator('#reportTitle').innerText());
 const verifiedClips=await page.evaluate(async()=>{const j=await fetch('report-clips.json').then(r=>r.json());return j.clips});
 if(verifiedClips.length!==3||verifiedClips.some(x=>!x.date.startsWith('2026-')))throw Error('Old videos remain in 2026 playlist');
 const thirdFilm=await page.locator('#reportVideo').evaluate(v=>({width:v.videoWidth,time:v.currentTime,audio:v.webkitAudioDecodedByteCount??null}));
 if(thirdFilm.width<300||thirdFilm.time<1||thirdFilm.audio===0)throw Error('Third 2026 clip lacks actual video and original audio');
 console.log('THREE 2026 FOOTAGE TEST PASS '+JSON.stringify(thirdFilm));
 await page.setViewportSize({width:390,height:844});
 const mobile=await page.evaluate(()=>{const hero=document.querySelector('.hero').getBoundingClientRect(),copy=document.querySelector('.hero-copy').getBoundingClientRect(),ad=document.querySelector('#reportScreen').getBoundingClientRect();return {copyY:copy.y,adY:ad.y,adWidth:ad.width,viewport:innerWidth,heroWidth:hero.width,scrollWidth:document.documentElement.scrollWidth}});
 console.log('MOBILE LAYOUT '+JSON.stringify(mobile));
 if(!(mobile.adY<mobile.copyY&&mobile.adWidth<=mobile.viewport&&mobile.scrollWidth<=mobile.viewport+2))throw Error('Mobile video must appear before intro, with no horizontal overflow');
 const columns=await page.evaluate(()=>{const watch=document.querySelector('.watch-column').getBoundingClientRect(),list=document.querySelector('.channel-directory').getBoundingClientRect(),stage=document.querySelector('.channel-player .video-stage').getBoundingClientRect(),player=document.querySelector('.channel-player').getBoundingClientRect(),foot=document.querySelector('.channel-player .player-foot').getBoundingClientRect(),buttons=[...document.querySelectorAll('.channel-player .player-foot button')].map(x=>x.getBoundingClientRect()),editorial=document.querySelector('.about-policy'),date=document.querySelector('.news-card .date');return {watchX:watch.x,watchW:watch.width,listY:list.y,listW:list.width,watchBottom:watch.bottom,stageW:stage.width,playerW:player.width,footW:foot.width,buttonsWithin:buttons.every(b=>b.right<=player.right+2&&b.left>=player.left-2),dateColor:date?getComputedStyle(date).color:null,dateSize:date?parseFloat(getComputedStyle(date).fontSize):null,editorialColor:editorial?getComputedStyle(editorial).color:null}});
 console.log('MOBILE FULL-WIDTH CHANNELS '+JSON.stringify(columns));
 if(!(columns.watchW>=330&&columns.stageW>=330&&columns.listY>=columns.watchBottom-2&&columns.buttonsWithin&&columns.playerW>=330))throw Error('Cropped mobile player or channel directory not below video');

 if(!columns.dateColor?.includes('255, 255, 255')||columns.dateSize<14)throw Error('News date must be readable at 14px or larger in white');
 if(!columns.editorialColor?.includes('255, 255, 255'))throw Error('Editorial link is not white');
 const ui=await page.evaluate(()=>{const clock=document.getElementById('clock'),privacy=document.querySelector('footer a[href="privacy.html"]');return {clockText:clock?.textContent,clockSize:clock?parseFloat(getComputedStyle(clock).fontSize):0,clockColor:clock?getComputedStyle(clock).color:'',privacyColor:privacy?getComputedStyle(privacy).color:''}});
 if(!/\d{2}:\d{2}:\d{2}/.test(ui.clockText)||ui.clockSize<13||ui.clockColor!=='rgb(255, 255, 255)'||ui.privacyColor!=='rgb(255, 255, 255)')throw Error('Clock and privacy contrast failed '+JSON.stringify(ui));
 console.log('VISIBLE CLOCK AND PRIVACY PASS '+JSON.stringify(ui));
 if((await page.locator('body').innerText()).includes('تغطية متجددة مع أقسام متخصصة'))throw Error('Unwanted news description persists');
 if(!(await page.locator('[data-group="world"]').count()))throw Error('World section filter is missing');
 // Every short-only RSS story must open the original source, never a tiny in-site excerpt.
 const newsLinks=await page.locator('#newsGrid .news-card').evaluateAll(cards=>cards.map(a=>({full:!!a.querySelector('.full-news-tag'),href:a.getAttribute('href')})));
 if(newsLinks.some(x=>!x.href.startsWith('story.html?id=')))throw Error('An OFUQ news item still navigates outside the website');
 if(newsLinks.filter(x=>x.full).length<15)throw Error('Default news cards do not prioritize complete on-site licensed articles');
 const briefId=await page.evaluate(async()=>{const d=await (await fetch('news.json')).json();return d.items.find(x=>x.full_article!==true)?.id});
 if(briefId){
  await page.goto('http://127.0.0.1:8765/story.html?id='+briefId,{waitUntil:'domcontentloaded'});
  await page.locator('#article h1').waitFor({timeout:16000});
  if(!page.url().includes('/story.html?id='))throw Error('RSS brief illegally redirected reader outside OFUQ');
  if(!(await page.locator('#article').innerText()).includes('موجز إخباري موثق'))throw Error('Unlicensed summary pretends to be full article');
 }
 const articles=await page.evaluate(async()=>{const d=await (await fetch('news.json')).json();return d.items.filter(x=>x.full_article).slice(0,3).map(x=>x.id)});
 await page.goto('http://127.0.0.1:8765/story.html?id='+articles[0],{waitUntil:'domcontentloaded'});
 await page.locator('#article h1').waitFor({timeout:18000});
 await page.waitForFunction(()=>document.querySelectorAll('#article .article-more-card').length>=1,{timeout:12000});
 const body=await page.locator('#article').innerText();
 for(const banned of ['اقرأ التقرير الكامل لدى المصدر','نسبت الصور والمعلومات إلى الجهة الناشرة','صورة الخبر:'])if(body.includes(banned))throw Error('Old source caption remains: '+banned);
if(!await page.locator('#article .article-credits a, #article .licensed-byline a').count())throw Error('Original source documentation absent');
 const relatedTile=await page.locator('#related a').first().evaluate(el=>({height:el.getBoundingClientRect().height,pad:getComputedStyle(el).paddingTop}));
 if(relatedTile.height>120||parseFloat(relatedTile.pad)>12)throw Error('Related story box remains over-tall '+JSON.stringify(relatedTile));
 const articleVisual=await page.locator('#article .article-photo').evaluate(el=>({hasPhoto:!!el.querySelector('img'),noSourcePhoto:el.hidden,hasIllustration:!!el.querySelector('svg')}));
 if(articleVisual.hasIllustration||(!articleVisual.hasPhoto&&!articleVisual.noSourcePhoto))throw Error('Article shows stock illustration or empty photo slot');

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
   const credit=await page.locator('#article').innerText();
   if(credit.includes('إعادة نشر بموجب ترخيص')||credit.includes('أُزيلت الصور والتضمينات'))throw Error('Old verbose licensing notice appears');
   if(!credit.includes('المصدر:'))throw Error('Article is missing source line');
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
