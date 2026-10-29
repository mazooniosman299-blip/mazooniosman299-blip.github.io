#!/usr/bin/env python3
"""Collect attributed Arabic news metadata + publisher RSS thumbnails for OFUQ TV.
No copied full articles; broken feeds preserve the previous news dataset.
"""
from __future__ import annotations
import hashlib
import html
import json
import pathlib
import re
import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime

ROOT = pathlib.Path(__file__).resolve().parents[1] / "ofuq-tv"
DEST = ROOT / "news.json"
ARCHIVE = ROOT / "news-archive.json"
MRSS = "{http://search.yahoo.com/mrss/}"
FEEDS = [
    ("أخبار الأمم المتحدة", "world", "https://news.un.org/feed/subscribe/ar/news/all/rss.xml"),
    ("أخبار الأمم المتحدة", "region", "https://news.un.org/feed/subscribe/ar/news/region/middle-east/feed/rss.xml"),
    ("يورونيوز العربية", "world", "https://arabic.euronews.com/rss?format=mrss&level=theme&name=news"),
    ("يورونيوز العربية", "sports", "https://arabic.euronews.com/rss?format=mrss&level=theme&name=sport"),
    ("يورونيوز العربية", "technology", "https://arabic.euronews.com/rss?format=mrss&level=vertical&name=next"),
    ("يورونيوز العربية", "arts", "https://arabic.euronews.com/rss?format=mrss&level=vertical&name=culture"),
    ("يورونيوز العربية", "variety", "https://arabic.euronews.com/rss?format=mrss&level=vertical&name=travel"),
    ("يورونيوز العربية", "articles", "https://arabic.euronews.com/rss?format=mrss&level=vertical&name=green"),
]
ALLOWED = {"news.un.org", "www.news.un.org", "arabic.euronews.com"}
HTML_TAGS = re.compile(r"<[^>]+>")
UN_ID = re.compile(r"/(\d{5,12})(?:[/?#]|$)")

def clean(value, limit=300):
    return " ".join(html.unescape(HTML_TAGS.sub(" ", value or "")).split())[:limit]

def item_id(url):
    match = UN_ID.search(url) if "news.un.org" in url else None
    return match.group(1) if match else hashlib.sha256(url.encode("utf-8")).hexdigest()[:14]

def image_url(node):
    choices = []
    for tag in (MRSS+"thumbnail", MRSS+"content", "enclosure"):
        for element in node.findall(".//"+tag):
            uri = element.get("url", "")
            media_type = element.get("type", "")
            if tag == "enclosure" and media_type and not media_type.startswith("image/"):
                continue
            if uri:
                choices.append(uri)
    for uri in choices:
        try:
            parsed = urllib.parse.urlparse(uri)
            if parsed.scheme == "https" and parsed.hostname:
                return uri
        except ValueError:
            pass
    return ""

