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
 fetch('full-articles.json?ts='+Math.floor(Date.now()/300000),{cache:'no-store'}).then(r=>r.ok?r.json():{}).catch(()=>({}))
]).then(([data,licensedArticles])=>{
 const items=Array.isArray(data.items)?data.items:[];
 const story=items.find(n=>articleId(n)===id);host.replaceChildren();
 if(!story){host.append(node('h1','','الخبر غير متاح'),node('p','loading','الرجاء اختيار خبر آخر من القائمة.'));return}
 const full=licensedArticles[id];
 const validFull=Boolean(full&&full.approved===true&&['original','licensed'].includes(full.rights)&&Array.isArray(full.paragraphs)&&full.paragraphs.length>=5&&full.paragraphs.some(p=>p.text?.length>70)&&full.original_url===story.url);
 // Keep every reader route in OFUQ. Do not copy full publisher texts
 // from a short RSS feed unless their reuse rights have been verified.
 // Non-licensed feeds are explicitly identified as briefs, never full reports.
 document.title=story.title+' | أُفُق TV';
 if(!validFull){host.replaceChildren(node('h1','','الخبر غير متاح'),node('p','loading','هذه المادة ليست مرخصة للنشر داخل أُفُق.'));return}
 host.append(node('div','category',CATEGORIES[story.section]||'الأخبار'));
 host.append(node('h1','',story.title));
 const meta=node('div','meta','');
 meta.append(node('span','',date(story.published_at)));host.append(meta);
 const byline=node('p','licensed-byline','');
 byline.append(node('span','','المصدر: '));
 const sourceLink=node('a','',story.source||full?.source||'الناشر');
 sourceLink.href=validFull?full.original_url:story.url;
 sourceLink.target='_blank';sourceLink.rel='noopener noreferrer';
 byline.append(sourceLink);
 if(validFull&&full.author)byline.append(node('span','',' · بقلم '+full.author));
 host.append(byline);
 const figure=node('figure','article-photo','');
 window.OFUQVisual.media(figure,story,{eager:true});
 host.append(figure);
 if(validFull){
  const content=node('div','body-copy complete-article','');
  for(const block of full.paragraphs){
   if(!block||typeof block.text!=='string')continue;
   const tag=['h2','h3'].includes(block.type)?block.type:'p';
   const cleaned=clean(block.text);
   if(cleaned)content.append(node(tag,'',cleaned));
  }
  host.append(content);
  const rights=node('details','license-credit','');
  const summary=node('summary','','ⓘ');
  summary.title='تفاصيل ترخيص النص';
  summary.setAttribute('aria-label','تفاصيل ترخيص النص');
  rights.append(summary);
  const license=node('a','',full.license||'CC BY 3.0');
  license.href=full.license_url||'https://creativecommons.org/licenses/by/3.0/';
  license.target='_blank';license.rel='noopener noreferrer';
  rights.append(license);
  rights.append(node('span','',' · أعيد تنسيق النص مع نسبة المصدر والمؤلف.'));
  host.append(rights);
 }
 const more=items.filter(n=>n.full_article===true&&articleId(n)!==id&&(n.section===story.section||n.section==='world')).slice(0,4);
 if(more.length){
  const section=node('section','article-more','');
  section.append(node('h2','','أخبار وتطورات مرتبطة'));
  const list=node('div','article-more-grid','');
  for(const item of more){
   const card=node('a','article-more-card','');card.href='story.html?id='+encodeURIComponent(articleId(item));
   const media=node('div','related-visual','');window.OFUQVisual.media(media,item);card.append(media);
   const copy=node('div','','');addText(copy,'h3','',item.title);addText(copy,'p','',item.excerpt);card.append(copy);list.append(card)
  }
  section.append(list);host.append(section);
 }
 // Preserve a source reference for transparency without imposing an outbound reading flow.

 const related=$('related');related.replaceChildren();
 for(const n of items.filter(n=>n.full_article===true&&articleId(n)!==id).slice(0,6)){const a=node('a','',n.title);a.href='story.html?id='+encodeURIComponent(articleId(n));related.append(a)}
}).catch(()=>{host.replaceChildren(node('h1','','تعذّر عرض الخبر'),node('p','loading','يرجى العودة إلى الأخبار.'))});
})();
