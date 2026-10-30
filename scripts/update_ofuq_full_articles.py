#!/usr/bin/env python3
"""Import complete, explicitly CC BY-licensed Arabic articles from Global Voices.
This job NEVER extracts full articles from publishers who only supply RSS summaries.
All text is attributed, images/embeds are omitted because their rights may differ.
"""
from __future__ import annotations
import hashlib
import html
import json
import pathlib
import re
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from html.parser import HTMLParser

ROOT = pathlib.Path(__file__).resolve().parents[1] / "ofuq-tv"
FULL = ROOT / "full-articles.json"
NEWS = ROOT / "news.json"
ARCHIVE = ROOT / "news-archive.json"
FEEDS = ("https://ar.globalvoices.org/feed/",)
LINK_HOST = "ar.globalvoices.org"
LICENCE = "https://creativecommons.org/licenses/by/3.0/"
CONTENT_NS = "{http://purl.org/rss/1.0/modules/content/}"
DC_NS = "{http://purl.org/dc/elements/1.1/}"
MAX_ARTICLES = 150
MIN_WORDS = 220
MIN_PARAGRAPHS = 5

class TextBlocks(HTMLParser):
    """Convert licensed HTML to safe plain-text article paragraphs and headings."""
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.blocks = []
        self.active = None
        self.parts = []
        self.skip = 0

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style", "iframe", "form", "svg"):
            self.skip += 1
            return
        if self.skip:
            return
        if tag in ("p", "h2", "h3", "blockquote") and self.active is None:
            self.active = "h2" if tag == "h2" else "h3" if tag == "h3" else "p"
            self.parts = []
        elif tag == "br" and self.active:
            self.parts.append(" ")

    def handle_endtag(self, tag):
        if tag in ("script", "style", "iframe", "form", "svg") and self.skip:
            self.skip -= 1
            return
        if self.skip:
            return
        if self.active and tag in ("p", "h2", "h3", "blockquote"):
            val = " ".join(html.unescape("".join(self.parts)).split())
            if len(val) >= 18:
                self.blocks.append({"type": self.active, "text": val[:7000]})
            self.active, self.parts = None, []

    def handle_data(self, text):
        if self.active and not self.skip:
            self.parts.append(text)

def words(text):
    return len(re.findall(r"\S+", text))

def valid_url(url):
    try:
        u = urllib.parse.urlparse(url)
        return u.scheme == "https" and u.hostname == LINK_HOST and u.path.startswith("/")
    except ValueError:
        return False

def load(path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}

def article_id(url):
    return hashlib.sha256(url.encode()).hexdigest()[:14]

def get_feed(url):
    request = urllib.request.Request(
        url, headers={"User-Agent": "OFUQTV-Licensed-News/1.0 (CC BY 3.0; attribution retained)",
                      "Accept": "application/rss+xml,application/xml,*/*;q=0.8"})
    with urllib.request.urlopen(request, timeout=35) as resp:
        xml_data = resp.read(7_000_000)
    return ET.fromstring(xml_data)

def section_for(title):
    if re.search(r"رياضة|كرة القدم|بطولة|أولمبي", title): return "sports"
    if re.search(r"تكنولوجيا|الإنترنت|الذكاء الاصطناعي|رقمي|تقنية", title): return "technology"
    if re.search(r"فن|موسيقى|سينما|ثقافة|فيلم|تراث", title): return "arts"
    if re.search(r"سودان|دارفور|الخرطوم|الفاشر", title): return "sudan"
    return "world"

def import_articles():
    data = []
    for url in FEEDS:
        root = get_feed(url)
        entries = root.findall(".//channel/item")
        print(f"Licensed Arabic feed: {url}; {len(entries)} entries", flush=True)
        for entry in entries[:35]:
            title = " ".join(html.unescape(entry.findtext("title") or "").split())[:180]
            link = (entry.findtext("link") or "").strip()
            author = " ".join((entry.findtext(DC_NS+"creator") or "").split())
            body = entry.findtext(CONTENT_NS+"encoded") or ""
            if not title or not author or not valid_url(link) or len(body) < 1300:
                continue
            parser = TextBlocks()
            parser.feed(body)
            blocks = parser.blocks
            plain = " ".join(b["text"] for b in blocks)
            if len(blocks) < MIN_PARAGRAPHS or words(plain) < MIN_WORDS:
                continue  # Never pass a publisher's excerpt off as a full article.
            raw_date = entry.findtext("pubDate") or ""
            try:
                date = parsedate_to_datetime(raw_date).astimezone(timezone.utc).isoformat()
            except (TypeError, ValueError, OverflowError):
                date = ""
            if not date:
                continue
            sid = article_id(link)
            article = {
                "id": sid, "title": title, "author": author, "source": "الأصوات العالمية",
                "original_url": link, "license": "CC BY 3.0", "license_url": LICENCE,
                "rights": "licensed", "approved": True,
                "transformation": "حُوّلت تنسيقات HTML إلى فقرات نصية وحُذفت الصور والتضمينات؛ لم يضف نص تحريري جديد.",
                "published_at": date, "paragraphs": blocks, "word_count": words(plain)
            }
            item = {
                "id": sid, "title": title, "url": link, "source": "الأصوات العالمية",
                "section": section_for(title), "published_at": date,
                "excerpt": next((b["text"][:260] for b in blocks if b["type"] == "p"), ""),
                "image": "", "full_article": True
            }
            data.append((item, article))
    return data

def main():
    try:
        imported = import_articles()
    except Exception as exc:
        print("LICENSED FEED FAILED; keep existing published content:", type(exc).__name__, str(exc)[:200])
        return  # Do not erase already verified and legally attributed articles.
    if not imported:
        print("NO COMPLETE LICENSED ARTICLES: no changes; check feed and its content:encoded support.")
        return
    existing_full = load(FULL)
    existing_news = load(NEWS)
    existing_archive = load(ARCHIVE)
    new_full = {k: v for k, v in existing_full.items() if isinstance(v, dict) and v.get("approved") and v.get("rights") in ("licensed", "original")}
    for item, article in imported:
        new_full[item["id"]] = article
    new_full = dict(sorted(new_full.items(), key=lambda row: row[1].get("published_at", ""), reverse=True)[:MAX_ARTICLES])
    present = set(new_full)
    valid_new = [item for item, _ in imported if item["id"] in present]
    def merge(items, limit):
        merged = []
        seen = set()
        for item in valid_new + items:
            if not isinstance(item, dict): continue
            ident = item.get("id")
            if not ident or ident in seen: continue
            seen.add(ident)
            merged.append(item)
        return sorted(merged, key=lambda x: x.get("published_at", ""), reverse=True)[:limit]
    current = merge(existing_news.get("items", []), 200)
    archive = merge(existing_archive.get("items", []), 850)
    for path, data in ((FULL, new_full),
                       (NEWS, {**existing_news, "items": current}),
                       (ARCHIVE, {**existing_archive, "items": archive})):
        value = json.dumps(data, ensure_ascii=False, indent=2) + "\n"
        if not path.exists() or path.read_text(encoding="utf-8") != value:
            path.write_text(value, encoding="utf-8")
    print(f"LICENSED COMPLETE ARTICLES: imported={len(imported)}, stored={len(new_full)}, latest={len(current)}, archive={len(archive)}", flush=True)

if __name__ == "__main__":
    main()
