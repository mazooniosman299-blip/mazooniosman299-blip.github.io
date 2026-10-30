#!/usr/bin/env python3
"""Exploratory QA only; report whether alternative CC-BY Arabic feeds expose DISTINCT complete texts."""
import urllib.request, xml.etree.ElementTree as ET, urllib.parse, json
from concurrent.futures import ThreadPoolExecutor,as_completed
BASE='https://ar.globalvoices.org'
TARGETS=[
 BASE+'/feed/',
 BASE+'/feed/?paged=2',
 BASE+'/feed/?paged=3',
 BASE+'/2026/10/feed/',
 BASE+'/2026/09/feed/',
 BASE+'/-/world/africa/feed/',
 BASE+'/-/world/middle-east-north-africa/feed/',
 BASE+'/-/topics/human-rights/feed/',
 BASE+'/-/topics/technology/feed/',
 BASE+'/wp-json/wp/v2/posts?per_page=30&page=2'
]
CONTENT_NS='{http://purl.org/rss/1.0/modules/content/}'
def check(url):
 try:
  with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'OFUQ Licensed Feeds QA/1.0','Accept':'application/rss+xml,application/xml,application/json,*/*;q=.1'}),timeout=16) as r:
   raw=r.read(5_000_000)
  if raw.lstrip().startswith(b'['):
   j=json.loads(raw);return {'url':url,'items':len(j),'links':[(x.get('link',''),len(x.get('content',{}).get('rendered',''))) for x in j[:3]],'format':'json'}
  root=ET.fromstring(raw)
  items=root.findall('.//channel/item')
  return {'url':url,'items':len(items),'links':[(x.findtext('link') or '',len(x.findtext(CONTENT_NS+'encoded') or '')) for x in items[:3]],'format':'rss'}
 except Exception as e:
  return {'url':url,'error':type(e).__name__+': '+str(e)[:110]}
with ThreadPoolExecutor(max_workers=5) as pool:
 jobs={pool.submit(check,url):url for url in TARGETS}
 for fut in as_completed(jobs):
  print('LICENSED PROBE '+json.dumps(fut.result(),ensure_ascii=False),flush=True)
