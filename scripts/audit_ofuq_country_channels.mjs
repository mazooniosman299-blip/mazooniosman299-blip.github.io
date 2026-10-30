/* Read-only candidate discovery for Oman, Qatar, Sudan.
   A playlist entry is NOT a license or proof of playable video.
   NEVER update published channels.json from this script.
*/
import fs from 'node:fs';
const countries={om:'عُمان',qa:'قطر',sd:'السودان'};
const origin='https://mazooniosman299-blip.github.io';
const maxConcurrent=14;
const timeout=6500;
async function get(url){
 const res=await fetch(url,{signal:AbortSignal.timeout(16000),headers:{'User-Agent':'OFUQ-TV-Candidate-Audit/1.0'}});
 if(!res.ok)throw Error('Playlist HTTP '+res.status);
 return res.text();
}
function attr(line,name){const m=line.match(new RegExp('(?:^|\\s)'+name+'="([^"]*)"'));return m?.[1]||''}
function parse(content,country){
 const lines=content.split(/\r?\n/),out=[];let title=null;
 for(const raw of lines){
  const line=raw.trim();
  if(line.startsWith('#EXTINF:'))title={name:line.split(',').slice(1).join(',').trim(),id:attr(line,'tvg-id')};
  else if(title&&line&&!line.startsWith('#')){
   try{const u=new URL(line);if(u.protocol==='https:'&&u.pathname.toLowerCase().endsWith('.m3u8'))out.push({...title,country,url:u.toString()})}catch{}
   title=null
  }
 }
 return [...new Map(out.map(x=>[x.url,x])).values()];
}
async function probe(c){
 try{
  const r=await fetch(c.url,{signal:AbortSignal.timeout(timeout),headers:{Origin:origin,Accept:'application/vnd.apple.mpegurl,*/*'},redirect:'follow'});
  const manifest=r.ok?(await r.text()).slice(0,5000):'';
  const cors=r.headers.get('access-control-allow-origin')||'';
  return {...c,status:r.status,manifest:r.ok&&manifest.includes('#EXTM3U'),corsOpen:cors==='*'||cors===origin,licenseChecked:false,videoDecoded:false};
 }catch(e){return {...c,error:String(e.name||e).slice(0,80),manifest:false,corsOpen:false,licenseChecked:false,videoDecoded:false}}
}
const all=[];
for(const country of Object.keys(countries)){
 try{const feed=await get('https://iptv-org.github.io/iptv/countries/'+country+'.m3u');
  const parsed=parse(feed,country);console.log('COUNTRY PLAYLIST '+country+' '+countries[country]+' HLS URLs '+parsed.length);
  all.push(...parsed);
 }catch(e){console.log('COUNTRY PLAYLIST ERROR '+country+': '+String(e).slice(0,200))}
}
let i=0;const results=new Array(all.length);
await Promise.all(Array.from({length:maxConcurrent},async()=>{while(i<all.length){const n=i++;results[n]=await probe(all[n])}}));
const stats={};for(const c of results){const s=stats[c.country]??={total:0,manifest:0,cors:0};s.total++;if(c.manifest)s.manifest++;if(c.manifest&&c.corsOpen)s.cors++}
console.log('COUNTRY SUMMARY '+JSON.stringify(stats));
for(const c of results.filter(x=>x.manifest&&x.corsOpen)){
 console.log('COUNTRY POTENTIAL '+JSON.stringify({country:c.country,id:c.id,name:c.name,url:c.url,status:c.status}));
}
fs.mkdirSync('audit-output',{recursive:true});
fs.writeFileSync('audit-output/ofuq-country-candidates.json',JSON.stringify({disclaimer:'Candidates only, NOT licensed for redistribution or verified playback. Do not auto-publish.',summary:stats,results},null,2));
