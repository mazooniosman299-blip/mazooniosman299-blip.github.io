/* OFUQ TV — optional VAST video ad-network integration via Google IMA HTML5.
   Ad network account + ACTIVE publisher VAST tag required before enabling.
   No third-party request is made while disabled. The first-party MP4 remains the fallback.
   This is not an ad exchange or an inventory source by itself.
*/
(()=>{
'use strict';
const overlay=document.getElementById('networkAdOverlay');
const player=document.getElementById('adVideo');
const billboard=document.getElementById('adScreen');
if(!overlay||!player||!billboard)return;
const ADS_SDK='https://imasdk.googleapis.com/js/sdkloader/ima3.js';
let adsManager=null,adsLoader=null,adContainer=null,requested=false,active=false;
function size(){const r=billboard.getBoundingClientRect();return {width:Math.max(300,Math.round(r.width)),height:Math.max(170,Math.round(r.height))}}
function restore(){
 active=false;overlay.hidden=true;
 if(adsManager){try{adsManager.destroy()}catch{}adsManager=null}
 if(adsLoader){try{adsLoader.destroy()}catch{}adsLoader=null}
 player.muted=true;player.play().catch(()=>{});
}
function script(){
 return new Promise((resolve,reject)=>{
  if(window.google?.ima){resolve();return}
  const s=document.createElement('script');s.async=true;s.src=ADS_SDK;
  s.onload=()=>window.google?.ima?resolve():reject(new Error('IMA unavailable'));
  s.onerror=()=>reject(new Error('IMA script failed'));
  document.head.append(s);
 })
}
function isValidTag(url){
 try{const u=new URL(url);return u.protocol==='https:'&&u.hostname.length>3&&!u.username&&!u.password&&u.toString().length<4096}catch{return false}
}
async function enable(tag){
 if(requested||!isValidTag(tag))return;
 requested=true;
 try{
  await script();
  if(!window.google?.ima)throw Error('No IMA SDK');
  const ima=google.ima;
  adContainer=new ima.AdDisplayContainer(overlay,player);
  adsLoader=new ima.AdsLoader(adContainer);
  const fail=()=>restore();
  adsLoader.addEventListener(ima.AdErrorEvent.Type.AD_ERROR,fail,false);
  adsLoader.addEventListener(ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED,(event)=>{
   try{
    adsManager=event.getAdsManager(player);
    adsManager.addEventListener(ima.AdErrorEvent.Type.AD_ERROR,fail);
    adsManager.addEventListener(ima.AdEvent.Type.CONTENT_PAUSE_REQUESTED,()=>{
     active=true;overlay.hidden=false;player.pause();
    });
    adsManager.addEventListener(ima.AdEvent.Type.STARTED,()=>{
     active=true;overlay.hidden=false;player.pause();
    });
    adsManager.addEventListener(ima.AdEvent.Type.COMPLETE,restore);
    adsManager.addEventListener(ima.AdEvent.Type.ALL_ADS_COMPLETED,restore);
    adsManager.addEventListener(ima.AdEvent.Type.CONTENT_RESUME_REQUESTED,restore);
    const dim=size();
    adContainer.initialize(); // Mobile browsers may require a gesture; failures keep promo.
    adsManager.init(dim.width,dim.height,ima.ViewMode.NORMAL);
    adsManager.start();
   }catch{restore()}
  },false);
  const request=new ima.AdsRequest();
  request.adTagUrl=tag;
  const dim=size();
  request.linearAdSlotWidth=dim.width;request.linearAdSlotHeight=dim.height;
  request.nonLinearAdSlotWidth=dim.width;request.nonLinearAdSlotHeight=Math.min(140,dim.height);
  request.setAdWillAutoPlay(true);request.setAdWillPlayMuted(true);
  adsLoader.requestAds(request);
  window.addEventListener('resize',()=>{if(active&&adsManager){const d=size();try{adsManager.resize(d.width,d.height,ima.ViewMode.NORMAL)}catch{}}},{passive:true});
 }catch{restore()}
}
async function init(){
 // Enabled only when user has supplied a real, approved VAST ad-network tag.
 try{
  const res=await fetch('ads.json?network='+Math.floor(Date.now()/300000),{cache:'no-store'});
  if(!res.ok)return;
  const data=await res.json();
  if(data.network?.enabled===true&&data.network?.type==='vast'&&isValidTag(data.network.adTagUrl))
   enable(data.network.adTagUrl);
 }catch{/* Preserve first-party video */}
}
init();
})();
