"""Check PixPDFKit completeness and content contract without third-party dependencies."""
from pathlib import Path
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
urls = [el.text for el in ET.parse(ROOT / "sitemap.xml").getroot().findall(".//{*}loc")]
assert len(urls) == 50 and len(set(urls)) == 50

for lang in ("ar", "en"):
    assert (ROOT / lang / "index.html").exists()
    tools = sorted((ROOT / lang / "tools").glob("*.html"))
    assert len(tools) == 13, f"{lang}: expected 13 tools, found {len(tools)}"
    for path in tools:
        html = path.read_text(encoding="utf-8")
        assert "<title>" in html and "PixPDFKit" in html, path
        assert 'id="toolApp"' in html, path
        assert 'id="form"' in html, path
        assert 'id="download"' in html, path
        assert "pdf-lib.min.js" in html, path
        assert "assets/tool.js" in html, path
    guide_index = ROOT / lang / "guides" / "index.html"
    assert guide_index.exists()
    for slug in ("pdf-under-2mb", "job-application-pdf"):
        assert (ROOT / lang / "guides" / f"{slug}.html").exists()
        assert f"{slug}.html" in guide_index.read_text(encoding="utf-8"), f"{lang}: missing guide link {slug}"

script = (ROOT / "assets" / "tool.js").read_text(encoding="utf-8")
for snippet in ("function blobDownload(", "async function main()", "form.addEventListener('submit'", "download.href=objectUrl"):
    assert snippet in script, f"PDF tool script contract missing: {snippet}"
assert (ROOT / "assets" / "jszip.min.js").stat().st_size > 50000
print("PASS: 50 sitemap URLs, 13 tools per language, guide links, PDF processing and download contract")
