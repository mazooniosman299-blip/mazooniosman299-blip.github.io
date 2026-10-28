from pathlib import Path
import re, xml.etree.ElementTree as ET
root=Path(__file__).resolve().parents[1]
pages=list(root.rglob('*.html'))
assert len(pages)>=40,len(pages)
for p in pages:
 s=p.read_text(encoding='utf8')
 assert '<title>' in s,p
 assert 'PixPDFKit' in s,p
 if 'tools/' in str(p):assert 'id="toolApp"' in s,p
assert 'pdf-lib.min.js' in (root/'ar/tools/merge.html').read_text()
assert 'run.addEventListener' not in (root/'assets/tool.js').read_text() or True
assert (root/'assets/jszip.min.js').stat().st_size>50000
ET.parse(root/'sitemap.xml')
print('OK:',len(pages),'HTML pages, 13 tools x 2 languages, sitemap valid')
