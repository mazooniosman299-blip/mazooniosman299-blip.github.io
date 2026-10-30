import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
const server=spawn('python3',['-m','http.server','8765','--bind','127.0.0.1','--directory','ofuq-tv'],{stdio:'ignore'});
let browser;
const base='http://127.0.0.1:8765/';
const fail=msg=>{throw Error(msg)};
try {
 await new Promise(r=>setTimeout(r,1200));
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
 const page=await browser.newPage({viewport:{width:1366,height:900}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.querySelectorAll('#newsGrid .news-card').length>=12,null,{timeout:17000});
 const full=await page.evaluate(async()=>{
  const [news,archive]=await Promise.all(['news.json','news-archive.json'].map(p=>fetch(p).then(r=>r.json())));
  return {news:news.items,archive:archive.items};
 });
 for(const [name,rows] of Object.entries(full)){
  if(rows.length<100||rows.some(x=>x.full_article!==true||x.source!=='الأصوات العالمية'||!x.url?.startsWith('https://ar.globalvoices.org/')))fail('Non-licensed article survived in '+name);
 }
 const cards=await page.locator('#newsGrid .news-card').evaluateAll(items=>items.map(x=>({full:x.dataset.fullArticle,section:x.querySelector('.tag')?.textContent})));
 if(cards.some(x=>x.full!=='true')||cards[0]?.section!=='العالم')fail('World-first or licensed-only cards failed');
 const theme=await page.evaluate(()=>{
  const css=q=>getComputedStyle(document.querySelector(q));
  return {clockBorder:css('#clock').borderTopWidth,brand:css('.eyebar .eyebrow>span').color,links:[...document.querySelectorAll('#navigation a')].map(e=>({color:getComputedStyle(e).color,size:parseFloat(getComputedStyle(e).fontSize)})),read:css('.hero-actions .secondary').color,editorial:css('.about-policy').color};
 });
 if(theme.clockBorder!=='0px'||theme.brand!=='rgb(255, 255, 255)'||theme.read!=='rgb(255, 255, 255)'||theme.editorial!=='rgb(255, 255, 255)'||theme.links.some(x=>x.color!=='rgb(255, 255, 255)'||x.size<14))fail('White navigation / no-frame clock design '+JSON.stringify(theme));
 const licence=await page.evaluate(async()=>fetch('report-clips.json').then(r=>r.json()));
 if(licence.clips.length!==8||licence.clips.some(x=>!x.date.startsWith('2026-')||!x.source_page?.includes('commons.wikimedia.org')||!x.license_url?.startsWith('https://creativecommons.org/')))fail('Eight source-credited genuine clips not registered');
 await page.waitForFunction(()=>window.ofuqReportInfo?.().count===8,null,{timeout:16000});
 const decoded=new Set();
 for(let step=0;step<8;step++){
  const video=page.locator('#reportVideo');
  if(step>0)await video.evaluate(v=>v.dispatchEvent(new Event('ended')));
  await page.waitForFunction(()=>{const v=document.getElementById('reportVideo');return v&&v.videoWidth>320&&!v.paused&&v.currentTime>1},null,{timeout:60000});
  const state=await page.evaluate(()=>({index:window.ofuqReportInfo().index,videoWidth:document.getElementById('reportVideo').videoWidth,src:document.getElementById('reportVideo').currentSrc}));
  if(decoded.has(state.index))fail('Skipped or duplicate media source '+JSON.stringify(state));
  decoded.add(state.index);
  console.log('VERIFIED ACTUAL 2026 FOOTAGE',state.index,state.videoWidth);
 }
 if(decoded.size!==8)fail('Did not decode eight distinct videos');
 await page.setViewportSize({width:390,height:844});
 const mobile=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth,player:document.getElementById('reportScreen').getBoundingClientRect().width}));
 if(mobile.scroll>mobile.width+2||mobile.player>mobile.width)fail('Mobile overflow '+JSON.stringify(mobile));
 for(const story of full.news.slice(0,4)){
  await page.goto(base+'story.html?id='+story.id,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelectorAll('.complete-article p,.complete-article h2,.complete-article h3').length>=5,null,{timeout:14000});
  const text=await page.locator('.complete-article').innerText();
  if(text.split(/\s+/).length<220)fail('Truncated article '+story.id);
  if((await page.locator('#article').innerText()).includes('موجز إخباري موثق'))fail('Unlicensed warning appeared');
  const font=await page.evaluate(()=>({text:getComputedStyle(document.querySelector('.complete-article p')).fontFamily,title:getComputedStyle(document.querySelector('.article h1')).fontFamily}));
  if(!font.text.includes('Noto Naskh Arabic')||!font.title.includes('Cairo'))fail('Wrong body font '+JSON.stringify(font));
 }
 await page.goto(base+'story.html?id=notlicensed',{waitUntil:'domcontentloaded'});
 if((await page.locator('#article').innerText()).includes('موجز إخباري موثق'))fail('Unlicensed excerpt returned via deep link');
 if(errors.length)fail('Page errors: '+errors.slice(0,3).join('; '));
 console.log('LICENSED ONLY / WHITE UI / WORLD FIRST / EIGHT FILMS / MOBILE / ARTICLE BODY: PASS');
} finally {
 if(browser)await browser.close();
 server.kill('SIGTERM');
}
