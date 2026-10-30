import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const root=process.cwd(), dir=path.join(root,'ofuq-tv');
const portal=fs.readFileSync(path.join(dir,'portal.js'),'utf8');
const mainPage=fs.readFileSync(path.join(dir,'index.html'),'utf8');
if(portal.includes('عدد المواد:')||portal.includes('آخر تحديث من المصادر الرسمية')||mainPage.includes('id="newsSummary"'))throw Error('Removed news counter unexpectedly returned');
let errors=[], checks=0;
function check(test,msg){checks++;if(!test)errors.push(msg)}
function json(f){try{return JSON.parse(fs.readFileSync(path.join(dir,f),'utf8'))}catch(e){errors.push(f+': JSON invalid ('+e.message+')');return{}}}
const full=json('full-articles.json');
for(const [id, a] of Object.entries(full)){
 check(a?.approved===true&&a?.rights==='licensed'&&a?.license==='CC BY 3.0','Invalid article reuse permission '+id);
 check(a?.original_url?.startsWith('https://ar.globalvoices.org/'),'Invalid licensed article source '+id);
 check(typeof a?.author==='string'&&a.author.length>=3,'Missing licensed article author '+id);
 check(Array.isArray(a?.paragraphs)&&a.paragraphs.length>=5,'Incomplete imported article '+id);
 check(a?.word_count>=220,'RSS excerpt incorrectly classified as complete article '+id);
}
const sourceDirectory=json('news-sources.json');
check(Array.isArray(sourceDirectory.sources)&&sourceDirectory.sources.length>=20,'International RSS registry missing');
check(sourceDirectory.sources.some(x=>x.section==='sudan'&&x.enabled!==false),'Sudan dedicated news feed absent');
const breaking=json('breaking.json'),channels=json('channels.json'),news=json('news.json'),archive=json('news-archive.json'),briefs=json('news-briefs.json');
check(Array.isArray(channels.channels)&&channels.channels.length>=10,'Expected expanded native channel guide');
check(Array.isArray(breaking.items),'Missing breaking news array');
check(fs.readFileSync(path.join(dir,'index.html'),'utf8').includes('id="breakingStrip"'),'Missing visible breaking ticker container');
check(fs.readFileSync(path.join(dir,'portal.js'),'utf8').includes('verifyBreaking'),'No breaking news verification logic');
const ids=new Set();
for(const ch of channels.channels||[]){
  check(ch.sourceType==='hls'&&Array.isArray(ch.streams)&&ch.streams.length>0,'Missing direct HLS stream '+ch.id);
  for(const u of ch.streams||[]){let valid=false;try{const parsed=new URL(u);valid=parsed.protocol==='https:'&&parsed.pathname.endsWith('.m3u8')}catch{}check(valid,'Invalid stream '+ch.id)}
  check(!ids.has(ch.id),'Duplicate channel '+ch.id);
  ids.add(ch.id);
  check(typeof ch.publisher==='string'&&ch.publisher.length>1,'Missing source/publisher '+ch.id);
}
check(Array.isArray(news.items)&&news.items.length>0,'No news items');check(fs.readFileSync(path.join(dir,'index.html'),'utf8').includes('data-group="sports"'),'Missing sports news filter');check(fs.readFileSync(path.join(dir,'portal.js'),'utf8').includes('news-photo'),'Missing news image renderer');
const archiveSet=new Set((archive.items||[]).map(x=>x.url));
const storyIds=new Set((archive.items||[]).map(x=>String(x.id||(String(x.url||'').match(/\/(\d{5,12})(?:[/?#]|$)/)||[])[1]||'')));
for(const item of news.items||[]){
  check(archiveSet.has(item.url),'News URL not in archive: '+item.url);
  if(item.full_article===true)check(Boolean(full[item.id]),'Full article listed without licensed body: '+item.id);
  let sourceValid=false;
  try{
   const u=new URL(item.url);
   sourceValid=sourceDirectory.sources.some(x=>x.name===item.source&&x.enabled!==false&&(!x.requiresCommercialLicense||x.commercialLicenseApproved===true)&&u.protocol==='https:'&&(x.hosts||[]).some(host=>u.hostname===host||u.hostname.endsWith('.'+host)));
  }catch{}
  check(sourceValid,'Unsupported news source '+item.url);check(/^(?:[a-f0-9]{14}|[0-9]{5,12})$/.test(String(item.id||'')),'Invalid story ID '+item.url);
}
for(const id of Object.keys(briefs||{}))check(storyIds.has(id),'Brief without archived story: '+id);
const htmls=['index.html','story.html','editorial.html','privacy.html','player.html'];
for(const f of htmls){
  const full=path.join(dir,f);
  check(fs.existsSync(full),'Missing HTML '+f);
  if(!fs.existsSync(full))continue;
  const text=fs.readFileSync(full,'utf8'),matches=text.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/gi);
  for(const m of matches){
    const url=m[1];
    if(!url||/^(?:https?:|mailto:|data:|#|javascript:)/i.test(url))continue;
    const clean=url.split(/[?#]/)[0]||'index.html';
    const local=path.resolve(dir,clean);
    if(!local.startsWith(dir+path.sep)&&local!==dir){errors.push('Unsafe HTML path '+f+': '+url);continue}
    check(fs.existsSync(local),'Broken local link '+f+' -> '+url);
  }
}
for(const f of fs.readdirSync(dir).filter(x=>x.endsWith('.js'))){
  const r=spawnSync('node',['--check',path.join(dir,f)],{encoding:'utf8'});
  check(r.status===0,'JS syntax '+f+': '+(r.stderr||'').slice(0,500));
}
const reels=json('news-reels.json');
check(Array.isArray(reels.clips)&&reels.clips.length>=2,'Fewer than 2 decoded original news clips');
for(const clip of reels.clips||[]){
 let valid=false;
 try{const u=new URL(clip.video),source=new URL(clip.source);
 valid=u.protocol==='https:'&&u.hostname==='videos.pexels.com'&&u.pathname.endsWith('.mp4')&&source.hostname==='www.pexels.com'&&clip.type==='illustrative'&&Number(clip.seconds)>=4;
 }catch{}
 check(valid,'Invalid illustrative editorial footage or license metadata: '+clip.id);
}
const homepage=fs.readFileSync(path.join(dir,'index.html'),'utf8');
check(homepage.includes('id="adVideo"')&&homepage.includes('id="reelSound"')&&homepage.includes('id="reelHeadline"'),'Missing real-video news advert with audio button');
check(!homepage.includes('id="newsPromo"')&&!homepage.includes('id="adTitle"')&&!homepage.includes('id="heroLiveVideo"'),'Old fake news promo or live-TV replacement still present');
check(!homepage.includes('ad-network.js'),'No publisher advertising SDK should load inside editorial news break');
check(portal.includes('SpeechSynthesisUtterance')&&portal.includes('news-reels.json'),'Original Arabic spoken news script is not loaded');

check(homepage.includes('id="breakingStrip"'),'Breaking strip missing');
check(homepage.includes('id="channelCount"'),'Channel count element missing');check(homepage.includes('id="nativePlayer"'),'Native TV player absent');check(!homepage.includes('id="youtubeStage"'),'Old YouTube stage remains');check(!/youtube-nocookie[.]com\/embed|youtube[.]com\/iframe_api|new YT[.]Player/.test(fs.readFileSync(path.join(dir,'portal.js'),'utf8')),'YouTube still present in player code');
check(homepage.includes('id="newsGrid"'),'News grid missing');
check(fs.readFileSync(path.join(dir,'portal.js'),'utf8').includes('story.html?id='),'Dynamic story reader route missing');
check(!/\b3 قنوات\b/.test(homepage),'Hardcoded misleading channel count');
check(fs.readFileSync(path.join(dir,'story.js'),'utf8').includes('news-archive.json'),'Story archive fallback not used');
console.log('OFUQ QA: '+checks+' checks; '+errors.length+' failures.');
if(errors.length){for(const x of errors)console.error('FAIL '+x);process.exit(1)}
console.log('PASS static links, content references, JavaScript syntax and channel metadata.');
console.log('NOTE: This does NOT verify third-party LIVE video playback, regional access or ad approval.');
