(()=>{'use strict';
const $=id=>document.getElementById(id);
const notify=(message,kind='neutral')=>{ const status=$('playState');if(status)status.textContent=kind==='playing'?message:kind==='error'?'البث غير متاح الآن':'';const light=$('signalLight');if(light)light.className='signal'+(kind==='playing'?' playing':kind==='error'?' error':'') };
const clockFmt=new Intl.DateTimeFormat('ar-OM',{timeZone:'Asia/Muscat',hour:'2-digit',minute:'2-digit',hour12:false});
function clock(){$('clock').textContent=clockFmt.format(new Date())+' · مسقط'}clock();setInterval(clock,60000);
$('year').textContent=String(new Date().getFullYear());
$('menuButton').addEventListener('click',()=>{const nav=$('navigation');const open=nav.classList.toggle('open');$('menuButton').setAttribute('aria-expanded',String(open))});
document.querySelectorAll('#navigation a').forEach(a=>a.addEventListener('click',()=>{$('navigation').classList.remove('open');$('menuButton').setAttribute('aria-expanded','false')}));
let channelSearch='',channels=[],selected=null, currentPlayer=null, frame=null, iframeTimeout=null, healthTimer=null, mediaActive=false, ytApiReady=false;
function safeId(id){return /^[A-Za-z0-9_-]{11}$/.test(id)}
function renderChannels(){const container=$('channelList');container.replaceChildren();$('channelCount').textContent='عدد القنوات: '+channels.length;for(const ch of channels.filter(x=>[x.title,x.category||''].join(' ').toLocaleLowerCase('ar').includes(channelSearch))){const b=document.createElement('button');b.type='button';b.className='channel'+(selected?.id===ch.id?' active':'');b.setAttribute('aria-pressed',String(selected?.id===ch.id));const icon=document.createElement('span');icon.className='initial';icon.textContent=ch.initial||'TV';const label=document.createElement('span');const name=document.createElement('b');name.textContent=ch.title;const detail=document.createElement('small');detail.textContent=ch.category||'قناة إخبارية';label.append(name,detail);b.append(icon,label);b.addEventListener('click',()=>switchChannel(ch));container.append(b)}}
function destroyPlayer(){disposeHls();if(iframeTimeout){clearTimeout(iframeTimeout);iframeTimeout=null}if(healthTimer){clearInterval(healthTimer);healthTimer=null}if(currentPlayer){try{currentPlayer.destroy()}catch{}currentPlayer=null}frame=null;$('youtubeStage').replaceChildren();}
function initApi(){if(window.YT?.Player){ytApiReady=true;attachPlayer();return}if(document.getElementById('youtubeApi'))return;const js=document.createElement('script');js.id='youtubeApi';js.src='https://www.youtube.com/iframe_api';js.async=true;js.onerror=()=>{if(selected&&!mediaActive)notify('المشغل ظاهر؛ تعذّر التحقق من الفيديو بسبب خدمة المشغّل.', 'error')};document.head.append(js)}
window.onYouTubeIframeAPIReady=()=>{ytApiReady=true;attachPlayer()};
function checkProgress(expected){if(healthTimer){clearInterval(healthTimer);healthTimer=null}let prev=null,checks=0,advances=0,stalled=0;healthTimer=setInterval(()=>{if(selected?.id!==expected||!currentPlayer){clearInterval(healthTimer);healthTimer=null;return}try{const t=Number(currentPlayer.getCurrentTime()),state=currentPlayer.getPlayerState();if(state!==YT.PlayerState.PLAYING){prev=null;checks=0;stalled=0;return}if(Number.isFinite(t)&&prev!==null){if(t>prev+.45){advances++;stalled=0}else stalled++}if(Number.isFinite(t))prev=t;checks++;if(advances>=2&&!mediaActive){mediaActive=true;notify('تشاهد الآن: '+selected.title+'','playing')}if(stalled>=8){mediaActive=false;checks=0;advances=0;stalled=0;notify('توقّف تقدّم الفيديو؛ المشغل يحتاج إعادة اتصال.','error')}else if(checks>=9&&!mediaActive){checks=0;notify('لم يتقدّم الفيديو؛ جرّب إعادة المحاولة أو قناة أخرى.','error')}}catch(e){if(++checks>=9){checks=0;mediaActive=false;notify('تعذّر التأكد من استمرار الفيديو.','error')}}},1600)}
function attachPlayer(){if(!ytApiReady||!frame||!window.YT?.Player||currentPlayer)return;const expected=selected.id;try{currentPlayer=new YT.Player(frame,{events:{onReady:()=>{if(selected?.id===expected&&!mediaActive)notify('المشغل جاهز — اضغط تشغيل للمشاهدة')},onStateChange:event=>{if(selected?.id!==expected)return;if(event.data===YT.PlayerState.PLAYING){notify('المشغل بدأ التشغيل؛ جارٍ التحقق من تقدّم الفيديو');checkProgress(expected)}else if(event.data===YT.PlayerState.BUFFERING){notify('جارٍ تحميل صورة القناة…')}else if(event.data===YT.PlayerState.ENDED){notify('انتهى هذا البث لدى الناشر، اختر قناة أخرى','error')}else if(event.data===YT.PlayerState.PAUSED){mediaActive=false;if(healthTimer){clearInterval(healthTimer);healthTimer=null}notify('المشاهدة متوقفة مؤقتاً')}},onError:event=>{if(selected?.id!==expected)return;mediaActive=false;if(healthTimer){clearInterval(healthTimer);healthTimer=null}const reason=[100,101,150].includes(event.data)?'الناشر أوقف الفيديو أو منع تشغيله داخل المواقع الأخرى.':'تعذّر تشغيل فيديو القناة الآن.';notify(reason,'error')}}})}catch{notify('تعذّر تهيئة المشغّل؛ اضغط إعادة المحاولة.','error')}}
function switchChannel(ch){if(!safeId(ch.videoId)&&!validHls(ch))return;selected=ch;mediaActive=false;destroyPlayer();$('playingChannel').textContent=ch.title;$('idle').hidden=true;$('youtubeStage').hidden=false;notify('', 'neutral');if(validHls(ch)){startHls(ch).catch(()=>notify('البث غير متاح الآن','error'));renderChannels();return}const iframe=document.createElement('iframe');frame=iframe;iframe.title='قناة '+ch.title;iframe.loading='eager';iframe.allow='autoplay; encrypted-media; picture-in-picture; fullscreen';iframe.referrerPolicy='strict-origin-when-cross-origin';iframe.allowFullscreen=true;iframe.src='https://www.youtube-nocookie.com/embed/'+ch.videoId+'?rel=0&playsinline=1&enablejsapi=1&autoplay=1&mute=1&origin='+encodeURIComponent(location.origin);iframe.addEventListener('load',()=>{if(!mediaActive&&selected?.id===ch.id)notify('','neutral')});iframeTimeout=setTimeout(()=>{if(!mediaActive&&selected?.id===ch.id)notify('البث غير متاح الآن','error')},25000);$('youtubeStage').append(iframe);renderChannels();initApi()}

$('channelSearch').addEventListener('input',e=>{channelSearch=e.target.value.trim().toLocaleLowerCase('ar');renderChannels()});
$('full').addEventListener('click',()=>{if(document.fullscreenElement)document.exitFullscreen?.().catch(()=>{});else document.querySelector('.channel-player').requestFullscreen?.().catch(()=>notify('ملء الشاشة غير مدعوم في هذا المتصفح.','error'))});
fetch('channels.json?v=20261030-r3&ts='+Date.now(),{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('channels:'+r.status);return r.json()}).then(data=>{channels=(Array.isArray(data.channels)?data.channels:[]).filter(c=>(safeId(c.videoId)||validHls(c))&&typeof c.title==='string');if(!channels.length)throw Error('empty');renderChannels();switchChannel(channels[0])}).catch(()=>{$('channelList').textContent='تعذّر تحميل قائمة القنوات. أعد تحميل الصفحة.';$('channelCount').textContent='غير متاحة حالياً'});

// Licensed source HLS via a first-party HTML5 video element. Non-HLS channels retain publisher-controlled embeds.
let hlsController=null,hlsToken=0;
function disposeHls(){
 hlsToken++;
 if(hlsController){try{hlsController.destroy()}catch{}hlsController=null}
 const v=$('nativePlayer');
 v.pause();v.onerror=null;v.onplaying=null;v.ontimeupdate=null;v.onwaiting=null;v.onstalled=null;
 v.removeAttribute('src');v.load();v.hidden=true;
}
function validHls(c){
 if(c?.sourceType!=='hls'||c?.embedPermission!==true||typeof c.hlsUrl!=='string')return false;
 try{const u=new URL(c.hlsUrl);return u.protocol==='https:'&&u.pathname.toLowerCase().endsWith('.m3u8')}catch{return false}
}
async function startHls(ch){
 const v=$('nativePlayer'),token=++hlsToken;
 v.hidden=false;$('idle').hidden=true;$('youtubeStage').hidden=true;v.muted=true;v.playsInline=true;v.preload='auto';
 let previous=null,progress=0;
 const active=()=>token===hlsToken&&selected?.id===ch.id;
 v.onerror=()=>{if(active()){mediaActive=false;notify('البث غير متاح الآن','error')}};
 v.onplaying=()=>{if(active()&&!mediaActive)notify('','neutral')};
 v.ontimeupdate=()=>{
   if(!active()||v.paused||v.readyState<2)return;
   if(previous!==null&&v.currentTime>previous+.2)progress++;
   previous=v.currentTime;
   if(progress>=2&&!mediaActive){mediaActive=true;notify('تشاهد الآن: '+ch.title,'playing')}
 };
 v.onwaiting=()=>{if(active()&&mediaActive)notify('','neutral')};
 v.onstalled=()=>{if(active()){mediaActive=false;progress=0;notify('','neutral')}};
 try{
  if(v.canPlayType('application/vnd.apple.mpegurl'))v.src=ch.hlsUrl;
  else{
   if(!window.Hls){
     const lib=document.createElement('script');
     lib.src='https://cdn.jsdelivr.net/npm/hls.js@1.6.12/dist/hls.min.js';
     await new Promise((resolve,reject)=>{lib.onload=resolve;lib.onerror=reject;document.head.append(lib)});
   }
   if(!active())return;
   if(!window.Hls?.isSupported())throw Error('HLS unavailable');
   hlsController=new Hls({enableWorker:true,capLevelToPlayerSize:true,capLevelOnFPSDrop:true,startLevel:-1,maxBufferLength:30});
   hlsController.on(Hls.Events.ERROR,(_event,data)=>{if(data.fatal&&active()){mediaActive=false;notify('البث غير متاح الآن','error')}});
   hlsController.attachMedia(v);hlsController.loadSource(ch.hlsUrl);
  }
  if(!active())return;
  await v.play().catch(()=>{if(active())notify('','neutral')});
 }catch{if(active())notify('البث غير متاح الآن','error')}
}


/* First-party advertising video playlist; refreshes automatically when ads.json changes. */
const adVideo=$('adVideo');
let ads=[],adIndex=0,adCurrent='',adStatus='idle';
function validAd(ad){
 if(!ad||typeof ad!=='object'||typeof ad.video!=='string'||typeof ad.title!=='string')return false;
 try{const u=new URL(ad.video,location.href);return u.origin===location.origin&&u.pathname.includes('/ofuq-tv/ads/')&&u.pathname.toLowerCase().endsWith('.mp4')}catch{return false}
}
function applyAdText(ad){
 $('adTitle').textContent=ad.title;
 $('adDescription').textContent=typeof ad.description==='string'?ad.description:'';
 $('adEyebrow').textContent=typeof ad.eyebrow==='string'?ad.eyebrow:'OFUQ TV · VIDEO ADVERTISING';
 $('adNumber').textContent=String(adIndex+1).padStart(2,'0')+' / '+String(ads.length).padStart(2,'0');
}
function showAd(index){
 if(!ads.length)return;
 adIndex=((index%ads.length)+ads.length)%ads.length;
 const ad=ads[adIndex];adCurrent=ad.video;adStatus='loading';
 applyAdText(ad);adVideo.classList.remove('is-playing');
 adVideo.pause();adVideo.muted=true;adVideo.setAttribute('playsinline','');adVideo.src=ad.video;adVideo.load();
 adVideo.play().catch(()=>{adStatus='waiting';}); // Silent autoplay is allowed on most modern browsers.
}
adVideo.addEventListener('playing',()=>{adStatus='playing';adVideo.classList.add('is-playing')});
adVideo.addEventListener('pause',()=>{if(!adVideo.ended)adVideo.classList.remove('is-playing')});
adVideo.addEventListener('ended',()=>showAd(adIndex+1));
adVideo.addEventListener('error',()=>{adStatus='unavailable';adVideo.classList.remove('is-playing');if(ads.length>1){const failed=adIndex;const next=(adIndex+1)%ads.length;if(next!==failed)showAd(next)}});
async function refreshAds(){
 try{
  const res=await fetch('ads.json?ts='+Math.floor(Date.now()/60000),{cache:'no-store'});
  if(!res.ok)throw Error('ads unavailable');
  const data=await res.json();const next=Array.isArray(data.ads)?data.ads.filter(validAd):[];
  if(!next.length)return;
  const current=next.findIndex(a=>a.video===adCurrent);
  ads=next;
  if(!adCurrent||adStatus==='unavailable')showAd(0);
  else {adIndex=Math.max(0,current);applyAdText(ads[adIndex])}
 }catch{if(!ads.length){ads=[{video:'ads/ofuq-promo.mp4',title:'إعلانك على شاشة أُفُق',description:'مساحة إعلانية بالفيديو تلفت الأنظار وتظهر لجمهورك.'}];showAd(0)}}
}
refreshAds();
setInterval(()=>{if(!document.hidden)refreshAds()},180000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&adVideo.paused&&!adVideo.ended&&adStatus!=='unavailable')adVideo.play().catch(()=>{})});
const heroClockFmt=new Intl.DateTimeFormat('ar-OM',{timeZone:'Asia/Muscat',hour:'2-digit',minute:'2-digit',hour12:false});
function updateHeroClock(){if($('upperClock'))$('upperClock').textContent=heroClockFmt.format(new Date())+' · مسقط'}
updateHeroClock();setInterval(updateHeroClock,60000);

