(()=>{'use strict';
const $=id=>document.getElementById(id);
const id=new URLSearchParams(location.search).get('id');
const host=$('article');
const CATEGORIES={world:'أخبار العالم',region:'أخبار المنطقة',sudan:'أخبار السودان',sports:'رياضة',technology:'تكنولوجيا',arts:'فنون',variety:'منوعات',articles:'مقالات'};
function node(tag,cl,value){const e=document.createElement(tag);if(cl)e.className=cl;if(value!=null)e.textContent=value;return e}
function date(v){try{return new Intl.DateTimeFormat('ar-OM',{timeZone:'Asia/Muscat',dateStyle:'long'}).format(new Date(v))}catch{return ''}}
function articleId(n){return String(n.id||((String(n.url||'').match(/\/(\d{5,12})(?:[/?#]|$)/)||[])[1]||''))}
function safe(url){try{return new URL(url).protocol==='https:'}catch{return false}}
function clean(v){return String(v||'').replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim()}
const wordsToSkip=new Set('في من على إلى عن مع هذا هذه ذلك تلك خلال بعد قبل التي الذي حيث منذ حتى لقد انه أنه وأن بسبب ضمن نحو وسط لدى لدى اليوم أمس جديد جديدا تقرير أخبار اخبار فيديو عاجل العالم آخر لم يكن كيف ماذا لماذا يقول قالت يقولون تفاصيل مصور شاهد الوقت دولة دول دولية موقع صور'.split(' '));
function tokens(title){return new Set(clean(title).normalize('NFKC').replace(/[إأآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').replace(/[^\p{L}\p{N}]+/gu,' ').toLowerCase().split(/\s+/).filter(x=>x.length>=4&&!wordsToSkip.has(x)))}
function sameTopic(a,b){
 if(!a||!b||a.id===b.id||a.url===b.url)return false;
 if(a.section!==b.section&&a.section!=='world'&&b.section!=='world')return false;
 const whenA=Date.parse(a.published_at),whenB=Date.parse(b.published_at);
 if(Number.isFinite(whenA)&&Number.isFinite(whenB)&&Math.abs(whenA-whenB)>10*86400000)return false;
 const at=tokens(a.title),bt=tokens(b.title);let common=0;for(const w of at)if(bt.has(w))common++;
 return common>=2 && common/Math.max(1,Math.min(at.size,bt.size))>=.32;
}
function paragraph(root,txt,cls){txt=clean(txt);if(txt)root.append(node('p',cls||'',txt))}
function appendFullOriginal(host,original){
 if(!original||!Array.isArray(original.paragraphs)||!original.paragraphs.length||original.approved!==true)return false;
 const section=node('section','original-report','');
 for(const block of original.paragraphs){
  if(typeof block==='string')paragraph(section,block);
  else if(block&&typeof block.text==='string'&&['p','h2','h3'].includes(block.type||'p')){
   const type=block.type||'p';section.append(node(type,'',clean(block.text)));
  }
 }
 host.append(section);return true;
}
Promise.all([
 fetch('news-archive.json?ts='+Math.floor(Date.now()/60000),{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('archive');return r.json()}).catch(()=>fetch('news.json',{cache:'no-store'}).then(r=>r.json())),
 fetch('news-briefs.json',{cache:'no-store'}).then(r=>r.ok?r.json():{}).catch(()=>({})),
 fetch('ofuq-original-articles.json',{cache:'no-store'}).then(r=>r.ok?r.json():{}).catch(()=>({}))
]).then(([data,briefs,originals])=>{
 const items=Array.isArray(data.items)?data.items:[];
 const story=items.find(n=>articleId(n)===id);host.replaceChildren();
 if(!story){host.append(node('h1','','الخبر غير متاح'),node('p','loading','الرجاء اختيار خبر آخر من القائمة.'));return}
 const brief=briefs[id]||{};
 document.title=story.title+' | أُفُق TV';
 host.append(node('div','category',brief.category||CATEGORIES[story.section]||'الأخبار'));
 host.append(node('h1','',story.title));
 const meta=node('div','meta','');meta.append(node('time','',date(story.published_at)));host.append(meta);
 if(safe(story.image)){
  const figure=node('figure','article-photo','');const img=document.createElement('img');
  img.src=story.image;img.alt='صورة مرافقة للخبر';img.loading='eager';img.referrerPolicy='no-referrer';
  img.onerror=()=>figure.remove();figure.append(img);host.append(figure);
 }
 const original=originals[id];
 const fullOriginal=appendFullOriginal(host,original);
 if(!fullOriginal){
  const lead=clean(brief.lead||story.excerpt||'');
  const facts=Array.isArray(brief.paragraphs)?brief.paragraphs.map(clean).filter(Boolean):[];
  if(lead)paragraph(host,lead,'intro');
  if(facts.length){const body=node('section','body-copy','');for(const text of facts)if(text!==lead)paragraph(body,text);host.append(body)}
 }
 const context=items.filter(n=>sameTopic(story,n)).sort((a,b)=>Date.parse(b.published_at||'')-Date.parse(a.published_at||'')).slice(0,6);
 if(context.length){
  const coverage=node('section','topic-updates','');coverage.append(node('h2','','تطورات مرتبطة بالموضوع'));
  for(const update of context){
   const item=node('div','topic-update','');
   item.append(node('time','',date(update.published_at)));
   const link=node('a','',update.title);link.href='story.html?id='+encodeURIComponent(articleId(update));item.append(link);
   if(update.excerpt)paragraph(item,update.excerpt,'topic-excerpt');
   coverage.append(item);
  }
  host.append(coverage);
 }
 // Transparency and publisher credit remain accessible without forcing outbound navigation.
 const credits=node('details','article-credits','');
 credits.append(node('summary','','مصادر وتوثيق'));
 const detail=node('div','','');detail.append(node('span','','بيانات الخبر: '+(story.source||'الناشر')));
 if(safe(story.url)){const link=node('a','','المادة المنشورة لدى الجهة الناشرة');link.href=story.url;link.target='_blank';link.rel='noopener noreferrer';detail.append(link)}
 credits.append(detail);host.append(credits);
 const more=items.filter(n=>articleId(n)!==id&&(n.section===story.section||n.section==='world')).slice(0,4);
 if(more.length){
  const section=node('section','article-more','');section.append(node('h2','','أخبار أخرى للمتابعة'));
  const list=node('div','article-more-grid','');
  for(const item of more){
   const card=node('a','article-more-card','');card.href='story.html?id='+encodeURIComponent(articleId(item));
   if(safe(item.image)){const img=document.createElement('img');img.loading='lazy';img.alt='';img.src=item.image;img.referrerPolicy='no-referrer';card.append(img)}
   const copy=node('div','','');copy.append(node('h3','',item.title));if(item.excerpt)paragraph(copy,item.excerpt);
   card.append(copy);list.append(card)
  }
  section.append(list);host.append(section);
 }
 const related=$('related');related.replaceChildren();
 for(const n of items.filter(n=>articleId(n)!==id).slice(0,6)){const a=node('a','',n.title);a.href='story.html?id='+encodeURIComponent(articleId(n));related.append(a)}
}).catch(()=>{host.replaceChildren(node('h1','','تعذّر عرض الخبر'),node('p','loading','يرجى العودة إلى الأخبار.'))});
})();