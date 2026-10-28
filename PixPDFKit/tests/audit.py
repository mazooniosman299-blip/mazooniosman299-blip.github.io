"""Dependency-free structural audit of the PixPDFKit source before publishing."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit
import re
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
ORIGIN = "https://mazooniosman299-blip.github.io/PixPDFKit/"
PRIMARY = "https://mazooniosman299-blip-github-io.pages.dev/"

class DocumentParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.title = False
        self.h1 = 0
        self.references = []
        self.canonical = None
        self.publisher = False
        self.scripts = []
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "title":
            self.title = True
        if tag == "h1":
            self.h1 += 1
        if tag == "meta" and attrs.get("name") == "google-adsense-account":
            self.publisher = attrs.get("content") == "ca-pub-5086201923236113"
        if tag == "link" and attrs.get("rel") == "canonical":
            self.canonical = attrs.get("href")
        if tag == "script" and attrs.get("src"):
            self.scripts.append(attrs["src"])
        for key in ("href", "src"):
            if attrs.get(key):
                self.references.append(attrs[key])

def page_for_url(url):
    if not url.startswith(ORIGIN):
        raise AssertionError(f"Outside source sitemap: {url}")
    rel = url[len(ORIGIN):]
    file = ROOT / rel
    if rel.endswith("/"):
        file = file / "index.html"
    if not file.exists():
        raise AssertionError(f"Missing sitemap page: {url}")
    return file

urls = [v.text for v in ET.parse(ROOT / "sitemap.xml").getroot().findall(".//{*}loc")]
assert len(urls) == 50 and len(set(urls)) == 50, "Expected 50 distinct sitemap URLs"
listed = {page_for_url(url).resolve() for url in urls}
assert len(listed) == 50

pages = list(ROOT.rglob("*.html"))
assert len(pages) >= 52, f"Too few HTML pages: {len(pages)}"
checked_links = 0
for page in pages:
    relative = page.relative_to(ROOT).as_posix()
    parser = DocumentParser()
    text = page.read_text(encoding="utf-8")
    parser.feed(text)
    assert parser.title, f"Missing title: {relative}"
    if page.name not in ("404.html", "index.html"):
        assert parser.h1 == 1, f"Expected one H1: {relative}"
    assert parser.publisher, f"Publisher verification missing: {relative}"
    if page.resolve() in listed:
        assert parser.canonical and parser.canonical.startswith(PRIMARY), f"Incorrect primary canonical: {relative}: {parser.canonical}"
    if "/tools/" in relative:
        assert 'id="toolApp"' in text, f"PDF tool widget missing: {relative}"
        assert any("pdf-lib.min.js" in ref for ref in parser.scripts), f"PDF library missing: {relative}"
        assert any("tool.js" in ref for ref in parser.scripts), f"PDF tool script missing: {relative}"
    for ref in parser.references:
        if ref.startswith(("#", "http:", "https:", "//", "data:", "mailto:", "tel:", "javascript:")):
            continue
        parsed = urlsplit(ref)
        if not parsed.path:
            continue
        target = (ROOT / unquote(parsed.path).lstrip("/")) if parsed.path.startswith("/") else (page.parent / unquote(parsed.path))
        target = target.resolve()
        assert target.is_relative_to(ROOT.resolve()), f"Reference escapes site: {relative}: {ref}"
        if target.is_dir():
            target /= "index.html"
        if not target.exists() and not target.suffix:
            target = target.with_suffix(".html")
        assert target.exists(), f"Broken internal reference: {relative} -> {ref}"
        checked_links += 1

for language in ("ar", "en"):
    assert len(list((ROOT / language / "tools").glob("*.html"))) == 13, f"{language}: expected 13 PDF tools"
assert (ROOT / "assets" / "tool.js").stat().st_size > 8000
assert (ROOT / "assets" / "jszip.min.js").stat().st_size > 50000
assert (ROOT / "manifest.webmanifest").exists()
assert (ROOT / "robots.txt").exists()
print(f"PASS: {len(urls)} sitemap pages; {len(pages)} HTML files; {checked_links} local references; 13 PDF tools per language")
