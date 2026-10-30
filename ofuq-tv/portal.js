(()=>{'use strict';
const $=id=>document.getElementById(id);
const notify=(message,kind='neutral')=>{ const status=$('playState');if(status)status.textContent=kind==='playing'?message:kind==='error'?'البث غير متاح الآن':'';const light=$('signalLight');if(light)light.className='signal'+(kind==='playing'?' playing':kind==='error'?' error':'') };
const clockFmt=new Intl.DateTimeFormat('ar-OM',{timeZone:'Asia/Muscat',hour:'2-digit',minute:'2-digit',hour12:false});
function clock(){$('clock').textContent=clockFmt.format(new Date())+' · مسقط'}clock();setInterval(clock,60000);
$('year').textContent=String(new Date().getFullYear());
$('menuButton').addEventListener('click',()=>{const nav=$('navigation');const open=nav.classList.toggle('open');$('menuButton').setAttribute('aria-expanded',String(open))});
document.querySelectorAll('#navigation a').forEach(a=>a.addEventListener('click',()=>{$('navigation').classList.remove('open');$('menuButton').setAttribute('aria-expanded','false')}));
/* Independent OFUQ HTML5/HLS player: no YouTube API, iframe or restream proxy. */
let channelSearch='',channels=[],selected=null,hlsController=null,streamToken=0,mediaActive=false;
let startupTimer=null,stallTimer=null,levelRecovery=0,currentSourceIndex=0;
const video=$('nativePlayer'),idle=$('idle'),qualitySelect=$('qualitySelect'),qualityStatus=$('qualityStatus');
function startingBandwidth(){
 // Prefer a clear opening picture on modern fast connections, but preserve data-saver
 // and slow-connection behavior. ABR still reacts to measured segment throughput.
 const conn=navigator.connection||navigator.mozConnection||navigator.webkitConnection;
 const downlink=Number(conn?.downlink);
 if(conn?.saveData)return Number.isFinite(downlink)&&downlink>0?Math.max(400_000,Math.min(1_200_000,downlink*800_000)):800_000;
 if(conn?.effectiveType==='slow-2g'||conn?.effectiveType==='2g')return 450_000;
 if(conn?.effectiveType==='3g')return Math.max(800_000,Math.min(2_200_000,Number.isFinite(downlink)&&downlink>0?downlink*800_000:1_500_000));
 if(Number.isFinite(downlink)&&downlink>0){
  const hinted=downlink*900_000;
  // A 4G estimate can be very conservative before first video fragments.
  return Math.max(conn?.effectiveType==='4g'||conn?.type==='wifi'?3_800_000:1_200_000,Math.min(14_000_000,hinted));
 }
 return 6_000_000;
}
function resetQuality(){
 qualitySelect.replaceChildren();
 const auto=document.createElement('option');auto.value='auto';auto.textContent='تلقائي (أنسب جودة)';qualitySelect.append(auto);
 qualitySelect.value='auto';qualitySelect.disabled=true;qualityStatus.textContent='';
}
function updateQualityLabel(){
 if(video.videoHeight>0)qualityStatus.textContent=video.videoHeight+'p';
 else if(hlsController?.currentLevel>=0)qualityStatus.textContent=(hlsController.levels?.[hlsController.currentLevel]?.height||'')+'p';
 else qualityStatus.textContent='';
}
function buildQualityMenu(controller,levels){
 resetQuality();
 if(!Array.isArray(levels)||!levels.length)return;
 const byHeight=new Map();
 levels.forEach((level,index)=>{
  const h=Number(level.height),b=Number(level.bitrate||0);
  if(h>0&&(!byHeight.has(h)||b>Number(levels[byHeight.get(h)].bitrate||0)))byHeight.set(h,index);
 });
 for(const [height,index] of [...byHeight].sort((a,b)=>b[0]-a[0])){
  const option=document.createElement('option');option.value=String(index);option.textContent=height+'p';qualitySelect.append(option);
 }
 qualitySelect.disabled=byHeight.size<2;
 if(byHeight.size===1)qualityStatus.textContent=[...byHeight.keys()][0]+'p (المصدر)';
}
qualitySelect.addEventListener('change',()=>{
 const controller=hlsController;
 if(!controller||!controller.levels?.length){qualitySelect.value='auto';return}
 if(qualitySelect.value==='auto')controller.loadLevel=-1;
 else{
  const index=Number(qualitySelect.value);
  if(!Number.isInteger(index)||index<0||index>=controller.levels.length){qualitySelect.value='auto';controller.loadLevel=-1;return}
  // Smooth subsequent segment loading at user-selected resolution; no buffer flush.
  controller.loadLevel=index;
 }
});
video.addEventListener('resize',updateQualityLabel);
window.ofuqQualityInfo=()=>({
 engine:hlsController?'hls.js':video.currentSrc?'browser-native':'none',
 decodedHeight:video.videoHeight,decodedWidth:video.videoWidth,
 levels:hlsController?.levels?.map(x=>({height:x.height,bitrate:x.bitrate}))||[],
 auto:hlsController?.autoLevelEnabled??null,estimate:hlsController?.config?.abrEwmaDefaultEstimate??null,
 testBandwidth:hlsController?.config?.testBandwidth??null,
 selectedQuality:qualitySelect.value
});
resetQuality();
const clearTimers=()=>{if(startupTimer)clearTimeout(startupTimer);if(stallTimer)clearTimeout(stallTimer);startupTimer=stallTimer=null};
function validChannel(ch){return !!ch&&typeof ch.id==='string'&&typeof ch.title==='string'&&Array.isArray(ch.streams)&&ch.streams.length>0&&ch.streams.every(u=>{try{const v=new URL(u);return v.protocol==='https:'&&v.pathname.toLowerCase().endsWith('.m3u8')}catch{return false}})}
function renderChannels(){
 const container=$('channelList');container.replaceChildren();
 $('channelCount').textContent=channels.length+' قناة';
 for(const ch of channels.filter(x=>(x.title+' '+(x.category||'')).toLocaleLowerCase().includes(channelSearch))){
  const b=document.createElement('button');b.type='button';b.className='channel'+(selected?.id===ch.id?' active':'');b.setAttribute('aria-pressed',String(selected?.id===ch.id));
  const icon=document.createElement('span');icon.className='initial';icon.textContent=ch.initial||'TV';
  const label=document.createElement('span');const name=document.createElement('b');name.textContent=ch.title;
  const detail=document.createElement('small');detail.textContent=ch.category||'قناة إخبارية';
  label.append(name,detail);b.append(icon,label);b.addEventListener('click',()=>switchChannel(ch));container.append(b);
 }
}
function disposeHls(){if(hlsController){try{hlsController.destroy()}catch{}hlsController=null}}
function stopStream(){
 ++streamToken;clearTimers();disposeHls();
 video.onplaying=video.onerror=video.onwaiting=video.onstalled=video.ontimeupdate=null;
 video.pause();video.removeAttribute('src');video.load();video.hidden=true;
 mediaActive=false;resetQuality();
}
function switchChannel(ch){
 if(!validChannel(ch))return;
 stopStream();selected=ch;currentSourceIndex=0;levelRecovery=0;
 $('playingChannel').textContent=ch.title;
 renderChannels();startSource(ch,streamToken);
}
function startSource(ch,token){
 if(streamToken!==token||selected?.id!==ch.id)return;
 clearTimers();disposeHls();mediaActive=false;resetQuality();
 video.pause();video.removeAttribute('src');video.load();
 const source=ch.streams[currentSourceIndex];
 if(!source){video.hidden=true;idle.hidden=false;notify('البث غير متاح الآن','error');return}
 video.hidden=false;idle.hidden=true;video.muted=true;video.playsInline=true;
 let lastTime=0,progress=0;
 const valid=()=>streamToken===token&&selected?.id===ch.id;
 const fallback=()=>{
  if(!valid())return;
  if(currentSourceIndex+1<ch.streams.length){currentSourceIndex++;levelRecovery=0;startSource(ch,token)}
  else{clearTimers();disposeHls();video.pause();video.hidden=true;idle.hidden=false;notify('البث غير متاح الآن','error')}
 };
 const scheduleStall=()=>{if(stallTimer)clearTimeout(stallTimer);stallTimer=setTimeout(()=>{if(valid()&&!video.paused)fallback()},22000)};
 video.onerror=()=>{if(valid())fallback()};
 video.onplaying=()=>{if(!valid())return;clearTimeout(startupTimer);startupTimer=null;scheduleStall()};
 video.ontimeupdate=()=>{
  if(!valid()||video.paused||video.readyState<2)return;
  if(video.currentTime>lastTime+.35){progress++;lastTime=video.currentTime;scheduleStall()}
  if(progress>=2&&!mediaActive){mediaActive=true;notify('مباشر','playing')}
 };
 video.onwaiting=()=>{if(valid()&&!video.paused)scheduleStall()};
 video.onstalled=()=>{if(valid()&&!video.paused)scheduleStall()};
 startupTimer=setTimeout(()=>{if(valid()&&!mediaActive)fallback()},24000);
 const startPlayback=()=>video.play().catch(()=>{if(valid()){clearTimeout(startupTimer);startupTimer=null;notify('', 'neutral')}}); // Browsers may require tapping Play.
 const nativeSupported=Boolean(video.canPlayType('application/vnd.apple.mpegurl'));
 const preferNative=/iPad|iPhone|iPod/.test(navigator.userAgent)||(/Safari/.test(navigator.userAgent)&&!/Chrome|Chromium|CriOS|Edg|OPR/.test(navigator.userAgent));
 const useHlsJs=Boolean(window.Hls?.isSupported())&&(!preferNative||!nativeSupported);
 if(!useHlsJs){
  if(nativeSupported){video.src=source;startPlayback();return}
  fallback();return;
 }
 let triedNativeFallback=false;
 const tryNative=()=>{
  if(!valid()||!nativeSupported||triedNativeFallback)return false;
  triedNativeFallback=true;disposeHls();resetQuality();
  video.pause();video.removeAttribute('src');video.load();
  video.src=source;startPlayback();return true;
 }
 const controller=new Hls({enableWorker:true,startLevel:-1,testBandwidth:false,abrEwmaDefaultEstimate:startingBandwidth(),abrBandWidthFactor:0.85,abrBandWidthUpFactor:0.75,capLevelToPlayerSize:false,capLevelOnFPSDrop:true,maxBufferLength:28,backBufferLength:30,lowLatencyMode:true});
 hlsController=controller;
 controller.on(Hls.Events.ERROR,(_event,data)=>{
  if(!valid()||hlsController!==controller||!data.fatal)return;
  if(data.type===Hls.ErrorTypes.MEDIA_ERROR&&levelRecovery<1){levelRecovery++;controller.recoverMediaError()}
  else if(!tryNative())fallback();
 });
 controller.on(Hls.Events.MEDIA_ATTACHED,()=>{if(valid()&&hlsController===controller)controller.loadSource(source)});
 controller.on(Hls.Events.MANIFEST_PARSED,(_event,data)=>{if(valid()){buildQualityMenu(controller,data.levels);startPlayback()}});
 controller.on(Hls.Events.LEVEL_SWITCHED,()=>{if(valid())updateQualityLabel()});
 controller.attachMedia(video);
}
$('channelSearch').addEventListener('input',e=>{channelSearch=e.target.value.trim().toLocaleLowerCase();renderChannels()});
$('full').addEventListener('click',()=>{const target=document.querySelector('.channel-player');if(document.fullscreenElement)document.exitFullscreen?.().catch(()=>{});else target.requestFullscreen?.().catch(()=>{})});
async function refreshChannels(){
 try{
  const r=await fetch('channels.json?ts='+Math.floor(Date.now()/60000),{cache:'no-store'});if(!r.ok)throw Error('Channel load');
  const d=await r.json();const newChannels=(Array.isArray(d.channels)?d.channels:[]).filter(validChannel);
  if(!newChannels.length)throw Error('Empty channel guide');
  channels=newChannels;
  if(!selected)switchChannel(channels[0]);
  else {const updated=channels.find(c=>c.id===selected.id);if(!updated)switchChannel(channels[0]);else {selected=updated;renderChannels()}}
 }catch{if(!channels.length){$('channelList').textContent='القنوات غير متاحة حالياً';$('channelCount').textContent=''}}
}
refreshChannels();
setInterval(()=>{if(!document.hidden)refreshChannels()},300000);
window.addEventListener('pagehide',()=>{stopStream()});
/* First-party advertising video playlist; refreshes automatically when ads.json changes. */
const adVideo=$('adVideo'),adSound=$('adSound');
let soundEnabled=false;
adSound.addEventListener('click',()=>{
 soundEnabled=!soundEnabled;
 adVideo.muted=!soundEnabled;
 adSound.setAttribute('aria-pressed',String(soundEnabled));
 adSound.textContent=soundEnabled?'🔊 كتم الصوت':'🔇 تشغيل الصوت';
 if(!soundEnabled&&'speechSynthesis' in window)window.speechSynthesis.cancel();
 if(soundEnabled&&adVideo.paused)adVideo.play().catch(()=>{});
 if(soundEnabled&&!promoPanel.hidden)speakHeadline();
});
let ads=[],adIndex=0,adCurrent='',adStatus='idle';
function validAd(ad){
 if(!ad||typeof ad!=='object'||typeof ad.video!=='string'||typeof ad.title!=='string')return false;
 try{const u=new URL(ad.video,location.href);const base=new URL('ads/',location.href);return u.origin===location.origin&&u.pathname.startsWith(base.pathname)&&u.pathname.toLowerCase().endsWith('.mp4')}catch{return false}
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
 adVideo.pause();adVideo.muted=!soundEnabled;adVideo.setAttribute('playsinline','');adVideo.src=ad.video;adVideo.load();
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

/* OFUQ broadcast-style country news interludes: real headlines, NOT paid advertisements.
   Runs over the looping first-party video, never changes native channel streams.
   Any paid VAST ad stays on top and takes precedence over this editorial overlay. */
const promoScreen=$('adScreen'),promoPanel=$('newsPromo');
const promoCountry=$('newsPromoCountry'),promoFlag=$('newsPromoFlag');
const promoTitle=$('newsPromoTitle'),promoExcerpt=$('newsPromoExcerpt');
const promoSource=$('newsPromoSource'),promoStep=$('newsPromoStep');
const countryTopics=[
 {label:'السودان',flag:'🇸🇩',match:/السودان|سوداني|دارفور|الخرطوم|الفاشر|كردفان|أم درمان|أمدرمان|بورتسودان|نيالا|القضارف|عطبرة/},
 {label:'فلسطين',flag:'🇵🇸',match:/فلسطين|فلسطيني|غزة|الضفة الغربية|القدس/},
 {label:'مصر',flag:'🇪🇬',match:/مصر|المصري|القاهرة|الإسكندرية|أسيوط/},
 {label:'سوريا',flag:'🇸🇾',match:/سوريا|سورية|دمشق|حلب|درعا/},
 {label:'اليمن',flag:'🇾🇪',match:/اليمن|صنعاء|تعز|الحديدة|عدن/},
 {label:'لبنان',flag:'🇱🇧',match:/لبنان|بيروت|طرابلس اللبنانية/},
 {label:'السعودية',flag:'🇸🇦',match:/السعودية|الرياض|جدة|مكة|المدينة المنورة/},
 {label:'الولايات المتحدة',flag:'🇺🇸',match:/الولايات المتحدة|أمريكا|الأمريكي|واشنطن|نيويورك|ترامب/},
 {label:'أوكرانيا',flag:'🇺🇦',match:/أوكرانيا|الأوكراني|كييف/},
 {label:'روسيا',flag:'🇷🇺',match:/روسيا|الروسي|موسكو|الكرملين/},
 {label:'الصين',flag:'🇨🇳',match:/الصين|الصيني|بكين/},
 {label:'فرنسا',flag:'🇫🇷',match:/فرنسا|باريس|الفرنسي/},
 {label:'تركيا',flag:'🇹🇷',match:/تركيا|أنقرة|إسطنبول|التركي/},
 {label:'ألمانيا',flag:'🇩🇪',match:/ألمانيا|برلين|الألماني/}
];
let promoStories=[],promoPointer=0,promoPhase='commercial',promoDeadline=0,promoStart=0;
const COMMERCIAL_DURATION=16000,NEWS_DURATION=7800,NEWS_PER_BREAK=4;
let promoShown=0;
function validPromoStory(story){
 return story&&typeof story.title==='string'&&story.title.trim().length>18&&
 typeof story.source==='string'&&story.source.trim()&&
 typeof story.published_at==='string'&&Number.isFinite(Date.parse(story.published_at));
}
function selectPromos(stories){
 const matches=(Array.isArray(stories)?stories:[]).filter(validPromoStory);
 const selected=[],seenIds=new Set();
 // One verified story per named country, prioritizing Sudan and diverse countries.
 for(const topic of countryTopics){
  const story=matches.find(item=>!seenIds.has(item.url||item.id)&&topic.match.test(item.title));
  if(story){selected.push({...story,country:topic.label,flag:topic.flag});seenIds.add(story.url||story.id)}
 }
 // Always retain a general global-news story, without claiming a specific country.
 for(const item of matches){
  if(selected.length>=8)break;
  if(seenIds.has(item.url||item.id))continue;
  selected.push({...item,country:'حول العالم',flag:'🌍'});seenIds.add(item.url||item.id);
 }
 return selected;
}
function updatePromoSources(news){
 const next=selectPromos(news);
 if(next.length){
  promoStories=next;
  if(promoPointer>=next.length)promoPointer=0;
  if(!promoDeadline)promoDeadline=Date.now()+COMMERCIAL_DURATION;
 }
}
function speakHeadline(){
 if(!soundEnabled||!('speechSynthesis' in window)||!('SpeechSynthesisUtterance' in window)||document.hidden)return;
 try{
  window.speechSynthesis.cancel();
  const utterance=new SpeechSynthesisUtterance([promoCountry.textContent,promoTitle.textContent].filter(Boolean).join('، '));
  utterance.lang='ar-SA';utterance.rate=0.94;utterance.pitch=0.95;utterance.volume=1;
  const voice=window.speechSynthesis.getVoices().find(v=>/^ar(?:-|_)/i.test(v.lang));if(voice)utterance.voice=voice;
  window.speechSynthesis.speak(utterance);
 }catch{}
}
function stopPromo(){
 if('speechSynthesis' in window)window.speechSynthesis.cancel();
 promoPanel.hidden=true;
 promoScreen.classList.remove('has-news-promo');
 promoPhase='commercial';promoShown=0;
 $('adFooterLabel').textContent='OFUQ TV · ADVERTISING';
}
function broadcastStory(){
 if(!promoStories.length)return stopPromo();
 const item=promoStories[promoPointer%promoStories.length];
 promoPointer=(promoPointer+1)%promoStories.length;
 promoCountry.textContent=item.country;
 promoFlag.textContent=item.flag;
 promoTitle.textContent=item.title;
 promoExcerpt.textContent=String(item.excerpt||'').trim().slice(0,165);
 promoExcerpt.hidden=!promoExcerpt.textContent;
 promoSource.textContent='المصدر: '+item.source;
 promoStep.textContent=String(promoShown+1).padStart(2,'0')+' / '+String(NEWS_PER_BREAK).padStart(2,'0');
 $('adFooterLabel').textContent='OFUQ TV · NEWS BREAK';
 promoScreen.classList.add('has-news-promo');
 promoPanel.hidden=false;
 promoPanel.classList.remove('promo-enter');
 void promoPanel.offsetWidth;
 promoPanel.classList.add('promo-enter');
 promoPhase='news';promoShown++;
 speakHeadline();
}
function tickPromo(){
 if(!promoDeadline||!promoStories.length||document.hidden)return;
 if(!$('networkAdOverlay').hidden){
  if(!promoPanel.hidden)stopPromo();
  promoDeadline=Date.now()+COMMERCIAL_DURATION;
  return;
 }
 if(Date.now()<promoDeadline)return;
 if(promoPhase==='commercial'){
  promoShown=0;broadcastStory();promoDeadline=Date.now()+NEWS_DURATION;
 }else if(promoShown<NEWS_PER_BREAK){
  broadcastStory();promoDeadline=Date.now()+NEWS_DURATION;
 }else{
  stopPromo();promoDeadline=Date.now()+COMMERCIAL_DURATION;
 }
}
setInterval(tickPromo,450);
document.addEventListener('visibilitychange',()=>{
 if(!document.hidden)promoDeadline=Date.now()+(promoPhase==='news'?NEWS_DURATION:COMMERCIAL_DURATION);
});
window.ofuqBroadcastInfo=()=>({
 phase:promoPhase,active:!promoPanel.hidden,country:promoCountry.textContent,
 count:promoStories.length,step:promoShown,headlines:promoStories.map(x=>x.title)
});

let allNews=[],briefs={},group='all',search='',visibleNews=24;
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
 const matching=allNews.filter(n=>(group==='all'||(group==='full'&&n.full_article===true)||category(n)===group)&&(!search||[n.title,n.source||'',n.excerpt||''].join(' ').toLocaleLowerCase().includes(search)));
// In the default newsroom, surface genuine authorized full-length reporting among
// the newest headlines. Keep newest news first and avoid duplicate cards.
const featured=group==='all'&&!search?matching.filter(n=>n.full_article===true).slice(0,6):[];
const featuredIds=new Set(featured.map(n=>n.id));
const remaining=matching.filter(n=>!featuredIds.has(n.id));
const selection=featured.length?[...remaining.slice(0,6),...featured,...remaining.slice(6)]:matching;

 if(!selection.length){const p=document.createElement('p');p.className='empty-news';p.textContent='لا توجد أخبار لهذا القسم حالياً. اختر قسماً آخر.';host.append(p)}
 for(const n of selection.slice(0,visibleNews)){
  const id=newsId(n);if(!id)continue;
  const link=document.createElement('a');link.className='news-card';link.href='story.html?id='+encodeURIComponent(id);
  const photo=document.createElement('div');photo.className='news-photo';
  window.OFUQVisual.media(photo,n);
  const watermark=document.createElement('span');watermark.className='image-source';watermark.textContent=photo.classList.contains('illustrated')?'رسم توضيحي':(n.source||'صورة المصدر');photo.append(watermark);
  const body=document.createElement('div');body.className='news-content';
  const label=document.createElement('span');label.className='tag';label.textContent=SECTION_NAMES[category(n)]||'العالم';
  if(n.full_article===true){const fullTag=document.createElement('span');fullTag.className='full-news-tag';fullTag.textContent='مقال كامل';body.append(fullTag)}
  const title=document.createElement('h3');title.textContent=n.title;
  const excerpt=document.createElement('p');excerpt.className='news-excerpt';excerpt.textContent=n.excerpt||'اطّلع على موجز الخبر ومصدره وتاريخ النشر.';
  const meta=document.createElement('div');meta.className='date';
  const time=document.createElement('span');try{time.textContent=new Intl.DateTimeFormat('ar-OM',{timeZone:'Asia/Muscat',dateStyle:'medium'}).format(new Date(n.published_at))}catch{time.textContent=''}
  meta.append(time);body.append(label,title,excerpt,meta);link.append(photo,body);host.append(link);
 }
 $('moreNews').hidden=selection.length<=visibleNews;
}
async function refreshNews(){
 try{
  const [data,b]=await Promise.all([fetch('news.json?ts='+Math.floor(Date.now()/60000),{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('news');return r.json()}),fetch('news-briefs.json?ts='+Math.floor(Date.now()/300000),{cache:'no-store'}).then(r=>r.ok?r.json():{})]);
  const next=(Array.isArray(data.items)?data.items:[]).filter(n=>typeof n.title==='string'&&typeof n.url==='string');
  if(!next.length)throw Error('news empty');
  const changed=next.length!==allNews.length||next.some((n,i)=>n.url!==allNews[i]?.url);
  allNews=next;briefs=b||{};updatePromoSources(next);if(changed||!$('newsGrid').querySelector('.news-card'))renderNews();
 }catch{if(!allNews.length){$('newsGrid').replaceChildren();const p=document.createElement('p');p.className='empty-news';p.textContent='لا توجد أخبار متاحة حالياً.';$('newsGrid').append(p)}}
}
refreshNews();
setInterval(()=>{if(!document.hidden)refreshNews()},60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshNews()});
$('newsSearch').addEventListener('input',e=>{search=e.target.value.trim().toLocaleLowerCase();visibleNews=24;renderNews()});
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
