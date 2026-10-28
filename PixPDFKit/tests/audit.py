from pathlib import Path
from bs4 import BeautifulSoup
from urllib.parse import unquote
import xml.etree.ElementTree as ET
root=Path(__file__).resolve().parents[1]
pages=list(root.rglob('*.html'))
assert len(pages)==46,len(pages)
links=0
for page in pages:
    soup=BeautifulSoup(page.read_text(encoding='utf-8'),'html.parser')
    assert soup.title and soup.title.get_text(strip=True),page
    assert soup.find('h1') or page.name in ('404.html','index.html'),page
    for el in soup.select('[href], [src]'):
        url=el.get('href') or el.get('src') or ''
        if not url or url.startswith(('https:','http:','mailto:','#','data:','javascript:')): continue
        target=(page.parent/unquote(url.split('#')[0].split('?')[0])).resolve()
        if target.is_dir(): target=target/'index.html'
        if target!=page.parent and not target.exists(): raise AssertionError(f'{page}: broken {url}')
        links+=1
ET.parse(root/'sitemap.xml')
assert len(list(root.glob('ar/tools/*.html')))==13
assert len(list(root.glob('en/tools/*.html')))==13
print(f'PASS: {len(pages)} HTML pages, {links} local references, 13 tools x 2 languages, XML sitemap')
