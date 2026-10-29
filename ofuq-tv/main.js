(()=>{'use strict';
const conf=window.OFUQ_CONFIG||{}; const $=id=>document.getElementById(id);
const stories=Array.isArray(conf.stories)?conf.stories:[]; const programs=Array.isArray(conf.programs)?conf.programs:[];
const ticker=Array.isArray(conf.ticker)?conf.ticker:[];
function muscat(){return new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Muscat',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date())}
function clock(){let t=muscat();$('ribbonClock').textContent=t+' بتوقيت مسقط';$('nowClock').textContent=t;}
clock();setInterval(clock,30000);$('footerYear').textContent=String(new Date().getFullYear());
$('menuButton').addEventListener('click',()=>{const nav=$('mobileNav');nav.hidden=!nav.hidden;$('menuButton').setAttribute('aria-expanded',String(!nav.hidden))});document.querySelectorAll('#mobileNav a').forEach(a=>a.addEventListener('click',()=>{$('mobileNav').hidden=true;$('menuButton').setAttribute('aria-expanded','false')}));
function schedule(){const list=$('guideList');programs.forEach(p=>{const row=document.createElement('article');row.className='guide-row';const t=document.createElement('span');t.className='guide-time';t.textContent=p.time||'';const c=document.createElement('div');c.className='guide-content';const n=document.createElement('strong');n.textContent=p.name||'';const d=document.createElement('span');d.textContent=p.detail||'';c.append(n,d);const cat=document.createElement('span');cat.className='guide-category';cat.textContent=p.category||'';row.append(t,c,cat);list.append(row);});} schedule();
let tk=0;function drawTicker(){if(!ticker.length)return;$('pageTicker').textContent=ticker[tk++%ticker.length]};drawTicker();setInterval(drawTicker,7000);
let start=Date.now();const total=stories.reduce((n,s)=>n+Math.max(10,Number(s.duration)||24),0)||1;
function scenes(){if(document.getElementById('watchVideo'))return;if(!stories.length)return;let elapsed=(Date.now()-start)/1000%total;let idx=0;for(let i=0;i<stories.length;i++){const sec=Math.max(10,Number(stories[i].duration)||24);if(elapsed<sec){idx=i;break;}elapsed-=sec;}let s=stories[idx];$('nowShow').textContent=s.title||'';$('nowSummary').textContent=s.subtitle||'';$('nextShow').textContent=stories[(idx+1)%stories.length].title||'';$('sceneCounter').textContent=String(idx+1).padStart(2,'0')+' / '+String(stories.length).padStart(2,'0');$('sceneProgress').style.width=Math.min(100,elapsed/Math.max(10,Number(s.duration)||24)*100)+'%';} scenes();setInterval(scenes,900);
const id=String(conf.youtubeVideoId||'').trim();if(/^[A-Za-z0-9_-]{11}$/.test(id)){
 const iframe=document.createElement('iframe');iframe.src='https://www.youtube-nocookie.com/embed/'+encodeURIComponent(id)+'?rel=0';iframe.title='مشغل بث القناة عبر يوتيوب';iframe.allow='accelerometer; encrypted-media; gyroscope; picture-in-picture; web-share; autoplay; fullscreen';iframe.referrerPolicy='strict-origin-when-cross-origin';iframe.allowFullscreen=true;const p=$('videoSurface');p.replaceChildren(iframe);
 $('siteMode').textContent='يوتيوب مربوط — يرجى التحقق من حالة البث';$('playerBadge').textContent='مشغل يوتيوب';$('playerCaption').textContent='البث عبر منصة يوتيوب';$('sideLiveStatus').textContent='المشغل مربوط';$('sideLiveStatus').className='green';$('playerDisclosure').textContent='تم ربط مشغل يوتيوب. وجود فيديو مُضمَّن لا يعني أن البث حي الآن؛ تحقق من حالة البث في YouTube Studio.';$('youtubeLink').href='https://www.youtube.com/watch?v='+id;$('youtubeLink').hidden=false;
}

else {
 const movie=document.createElement('video'); movie.id='watchVideo';movie.src='media/ofuq-episode-01-verify-the-news.mp4'; movie.poster='assets/episode-01-poster.png';movie.controls=true;movie.playsInline=true;movie.preload='metadata';movie.setAttribute('aria-label','الحلقة الأولى المسجّلة: قبل أن تشارك خبراً');movie.style.cssText='height:100%;width:100%;object-fit:contain;background:#080d16';
 $('videoSurface').replaceChildren(movie);
 $('siteMode').textContent='الحلقة الأولى متاحة — البث المباشر لم يبدأ';
 $('playerBadge').textContent='حلقة مسجّلة';$('playerCaption').textContent='قبل أن تشارك خبراً | الحلقة 01';
 $('sideLiveStatus').textContent='حلقات مسجّلة';
 $('playerDisclosure').textContent='حلقة توعوية مسجّلة بإنتاج أصلي، موسيقى دون تعليق صوتي. ليست نشرة أخبار مباشرة. اضغط تشغيل للمشاهدة.';
 $('nowShow').textContent='قبل أن تشارك خبراً';$('nowSummary').textContent='خمس خطوات للتحقق من المعلومات قبل مشاركتها';$('nextShow').textContent='هوية أفق TV';$('sceneCounter').textContent='01 / 01';
 movie.addEventListener('timeupdate',()=>{if(movie.duration)$('sceneProgress').style.width=(movie.currentTime/movie.duration*100)+'%'});
}
$('fullScreenButton').addEventListener('click',async()=>{const t=$('playerShell');try{if(document.fullscreenElement)await document.exitFullscreen();else if(t.requestFullscreen)await t.requestFullscreen();}catch(e){}});
if('serviceWorker'in navigator&&location.protocol==='https:'){navigator.serviceWorker.register('sw.js').catch(()=>{})}
})();
