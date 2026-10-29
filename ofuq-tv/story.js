(()=>{'use strict';
const $=id=>document.getElementById(id);
const id=new URLSearchParams(location.search).get('id');
const host=$('article');
const CATEGORIES={world:'أخبار العالم',region:'أخبار المنطقة',sudan:'أخبار السودان',sports:'رياضة',technology:'تكنولوجيا',arts:'فنون',variety:'منوعات',articles:'مقالات'};
function node(tag,cl,value){const e=document.createElement(tag);if(cl)e.className=cl;e.textContent=value||'';return e}
function date(v){try{return new Intl.DateTimeFormat('ar-OM',{timeZone:'Asia/Muscat',dateStyle:'long'}).format(new Date(v))}catch{return 'تاريخ النشر غير متاح'}}
function articleId(n){return typeof n.id==='string'&&n.id?n.id:(String(n.url||'').match(/\/(\d{5,12})(?:[/?#]|$)/)||[])[1]}
function safe(url){try{return new URL(url).protocol==='https:'}catch{return false}}
Promise.all([
 fetch('news-archive.json?ts='+Math.floor(Date.now()/60000),{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('archive');return r.json()}).catch(()=>fetch('news.json',{cache:'no-store'}).then(r=>r.json())),
 fetch('news-briefs.json',{cache:'no-store'}).then(r=>r.ok?r.json():{})
]).then(([data,briefs])=>{
 const items=Array.isArray(data.items)?data.items:[];
 const story=items.find(n=>articleId(n)===id);host.replaceChildren();
 if(!story){host.append(node('h1','','الخبر غير متاح'),node('p','loading','الرجاء اختيار خبر آخر من القائمة.'));return}
 const brief=briefs[id]||{};
 document.title=story.title+' | أُفُق TV';
 host.append(node('div','category',brief.category||CATEGORIES[story.section]||'الأخبار'));
 host.append(node('h1','',story.title));
 const meta=node('div','meta','');
 meta.append(node('span','',story.source||'المصدر'),node('span','',date(story.published_at)));host.append(meta);
 if(safe(story.image)){
  const figure=node('figure','article-photo','');
  const img=document.createElement('img');img.src=story.image;img.alt='الصورة المرفقة بالخبر من '+story.source;img.loading='eager';img.onerror=()=>figure.remove();
  const credit=node('figcaption','','صورة الخبر: '+story.source);figure.append(img,credit);host.append(figure);
 }
 const excerpt=brief.lead||story.excerpt||'عرض موجز للعنوان المنشور لدى المصدر.';
 host.append(node('p','intro',excerpt));
 const body=node('div','body-copy','');
 if(Array.isArray(brief.paragraphs)&&brief.paragraphs.length){for(const text of brief.paragraphs)body.append(node('p','',text))}
 else body.append(node('p','','هذا موجز لما أتاحته خلاصة المصدر. للاطلاع على التفاصيل الكاملة، انتقل إلى التقرير الأصلي من الرابط أدناه.'));
 host.append(body);
 const attribution=node('div','attribution','');
 attribution.append(node('b','','المصدر الأصلي'),node('span','',story.source+' · '+date(story.published_at)));
 if(safe(story.url)){const a=node('a','source-link','اقرأ التقرير الكامل لدى المصدر');a.href=story.url;a.target='_blank';a.rel='noopener noreferrer';attribution.append(a)}
 host.append(attribution);
 host.append(node('p','notices','نسبت الصور والمعلومات إلى الجهة الناشرة. لا يُنسب إلى أُفُق تحقيق لم يجره فريقها.'));
 const related=$('related');related.replaceChildren();
 for(const n of items.filter(n=>articleId(n)!==id).slice(0,6)){
  const a=node('a','',n.title);a.href='story.html?id='+encodeURIComponent(articleId(n));related.append(a)
 }
}).catch(()=>{host.replaceChildren(node('h1','','تعذّر عرض الخبر'),node('p','loading','يرجى العودة إلى الأخبار.'))});
})();
