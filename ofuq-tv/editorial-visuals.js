/* OFUQ editorial illustrations are NOT eyewitness photography.
   Real publisher photographs remain preferred and keep source attribution. */
(()=>{'use strict';
const NS='http://www.w3.org/2000/svg';
let visualIndex=0;
function svgEl(tag,attrs={},value){const e=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,String(v));if(value!==undefined)e.textContent=String(value);return e}
const topics=[
 {re:/حريق|حرائق|نيران|احتراق|انفجار|قصف|صواريخ/,icon:'🔥',label:'تطورات ميدانية',colors:['#54232b','#aa5136']},
 {re:/نازح|نزوح|أسرة|أسر|لاجئ|سكان|إنسان/,icon:'🏘️',label:'أخبار المجتمع',colors:['#153e54','#367c87']},
 {re:/نفط|وقود|بنزين|جازولين|أسعار|اقتصاد|سوق|تجارة/,icon:'📈',label:'اقتصاد ومعيشة',colors:['#163d43','#328479']},
 {re:/رياضة|كرة|مباراة|منتخب|دوري/,icon:'⚽',label:'رياضة',colors:['#153f33','#247e65']},
 {re:/تقنية|ذكاء اصطناعي|تكنولوجيا|هاتف|إنترنت/,icon:'💻',label:'تقنية',colors:['#20335d','#3877b2']},
 {re:/علاج|مستشفى|صحة|مرض|أطباء/,icon:'✚',label:'الصحة',colors:['#244b67','#327ca3']}
];
function topic(story){const t=String(story?.title||'');return topics.find(x=>x.re.test(t))||{icon:'🌍',label:'أخبار وتقارير',colors:['#17405b','#276e91']}}
function illustration(story){
 const chosen=topic(story),gradientId='ofuqEditorialGradient'+(++visualIndex),svg=svgEl('svg',{viewBox:'0 0 960 540',width:'960',height:'540',role:'img','aria-label':'رسم توضيحي للموضوع، وليس صورة توثيقية للحدث'});
 svg.classList.add('ofuq-editorial-visual');
 const defs=svgEl('defs'),grad=svgEl('linearGradient',{id:gradientId,x1:'0',y1:'0',x2:'1',y2:'1'});
 grad.append(svgEl('stop',{offset:'0%', 'stop-color':chosen.colors[0]}),svgEl('stop',{offset:'100%','stop-color':chosen.colors[1]}));defs.append(grad);svg.append(defs);
 svg.append(svgEl('rect',{width:'960',height:'540',fill:'url(#'+gradientId+')'}));
 for(let i=0;i<8;i++)svg.append(svgEl('path',{d:`M ${i*130-180} 540 L ${i*130+220} 0`,stroke:'#bceaf0','stroke-opacity':'.08','stroke-width':'3'}));
 svg.append(svgEl('circle',{cx:'480',cy:'240',r:'175',fill:'none',stroke:'#c9eff4','stroke-opacity':'.25','stroke-width':'4'}));
 svg.append(svgEl('text',{x:'480',y:'285','text-anchor':'middle','font-size':'170'},chosen.icon));
 svg.append(svgEl('rect',{x:'25',y:'430',width:'910',height:'84',rx:'9',fill:'#031625','fill-opacity':'.82'}));
 svg.append(svgEl('text',{x:'895',y:'481','text-anchor':'end',direction:'rtl','font-size':'31','font-weight':'700',fill:'#f4ffff'},chosen.label));
 svg.append(svgEl('text',{x:'63',y:'480','text-anchor':'start','font-size':'20',fill:'#bcdae5'},'رسم توضيحي'));
 return svg;
}
function media(host,story,opts={}){
 const imgUrl=typeof story?.image==='string'?story.image:'';
 let uri;try{uri=new URL(imgUrl);if(uri.protocol!=='https:')uri=null}catch{uri=null}
 const visual=()=>{
   // Never depict a reported event with an unrelated icon or stock illustration.
   // A source story without usable licensed/attributed photography is text-only.
   host.classList.add('no-source-image');
   host.hidden=true;
   return null;
 };
 if(!uri){visual();return}
 const image=document.createElement('img');
 image.src=uri.href;image.alt='صورة من المصدر: '+(story.source||'الناشر');
 image.loading=opts.eager?'eager':'lazy';image.decoding='async';image.referrerPolicy='strict-origin-when-cross-origin';
 image.addEventListener('error',()=>{image.remove();if(!host.querySelector('svg.ofuq-editorial-visual'))visual()},{once:true});
 host.append(image);
}
window.OFUQVisual=Object.freeze({media,illustration});
})();