import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
const server=spawn('python3',['-m','http.server','8765','--bind','127.0.0.1','--directory','ofuq-tv'],{stdio:'ignore'});
let browser=null;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitVideo(page,channel){
 await page.waitForFunction(
  () => {const v=document.querySelector('#nativePlayer');return v&&v.readyState>=2&&!v.paused&&v.currentTime>2;},
  undefined,{timeout:55_000,polling:500}
 );
 const data=await page.locator('#nativePlayer').evaluate(v=>({currentTime:v.currentTime,width:v.videoWidth,height:v.videoHeight,ready:v.readyState}));
 if(data.width<=0||data.height<=0)throw new Error('No decoded video frames in '+channel);
 console.log('PLAYBACK PASS '+channel+' '+JSON.stringify(data));
}
try{
 await sleep(1200);
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')console.log('BROWSER CONSOLE ERROR '+m.text().slice(0,240))});
 await page.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded',timeout:30_000});
 await page.locator('#nativePlayer').waitFor({state:'visible',timeout:20_000});
 if(await page.locator('iframe[src*="youtube"]').count())throw Error('YouTube iframe found');
 if(await page.locator('#youtubeStage').count())throw Error('YouTube host found');
 if(!(await page.locator('.upper-center').isVisible()))throw Error('Branded upper screen missing');
 await waitVideo(page,'first autoplay channel');
 await page.getByRole('button',{name:/فرانس 24 العربية/}).click();
 await waitVideo(page,'France 24');
 if(errors.length)throw Error('Browser uncaught JS: '+errors.slice(0,3).join(' | '));
 console.log('OFUQ BROWSER QA PASS: native video progresses, branded top screen visible, channel switching works.');
}finally{if(browser)await browser.close();server.kill()}
