import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const root=process.cwd(), dir=path.join(root,'ofuq-tv');
let errors=[], checks=0;
function check(test,msg){checks++;if(!test)errors.push(msg)}
function json(f){try{return JSON.parse(fs.readFileSync(path.join(dir,f),'utf8'))}catch(e){errors.push(f+': JSON invalid ('+e.message+')');return{}}}
const channels=json('channels.json'),news=json('news.json'),archive=json('news-archive.json'),briefs=json('news-briefs.json');
check(Array.isArray(channels.channels)&&channels.channels.length>0,'No channels configured');
const ids=new Set();
for(const ch of channels.channels||[]){
  check(/^[A-Za-z0-9_-]{11}$/.test(ch.videoId||''),'Invalid YouTube ID '+ch.id);
  check(!ids.has(ch.id),'Duplicate channel '+ch.id);
  ids.add(ch.id);
  check(typeof ch.publisher==='string'&&ch.publisher.length>1,'Missing source/publisher '+ch.id);
}
check(Array.isArray(news.items)&&news.items.length>0,'No news items');
const archiveSet=new Set((archive.items||[]).map(x=>x.url));
const storyIds=new Set((archive.items||[]).map(x=>(String(x.url||'').match(/\/(\d{5,12})(?:[/?#]|$)/)||[])[1]));
for(const item of news.items||[]){
  check(archiveSet.has(item.url),'News URL not in archive: '+item.url);
  check(/^https:\/\/news\.un\.org\/ar\/story\/\d{4}\/\d{2}\/\d{5,12}$/.test(item.url),'Noncanonical article URL '+item.url);
}
for(const id of Object.keys(briefs||{}))check(storyIds.has(id),'Brief without archived story: '+id);
const htmls=['index.html','story.html','editorial.html','privacy.html','embed-qa.html','player.html'];
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
const homepage=fs.readFileSync(path.join(dir,'index.html'),'utf8');
check(homepage.includes('id="channelCount"'),'Channel count element missing');
check(homepage.includes('id="newsGrid"'),'News grid missing');
check(homepage.includes('story.html'),'Dynamic story reader route missing');
check(!/\b3 قنوات\b/.test(homepage),'Hardcoded misleading channel count');
check(fs.readFileSync(path.join(dir,'story.js'),'utf8').includes('news-archive.json'),'Story archive fallback not used');
console.log('OFUQ QA: '+checks+' checks; '+errors.length+' failures.');
if(errors.length){for(const x of errors)console.error('FAIL '+x);process.exit(1)}
console.log('PASS static links, content references, JavaScript syntax and channel metadata.');
console.log('NOTE: This does NOT verify third-party LIVE video playback, regional access or ad approval.');
