#!/usr/bin/env python3
"""Update only attributed headlines from official source RSS feeds.
No copying article bodies or images, no AI-generated breaking news."""
from __future__ import annotations
import json
import html
import pathlib
import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime

ROOT = pathlib.Path(__file__).resolve().parents[1]
DEST = ROOT / "ofuq-tv" / "news.json"
ARCHIVE = ROOT / "ofuq-tv" / "news-archive.json"
FEEDS = [
    ("أخبار الأمم المتحدة", "https://news.un.org/feed/subscribe/ar/news/all/rss.xml"),
    ("أخبار الأمم المتحدة — الشرق الأوسط", "https://news.un.org/feed/subscribe/ar/news/region/middle-east/feed/rss.xml"),
]

def collect(source, address):
    req = urllib.request.Request(address, headers={"User-Agent": "OfuqTV-RSS-Reader/1.0 (public news links)"})
    with urllib.request.urlopen(req, timeout=20) as response:
        raw = response.read(1_500_000)
    root = ET.fromstring(raw)
    items = []
    for node in root.findall(".//channel/item")[:30]:
        title = html.unescape(" ".join((node.findtext("title") or "").split()))[:180]
        url = (node.findtext("link") or "").strip()
        parsed = urllib.parse.urlparse(url)
        if parsed.path.startswith("/feed/view/ar/story/"):
            canonical_path = parsed.path.replace("/feed/view/ar/story/", "/ar/story/", 1)
            url = urllib.parse.urlunparse(parsed._replace(path=canonical_path))
            parsed = urllib.parse.urlparse(url)
        if not title or parsed.scheme != "https" or parsed.hostname not in {"news.un.org", "www.news.un.org"}:
            continue
        raw_date = node.findtext("pubDate") or ""
        published = ""
        if raw_date:
            try:
                published = parsedate_to_datetime(raw_date).astimezone(timezone.utc).isoformat()
            except (TypeError, ValueError, OverflowError):
                pass
        items.append({"title": title, "url": url, "source": source, "published_at": published})
    return items

def main():
    all_items = []
    for source, address in FEEDS:
        try:
            chunk = collect(source, address)
            print(f"{source}: {len(chunk)} headlines")
            all_items.extend(chunk)
        except Exception as ex:
            print(f"Feed temporarily unavailable: {type(ex).__name__}: {ex}")
    seen = set()
    out = []
    for item in sorted(all_items, key=lambda d:d["published_at"], reverse=True):
        key = (item["title"], item["url"])
        if key in seen:
            continue
        seen.add(key)
        out.append(item)
        if len(out) >= 12:
            break
    if not out:
        print("No verified source records: preserve existing file.")
        return
    old = {}
    if DEST.exists():
        try:
            old = json.loads(DEST.read_text(encoding="utf8"))
        except (OSError, ValueError):
            pass
    old_archive = {}
    if ARCHIVE.exists():
        try:
            old_archive = json.loads(ARCHIVE.read_text(encoding="utf8"))
        except (OSError, ValueError):
            pass
    # Preserve permanent story links when items rotate out of the 12 latest.
    combined = out + old_archive.get("items", []) + old.get("items", [])
    archive = []
    visited = set()
    for item in sorted(combined, key=lambda d: d.get("published_at", ""), reverse=True):
        if not isinstance(item, dict):
            continue
        key = item.get("url")
        if not isinstance(key, str) or key in visited:
            continue
        visited.add(key)
        archive.append(item)
        if len(archive) >= 500:
            break
    note = "عناوين وروابط كما نشرها المصدر؛ ليست نشرة أُفُق المحررة."
    if old.get("items") != out:
        result = {"source_note": note, "updated_at": datetime.now(timezone.utc).isoformat(), "items": out}
        DEST.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
        print(f"Updated {DEST}: {len(out)} headlines")
    if old_archive.get("items") != archive:
        archived = {"source_note": note, "updated_at": datetime.now(timezone.utc).isoformat(), "items": archive}
        ARCHIVE.write_text(json.dumps(archived, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
        print(f"Updated {ARCHIVE}: {len(archive)} retained stories")
    if old.get("items") == out and old_archive.get("items") == archive:
        print("No news changes; skip commit.")

if __name__ == "__main__":
    main()