def fetch(source, section, url):
    req = urllib.request.Request(url, headers={"User-Agent": "OFUQ-NewsReader/2.0 (+source attribution)", "Accept": "application/rss+xml,application/xml,text/xml;q=0.9,*/*;q=0.5"})
    with urllib.request.urlopen(req, timeout=24) as response:
        raw = response.read(2_500_000)
    tree = ET.fromstring(raw)
    nodes = tree.findall(".//channel/item")
    if not nodes:
        nodes = tree.findall(".//{http://www.w3.org/2005/Atom}entry")
    items = []
    for node in nodes[:45]:
        title = clean(node.findtext("title") or node.findtext("{http://www.w3.org/2005/Atom}title"), 190)
        link = (node.findtext("link") or "").strip()
        if not link:
            element = node.find("{http://www.w3.org/2005/Atom}link")
            link = (element.get("href", "") if element is not None else "").strip()
        parsed = urllib.parse.urlparse(link)
        if parsed.path.startswith("/feed/view/ar/story/"):
            link = urllib.parse.urlunparse(parsed._replace(path=parsed.path.replace("/feed/view/ar/story/", "/ar/story/", 1)))
            parsed = urllib.parse.urlparse(link)
        if not title or parsed.scheme != "https" or parsed.hostname not in ALLOWED:
            continue
        raw_date = node.findtext("pubDate") or node.findtext("{http://www.w3.org/2005/Atom}updated") or ""
        try:
            date = parsedate_to_datetime(raw_date).astimezone(timezone.utc).isoformat()
        except (TypeError, ValueError, OverflowError):
            try:
                date = datetime.fromisoformat(raw_date.replace("Z", "+00:00")).astimezone(timezone.utc).isoformat()
            except ValueError:
                date = ""
        description = clean(node.findtext("description") or node.findtext("{http://www.w3.org/2005/Atom}summary"), 270)
        news_section = "articles" if section=="world" and re.match(r"^(دراسة|تقرير|تحليل|رأي|كيف |لماذا |هل |ماذا |كل ما|تعرف)",title) else section
        items.append({
            "id": item_id(link), "title": title, "url": link, "source": source,
            "section": news_section, "published_at": date, "excerpt": description,
            "image": image_url(node)
        })
    return items

def load(path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}

def main():
    collected = []
    counts = {}
    for source, section, url in FEEDS:
        try:
            records = fetch(source, section, url)
            counts[section] = counts.get(section, 0) + len(records)
            collected.extend(records)
            print(f"{section}: {len(records)} from {source}")
        except Exception as exc:
            print(f"RSS unavailable [{section}] {type(exc).__name__}: {str(exc)[:150]}")
    previous = load(DEST)
    archived = load(ARCHIVE)
    if not collected:
        print("No source data succeeded: keep published news unchanged.")
        return
    by_url = {}
    for item in collected:
        older = by_url.get(item["url"])
        if older is None or (not older.get("image") and item.get("image")):
            by_url[item["url"]] = item
    recent = sorted(by_url.values(), key=lambda x: x["published_at"], reverse=True)
    # Preserve a balanced set so sports, tech, arts and variety never disappear behind world news.
    chosen = []
    seen = set()
    for section in ["world", "region", "sports", "technology", "arts", "variety", "articles"]:
        for item in (x for x in recent if x["section"] == section):
            if item["url"] in seen: continue
            chosen.append(item); seen.add(item["url"])
            if sum(x["section"] == section for x in chosen) >= 24: break
    for item in recent:
        if len(chosen) >= 144: break
        if item["url"] not in seen: chosen.append(item);seen.add(item["url"])
    # Preserve old UN material in the archive, and never fabricate missing topic coverage.
    history = sorted(chosen + archived.get("items", []) + previous.get("items", []), key=lambda x:x.get("published_at", ""), reverse=True)
    archive, seen_archive = [], set()
    for item in history:
        if not isinstance(item, dict) or not isinstance(item.get("url"), str): continue
        if item["url"] in seen_archive:continue
        seen_archive.add(item["url"])
        item.setdefault("id", item_id(item["url"]))
        item.setdefault("section", "world")
        item.setdefault("image", "")
        item.setdefault("excerpt", "")
        archive.append(item)
        if len(archive) >= 800:break
    payload = {"source_note":"روابط وعناوين وصور مصغّرة من خلاصات الناشرين؛ المحتوى الكامل لدى المصدر.", "updated_at":datetime.now(timezone.utc).isoformat(),"items":chosen}
    if previous.get("items") != chosen:
        DEST.write_text(json.dumps(payload, ensure_ascii=False, indent=2)+"\n",encoding="utf-8")
        print(f"NEWS SAVED: {len(chosen)} stories; sections: {counts}; with images: {sum(bool(x.get('image')) for x in chosen)}")
    if archived.get("items") != archive:
        ARCHIVE.write_text(json.dumps({**payload,"items":archive},ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
        print(f"ARCHIVE SAVED: {len(archive)}")
if __name__=="__main__":
    main()
