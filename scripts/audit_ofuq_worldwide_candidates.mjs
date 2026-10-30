/* OFUQ read-only global news channel inventory.
 * Discover candidate HLS streams but NEVER publish, embed, proxy or automatically
 * promote them to channels.json. Playlist listing and HTTP 200 do NOT prove
 * right to embed or browser playback. Actual decoded-frame testing and rights
 * assessment are independent release gates.
 */
import fs from 'node:fs';
const PLAYLIST='https://iptv-org.github.io/iptv/categories/news.m3u';
const ORIGIN='https://mazooniosman299-blip.github.io';
const timeout=Number(process.env.STREAM_TIMEOUT_MS||5000);
const concurrency=16;
const sanitize=x=>String(x||'').replace(/[\u0000-\u001f]/g,'').slice(0,240);
function attr(line,name) {
 const m=line.match(new RegExp('(?:^|\\s)'+name+'="([^"]*)"','i'));
 return m?sanitize(m[1]):'';
}
async function getSource(){
 const response=await fetch(PLAYLIST,{signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('News channel source list '+response.status);
 return response.text();
}
function discover(m3u){
 const rows=m3u.split(/\r?\n/),records=[];
 let meta=null;
 for(const raw of rows){
  const line=raw.trim();
  if(line.startsWith('#EXTINF:')){
   meta={name:sanitize(line.split(',').slice(1).join(',').trim()),id:attr(line,'tvg-id'),language:attr(line,'tvg-language'),country:attr(line,'tvg-country')};
  }else if(line&&line[0]!=='#'&&meta){
   try{
    const link=new URL(line);
    if(link.protocol==='https:'&&link.pathname.toLowerCase().endsWith('.m3u8'))records.push({...meta,url:link.href});
   }catch{}
   meta=null;
  }
 }
 const seen=new Set();
 return records.filter(r=>{if(seen.has(r.url))return false;seen.add(r.url);return true});
}
async function probe(candidate){
 try{
  const res=await fetch(candidate.url,{headers:{Origin:ORIGIN,Accept:'application/vnd.apple.mpegurl,application/x-mpegurl,*/*'},signal:AbortSignal.timeout(timeout),redirect:'follow'});
  if(!res.ok)return {...candidate,status:'http-failure',http:res.status,licenseChecked:false,videoDecoded:false};
  const text=(await res.text()).slice(0,5000);
  const cors=res.headers.get('access-control-allow-origin');
  const verifiedManifest=text.includes('#EXTM3U');
  return {...candidate,status:verifiedManifest?(cors==='*'||cors===ORIGIN?'manifest-cors':'manifest-needs-browser-check'):'invalid-manifest',http:res.status,licenseChecked:false,videoDecoded:false};
 }catch(e){return {...candidate,status:'network-error',error:sanitize(e.name),licenseChecked:false,videoDecoded:false}}
}
const candidates=discover(await getSource());
console.log('Global news playlist: '+candidates.length+' HTTPS HLS candidates (NOT proven playable and NOT licensed).');
const results=new Array(candidates.length);
let cursor=0;
async function worker(){
 while(true){
  const index=cursor++;
  if(index>=candidates.length)break;
  results[index]=await probe(candidates[index]);
 }
}
await Promise.all(Array.from({length:concurrency},worker));
const counts={};
for(const r of results)counts[r.status]=(counts[r.status]||0)+1;
const report={generatedAt:new Date().toISOString(),source:PLAYLIST,scope:'read-only public listing plus HTTP/CORS manifest probe',warning:'No rights verification or decoded-frame playback. No stream automatically added to OFUQ.',totalCandidates:results.length,counts,candidates:results};
fs.mkdirSync('audit-output',{recursive:true});
fs.writeFileSync('audit-output/world-news-candidates.json',JSON.stringify(report,null,2));
console.log('Global news candidate audit: '+JSON.stringify({totalCandidates:report.totalCandidates,counts}));
console.log('NO PUBLISH: rights review, verified browser video playback in target location, and stability monitoring required for every new channel.');
