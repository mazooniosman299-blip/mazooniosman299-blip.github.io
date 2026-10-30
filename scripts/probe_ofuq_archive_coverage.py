#!/usr/bin/env python3
"""Read-only audit of legitimately licensed full-text Arabic Global Voices RSS archives."""
from concurrent.futures import ThreadPoolExecutor, as_completed
from collections import Counter
from email.utils import parsedate_to_datetime
from update_ofuq_full_articles import get_feed, section_for, CONTENT_NS, DC_NS
from urllib.parse import urlsplit
import json, re, os
MAX_PAGE=int(os.getenv("PROBE_PAGES","80"))
def inspect_page(page):
    url="https://ar.globalvoices.org/feed/"+(f"?paged={page}" if page>1 else "")
    try:
        root=get_feed(url)
        rows=[]
        for x in root.findall(".//channel/item"):
            title=(x.findtext("title") or "").strip()
            link=(x.findtext("link") or "").strip()
            author=(x.findtext(DC_NS+"creator") or "").strip()
            html=(x.findtext(CONTENT_NS+"encoded") or "")
            if not link.startswith("https://ar.globalvoices.org/"):continue
            rows.append({"title":title,"url":link,"section":section_for(title),"html":len(html),"author":bool(author)})
        return page,rows,None
    except Exception as e:
        return page,[],str(e)[:110]
discovered={}
fails=[]
with ThreadPoolExecutor(max_workers=8) as pool:
    pending=[pool.submit(inspect_page,p) for p in range(1,MAX_PAGE+1)]
    for f in as_completed(pending):
        page,rows,error=f.result()
        if error:fails.append((page,error))
        for row in rows:
            discovered.setdefault(row["url"],row)
counts=Counter(x["section"] for x in discovered.values())
longtexts=Counter(x["section"] for x in discovered.values() if x["html"]>=1300 and x["author"])
print("ARCHIVE PROBE PAGES:",MAX_PAGE,"unique articles:",len(discovered),"fetch errors:",len(fails),flush=True)
print("LICENSED RSS TOPIC COVERAGE:",json.dumps(dict(counts),ensure_ascii=False),flush=True)
print("POTENTIALLY COMPLETE BY TOPIC:",json.dumps(dict(longtexts),ensure_ascii=False),flush=True)
for topic in ["sudan","region","sports","technology","arts","variety"]:
    samples=[{"title":x["title"][:95],"url":x["url"]} for x in discovered.values() if x["section"]==topic][:4]
    print("EXAMPLES",topic,json.dumps(samples,ensure_ascii=False),flush=True)
if fails:print("FEED ERROR SAMPLE:",fails[:5],flush=True)
