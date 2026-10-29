import fs from 'node:fs';
const {channels}=JSON.parse(fs.readFileSync('ofuq-tv/channels.json','utf8'));
const origin='https://mazooniosman299-blip.github.io';
async function probe(channel){
 const candidates=channel.streams.slice(0,2);
 for(const url of candidates){
  try{
   const res=await fetch(url,{headers:{Origin:origin,'User-Agent':'Mozilla/5.0 (compatible; OFUQ-QA/1.0)'},signal:AbortSignal.timeout(9000),redirect:'follow'});
   const body=await res.text();
   const contentType=res.headers.get('content-type')||'';
   const cors=res.headers.get('access-control-allow-origin')||'';
   if(res.ok&&body.slice(0,100).includes('#EXTM3U')){
    return {channel:channel.id,http:res.status,manifest:true,cors:cors==='*'||cors===origin,contentType,url,warning:cors?'':'CORS header missing (browser hls.js may fail)'};
   }
  }catch{} 
 }
 return {channel:channel.id,manifest:false};
}
const results=[];
for(let offset=0;offset<channels.length;offset+=6){
 results.push(...await Promise.all(channels.slice(offset,offset+6).map(probe)));
}
for(const result of results)console.log(JSON.stringify(result));
const found=results.filter(x=>x.manifest&&x.cors);
console.log('HLS PROBE SUMMARY: '+found.length+'/'+channels.length+' manifests with CORS response');
if(found.length<1){console.error('No CORS-ready HLS manifest confirmed from GitHub runner; do NOT publish this as verified working playback.');process.exitCode=1}