let allNews=[],briefs={},group='all',search='',visibleNews=12;
const SECTION_NAMES={world:'العالم',region:'المنطقة',sudan:'السودان',sports:'رياضة',technology:'تكنولوجيا',arts:'فنون',variety:'منوعات',articles:'مقالات'};
function category(item){
 const title=typeof item==='string'?item:item?.title||'';
 if(/السودان|الفاشر|الأبيض|الخرطوم|دارفور/.test(title))return 'sudan';
 return typeof item==='object'&&SECTION_NAMES[item.section]?item.section:'world';
}
function newsId(item){return typeof item.id==='string'&&/^[a-z0-9]{5,20}$/i.test(item.id)?item.id:(String(item.url||'').match(/\/(\d{5,12})(?:[/?#]|$)/)||[])[1]||''}
function safeImage(url){try{const parsed=new URL(url);return parsed.protocol==='https:'&&Boolean(parsed.hostname)}catch{return false}}
function renderNews(){
 const host=$('newsGrid');host.replaceChildren();
 const selection=allNews.filter(n=>(group==='all'||category(n)===group)&&(!search||[n.title,n.source||'',n.excerpt||''].join(' ').toLocaleLowerCase().includes(search)));
 $('newsSummary').textContent=selection.length?'عدد المواد: '+selection.length+' · آخر تحديث من المصادر الرسمية':'';
 if(!selection.length){const p=document.createElement('p');p.className='empty-news';p.textContent='لا توجد أخبار لهذا القسم حالياً. اختر قسماً آخر.';host.append(p)}
 for(const n of selection.slice(0,visibleNews)){
  const id=newsId(n);if(!id)continue;
  const link=document.createElement('a');link.className='news-card';link.href='story.html?id='+encodeURIComponent(id);
  const photo=document.createElement('div');photo.className='news-photo';
  if(safeImage(n.image)){const img=document.createElement('img');img.src=n.image;img.alt='صورة الخبر من '+(n.source||'المصدر');img.loading='lazy';img.decoding='async';img.referrerPolicy='no-referrer';img.onerror=()=>{img.remove();photo.classList.add('no-photo')};photo.append(img)}
  else photo.classList.add('no-photo');
  const watermark=document.createElement('span');watermark.className='image-source';watermark.textContent=n.image?(n.source||'صورة المصدر'):'أُفُق TV';photo.append(watermark);
  const body=document.createElement('div');body.className='news-content';
  const label=document.createElement('span');label.className='tag';label.textContent=SECTION_NAMES[category(n)]||'العالم';
  const title=document.createElement('h3');title.textContent=n.title;
  const excerpt=document.createElement('p');excerpt.className='news-excerpt';excerpt.textContent=n.excerpt||'اطّلع على موجز الخبر ومصدره وتاريخ النشر.';
  const meta=document.createElement('div');meta.className='date';
  const source=document.createElement('span');source.textContent=n.source||'المصدر';
  const time=document.createElement('span');try{time.textContent=new Intl.DateTimeFormat('ar-OM',{timeZone:'Asia/Muscat',dateStyle:'medium'}).format(new Date(n.published_at))}catch{time.textContent=''}
  meta.append(source,time);body.append(label,title,excerpt,meta);link.append(photo,body);host.append(link);
 }
 $('moreNews').hidden=selection.length<=visibleNews;
}
async function refreshNews(){
 try{
  const [data,b]=await Promise.all([fetch('news.json?ts='+Math.floor(Date.now()/60000),{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('news');return r.json()}),fetch('news-briefs.json?ts='+Math.floor(Date.now()/300000),{cache:'no-store'}).then(r=>r.ok?r.json():{})]);
  const next=(Array.isArray(data.items)?data.items:[]).filter(n=>typeof n.title==='string'&&typeof n.url==='string');
  if(!next.length)throw Error('news empty');
  const changed=next.length!==allNews.length||next.some((n,i)=>n.url!==allNews[i]?.url);
  allNews=next;briefs=b||{};if(changed||!$('newsGrid').querySelector('.news-card'))renderNews();
 }catch{if(!allNews.length){$('newsGrid').replaceChildren();const p=document.createElement('p');p.className='empty-news';p.textContent='لا توجد أخبار متاحة حالياً.';$('newsGrid').append(p)}}
}
refreshNews();
setInterval(()=>{if(!document.hidden)refreshNews()},180000);
$('newsSearch').addEventListener('input',e=>{search=e.target.value.trim().toLocaleLowerCase();visibleNews=12;renderNews()});
document.querySelectorAll('[data-group]').forEach(b=>b.addEventListener('click',()=>{group=b.dataset.group;visibleNews=12;document.querySelectorAll('[data-group]').forEach(el=>el.classList.toggle('active',el===b));renderNews()}));
$('moreNews').addEventListener('click',()=>{visibleNews+=12;renderNews()});
const BREAKING_ALLOW_HOSTS=new Set(['news.un.org','www.news.un.org','www.ungeneva.org']);
let lastBreakingId='';
function verifyBreaking(item){
  if(!item||typeof item!=='object'||typeof item.headline!=='string'||item.headline.trim().length<8||item.headline.length>210)return false;
  if(item.signal!=='explicit_official_alert'&&item.signal!=='editor_approved')return false;
  let u;try{u=new URL(item.source_url)}catch{return false}
  if(u.protocol!=='https:'||!BREAKING_ALLOW_HOSTS.has(u.hostname))return false;
  const issued=Date.parse(item.published_at),expires=Date.parse(item.expires_at),now=Date.now();
  return Number.isFinite(issued)&&Number.isFinite(expires)&&issued<=now+60000&&expires>now&&expires-issued<=4*3600000&&now-issued<=4*3600000;
}
async function refreshBreaking(){
  try{
    const r=await fetch('breaking.json?refresh='+Math.floor(Date.now()/60000),{cache:'no-store'});
    if(!r.ok)throw Error('HTTP '+r.status);
    const d=await r.json(),items=Array.isArray(d.items)?d.items:[];
    const x=items.find(verifyBreaking),bar=$('breakingStrip');
    if(!x){bar.hidden=true;lastBreakingId='';return}
    const identity=x.source_url+':'+x.published_at;
    if(identity!==lastBreakingId){$('breakingText').textContent=x.headline.trim();lastBreakingId=identity}
    bar.hidden=false;
  }catch{
    $('breakingStrip').hidden=true;lastBreakingId='';
  }
}
refreshBreaking();
setInterval(()=>{if(!document.hidden)refreshBreaking()},60000);

})();

if('serviceWorker' in navigator&&location.protocol==='https:'){navigator.serviceWorker.getRegistrations().then(regs=>Promise.all(regs.filter(r=>new URL(r.scope).pathname.startsWith('/ofuq-tv/')).map(r=>r.unregister()))).catch(()=>{});if('caches'in window)caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('ofuq-')).map(k=>caches.delete(k)))).catch(()=>{});}
