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
const video=$('nativePlayer'),idle=$('idle');
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
 mediaActive=false;
}
function switchChannel(ch){
 if(!validChannel(ch))return;
 stopStream();selected=ch;currentSourceIndex=0;levelRecovery=0;
 $('playingChannel').textContent=ch.title;
 renderChannels();startSource(ch,streamToken);
}
function startSource(ch,token){
 if(streamToken!==token||selected?.id!==ch.id)return;
 clearTimers();disposeHls();mediaActive=false;
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
 if(video.canPlayType('application/vnd.apple.mpegurl')){
  video.src=source;startPlayback();return;
 }
 if(!window.Hls?.isSupported()){fallback();return}
 const controller=new Hls({enableWorker:true,startLevel:-1,capLevelToPlayerSize:true,capLevelOnFPSDrop:true,maxBufferLength:28,lowLatencyMode:true});
 hlsController=controller;
 controller.on(Hls.Events.ERROR,(_event,data)=>{
  if(!valid()||hlsController!==controller||!data.fatal)return;
  if(data.type===Hls.ErrorTypes.MEDIA_ERROR&&levelRecovery<1){levelRecovery++;controller.recoverMediaError()}
  else fallback();
 });
 controller.on(Hls.Events.MEDIA_ATTACHED,()=>{if(valid()&&hlsController===controller)controller.loadSource(source)});
 controller.on(Hls.Events.MANIFEST_PARSED,()=>{if(valid())startPlayback()});
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
let featuredIndex=0,featuredTimer=null;
function updateFeatured(){
  const title=$('idleTitle'),lead=$('idleDescription'),categoryEl=$('idleCategory'),counter=$('idleSlide'),link=$('upperRead');
  if(!title||!allNews.length)return;
  const items=allNews.filter(n=>typeof n.title==='string'&&n.title&&typeof n.url==='string').slice(0,12);
  if(!items.length)return;
  const article=items[featuredIndex%items.length];
  const id=String(article.url||'').split('/').pop().match(/^[0-9]{5,12}$/)?.[0];
  title.textContent=article.title;
  categoryEl.textContent=category(article.title)==='sudan'?'أخبار السودان':category(article.title)==='region'?'أخبار المنطقة':'أخبار العالم';
  lead.textContent=(id&&briefs[id]?.lead)||'اقرأ الخبر من داخل أُفُق، وتابع التحديثات الجديدة.';
  link.href=id?'story.html?id='+encodeURIComponent(id):'#news';
  counter.textContent=String(featuredIndex%items.length+1).padStart(2,'0')+' / '+String(items.length).padStart(2,'0');
  featuredIndex++;
}
function startFeatured(){if(featuredTimer)clearInterval(featuredTimer);updateFeatured();featuredTimer=setInterval(()=>{if(!document.hidden)updateFeatured()},8500)}
const heroClockFmt=new Intl.DateTimeFormat('ar-OM',{timeZone:'Asia/Muscat',hour:'2-digit',minute:'2-digit',hour12:false});
function updateHeroClock(){if($('upperClock'))$('upperClock').textContent=heroClockFmt.format(new Date())+' · مسقط'}
updateHeroClock();setInterval(updateHeroClock,60000);

let allNews=[], briefs={}, group='all',search='';
function category(title){if(/سودان|الفاشر|الأبيض/.test(title))return 'sudan';if(/اليمن|أفغانستان|الشرق الأوسط/.test(title))return 'region';return 'global'}
function renderNews(){
 const host=$('newsGrid');host.replaceChildren();
 const selection=allNews.filter(x=>(group==='all'||category(x.title)===group)&&(!search||[x.title,x.source||''].join(' ').toLocaleLowerCase().includes(search)));
 if(!selection.length){const p=document.createElement('p');p.className='empty-news';p.textContent='لا توجد أخبار تطابق البحث الحالي. جرّب كلمات أخرى أو اختر الكل.';host.append(p);return}
 for(const n of selection){
  const id=String(n.url||'').split('/').pop().match(/^[0-9]{5,12}$/)?.[0];if(!id)continue;
  const a=document.createElement('a');a.className='news-card';a.href='story.html?id='+encodeURIComponent(id);
  const source=document.createElement('span');source.className='tag';source.textContent=(n.source||'مصدر رسمي')+' · '+(category(n.title)==='sudan'?'السودان':category(n.title)==='region'?'المنطقة':'العالم');
  const title=document.createElement('h3');title.textContent=n.title;
  const meta=document.createElement('div');meta.className='date';
  const date=document.createElement('span');
  try{date.textContent=new Intl.DateTimeFormat('ar-OM',{timeZone:'Asia/Muscat',dateStyle:'medium'}).format(new Date(n.published_at))}catch{date.textContent='تاريخ النشر لدى المصدر'}
  const read=document.createElement('span');read.textContent='اقرأ داخل أُفُق';meta.append(date,read);
  const more=document.createElement('span');more.className='more';more.textContent='قراءة الخبر داخل الموقع';a.append(source,title,meta,more);host.append(a);
 }
}

Promise.all([fetch('news.json?ts='+Math.floor(Date.now()/60000),{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('news');return r.json()}),fetch('news-briefs.json?v=20261030-r3',{cache:'no-store'}).then(r=>r.ok?r.json():{})]).then(([data,b])=>{allNews=(data.items||[]).filter(n=>typeof n.title==='string'&&typeof n.url==='string');briefs=b||{};if(!allNews.length)throw Error('empty news');renderNews();startFeatured();}).catch(()=>{$('newsGrid').innerHTML='';const p=document.createElement('p');p.className='empty-news';p.textContent='لا توجد أخبار متاحة حالياً.';$('newsGrid').append(p)});
$('newsSearch').addEventListener('input',e=>{search=e.target.value.trim().toLocaleLowerCase();renderNews()});document.querySelectorAll('[data-group]').forEach(b=>b.addEventListener('click',()=>{group=b.dataset.group;document.querySelectorAll('[data-group]').forEach(el=>el.classList.toggle('active',el===b));renderNews()}));
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
