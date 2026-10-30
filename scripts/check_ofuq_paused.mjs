// Deployment safety gate. Do not silently reactivate news/broadcasts without permissions.
const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'../ofuq-tv');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const absent=['channels.json','news.json','news-archive.json','full-articles.json','breaking.json','report-clips.json','sitemap.xml'];
for(const file of absent)assert(!fs.existsSync(path.join(root,file)),'Paused public asset unexpectedly restored: '+file);
for(const file of ['index.html','story.html','player.html','editorial.html','privacy.html']){
 const s=read(file);
 assert(/noindex/.test(s),'Published page has no indexing suspension: '+file);
 assert(!/<(?:video|audio|iframe)\b/i.test(s),'Media player unexpectedly exposed: '+file);
 assert(!/<script\b/i.test(s),'Executable client code unexpectedly loaded: '+file);
 assert(!/https?:\/\/[^"' ]+\.(?:m3u8|mp4|webm)/i.test(s),'Remote media source unexpectedly exposed: '+file);
}
const main=read('index.html');
assert(main.includes('تم تعليق عرض القنوات'),'Suspension notice missing');
assert(main.includes('وزارة الإعلام العُمانية'),'Official licensing information missing');
const ads=JSON.parse(read('ads.json'));
assert(ads.network?.enabled===false,'Live ad network unexpectedly enabled');
assert(!Array.isArray(ads.ads)||ads.ads.length===0,'Active video promos unexpectedly restored');
for(const file of ['ofuq-arabic-news-refresh.yml','ofuq-headlines.yml','ofuq-breaking.yml']){
 const s=fs.readFileSync(path.resolve(__dirname,'../.github/workflows',file),'utf8');
 assert(!/\bschedule\s*:/.test(s),'Automatic news publication unexpectedly restored: '+file);
 assert(!/scripts\/update_ofuq_/.test(s),'Legacy publishing script unexpectedly enabled: '+file);
}
console.log('OFUQ PUBLIC COMPLIANCE HOLD: PASS — no live news, third-party images, channels, reports or ads.');
