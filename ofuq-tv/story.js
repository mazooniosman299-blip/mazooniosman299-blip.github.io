(()=>{'use strict';
const $=id=>document.getElementById(id);
const id=new URLSearchParams(location.search).get('id');
const host=$('article');
const CATEGORIES={world:'أخبار العالم',region:'أخبار المنطقة',sudan:'أخبار السودان',sports:'رياضة',technology:'تكنولوجيا',arts:'فنون',variety:'منوعات',articles:'مقالات'};
function node(tag,cl,value){const e=document.createElement(tag);if(cl)e.className=cl;e.textContent=value||'';return e}
function date(v){try{return new Intl.DateTimeFormat('ar-OM',{timeZone:'Asia/Muscat',dateStyle:'long'}).format(new Date(v))}catch{return ''}}
function articleId(n){return String(n.id||((String(n.url||'').match(/\/(\d{5,12})(?:[/?#]|$)/)||[])[1]||''))}
function safe(url){try{return new URL(url).protocol==='https:'}catch{return false}}
function clean(text){return String(text||'').replace(/\*\*/g,'').replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim()}
function addText(root,tag,cl,str){const text=clean(str);if(text)root.append(node(tag,cl,text))}
Promise.all([
 fetch('news-archive.json?ts='+Math.floor(Date.now()/60000),{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('archive');return r.json()}).catch(()=>fetch('news.json',{cache:'no-store'}).then(r=>r.json())),
 fetch('news-briefs.json',{cache:'no-store'}).then(r=>r.ok?r.json():{}),
 fetch('full-articles.json?ts='+Math.floor(Date.now()/300000),{cache:'no-store'}).then(r=>r.ok?r.json():{}).catch(()=>({}))
]).then(([data,briefs,licensedArticles])=>{
 const items=Array.isArray(data.items)?data.items:[];
 const story=items.find(n=>articleId(n)===id);host.replaceChildren();
 if(!story){host.append(node('h1','','الخبر غير متاح'),node('p','loading','الرجاء اختيار خبر آخر من القائمة.'));return}
 const brief=briefs[id]||{};
 const full=licensedArticles[id];
 const validFull=Boolean(full&&full.approved===true&&['original','licensed'].includes(full.rights)&&Array.isArray(full.paragraphs)&&full.paragraphs.length>=5&&full.paragraphs.some(p=>p.text?.length>70)&&full.original_url===story.url);
 document.title=story.title+' | أُفُق TV';
 host.append(node('div','category',brief.category||CATEGORIES[story.section]||'الأخبار'));
 host.append(node('h1','',story.title));
 const meta=node('div','meta','');
 meta.append(node('span','',date(story.published_at)));host.append(meta);
 if(validFull){
  const byline=node('p','licensed-byline','');
  byline.append(node('span','','بقلم '+full.author+' · '));
  const link=node('a','','الأصوات العالمية — النسخة الأصلية');
  link.href=full.original_url;link.target='_blank';link.rel='noopener noreferrer';
  byline.append(link);host.append(byline);
 }
 if(safe(story.image)){
  const figure=node('figure','article-photo','');
  const img=document.createElement('img');img.src=story.image;img.alt='صورة مرتبطة بالخبر';img.loading='eager';img.decoding='async';img.referrerPolicy='no-referrer';img.onerror=()=>figure.remove();
  figure.append(img);host.append(figure);
 }
 if(validFull){
  const content=node('div','body-copy complete-article','');
  for(const block of full.paragraphs){
   if(!block||typeof block.text!=='string')continue;
   const tag=['h2','h3'].includes(block.type)?block.type:'p';
   const cleaned=clean(block.text);
   if(cleaned)content.append(node(tag,'',cleaned));
  }
  host.append(content);
  const rights=node('div','license-credit','');
  rights.append(node('span','','إعادة نشر بموجب ترخيص '));
  const license=node('a','',full.license||'CC BY 3.0');
  license.href='https://creativecommons.org/licenses/by/3.0/';
  license.target='_blank';license.rel='noopener noreferrer';
  rights.append(license);
  rights.append(node('span','',' · نُسب النص إلى الكاتب والمصدر أعلاه. أُزيلت الصور والتضمينات، وأُعيد تنسيق الفقرات.'));
  host.append(rights);
 }else{
  // A feed excerpt is NOT a full article nor a grant to copy the publisher's full work.
  // Keep it factually accurate; prioritize complete licensed reports elsewhere.
  const paragraphs=Array.isArray(brief.paragraphs)?brief.paragraphs.map(clean).filter(Boolean):[];
  const lead=clean(brief.lead||story.excerpt||'');
  if(lead)addText(host,'p','intro',lead);
  const body=node('div','body-copy','');
  for(const para of paragraphs)if(para!==lead)addText(body,'p','',para);
  host.append(body);
  const context=node('div','related-report-note','');
  context.append(node('span','','المعلومات المتاحة لهذا العنوان محدودة. المقالات الكاملة المسموح بنشرها تظهر ضمن أخبار أُفُق الأخرى.'));
  host.append(context);
 }
 const more=items.filter(n=>articleId(n)!==id&&(n.section===story.section||n.section==='world')).slice(0,4);
 if(more.length){
  const section=node('section','article-more','');
  section.append(node('h2','','أخبار وتطورات مرتبطة'));
  const list=node('div','article-more-grid','');
  for(const item of more){
   const card=node('a','article-more-card','');card.href='story.html?id='+encodeURIComponent(articleId(item));
   if(safe(item.image)){const img=document.createElement('img');img.loading='lazy';img.alt='';img.src=item.image;img.referrerPolicy='no-referrer';card.append(img)}
   const copy=node('div','','');addText(copy,'h3','',item.title);addText(copy,'p','',item.excerpt);card.append(copy);list.append(card)
  }
  section.append(list);host.append(section);
 }
 // Preserve a source reference for transparency without imposing an outbound reading flow.
 if(!validFull&&safe(story.url)){const source=node('details','article-credits','');source.append(node('summary','','توثيق الخبر'));const a=node('a','','الناشر الأصلي');a.href=story.url;a.target='_blank';a.rel='noopener noreferrer';source.append(a);host.append(source)}
 const related=$('related');related.replaceChildren();
 for(const n of items.filter(n=>articleId(n)!==id).slice(0,6)){const a=node('a','',n.title);a.href='story.html?id='+encodeURIComponent(articleId(n));related.append(a)}
}).catch(()=>{host.replaceChildren(node('h1','','تعذّر عرض الخبر'),node('p','loading','يرجى العودة إلى الأخبار.'))});
})();
