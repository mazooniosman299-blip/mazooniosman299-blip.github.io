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
from html.parser import HTMLParser
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from concurrent.futures import ThreadPoolExecutor, as_completed

ROOT = pathlib.Path(__file__).resolve().parents[1] / "ofuq-tv"
DEST = ROOT / "news.json"
ARCHIVE = ROOT / "news-archive.json"
FULL = ROOT / "full-articles.json"
SITEMAP = ROOT / "sitemap.xml"
BASE = "https://mazooniosman299-blip.github.io/ofuq-tv/"
MRSS = "{http://search.yahoo.com/mrss/}"
SOURCE_CONFIG = ROOT / "news-sources.json"
SOURCE_WHITELIST = {"world", "region", "sports", "technology", "arts", "variety", "articles", "sudan"}
def configured_feeds():
    """Every feed is independently allowlisted and can fail without stopping others."""
    data = json.loads(SOURCE_CONFIG.read_text(encoding="utf-8"))
    feeds = []
    for config in data.get("sources", []):
        if config.get("enabled") is False or (config.get("requiresCommercialLicense") and not config.get("commercialLicenseApproved")):
            continue
        url = config.get("url", "")
        parsed = urllib.parse.urlparse(url)
        hosts = [h.lower() for h in config.get("hosts", []) if isinstance(h, str)]
        if (parsed.scheme != "https" or not parsed.hostname or
                config.get("section") not in SOURCE_WHITELIST or not hosts or
                not isinstance(config.get("name"), str)):
            print("Skipped invalid RSS source entry")
            continue
        feeds.append((config["name"], config["section"], url, hosts))
    return feeds

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

class SocialImageParser(HTMLParser):
    """Read photo URL from a publisher's own article link-preview metadata."""
    def __init__(self):
        super().__init__()
        self.urls = []
    def handle_starttag(self, tag, attrs):
        if tag.lower() != "meta": return
        values = dict((k.lower(), v or "") for k, v in attrs if k)
        kind = (values.get("property") or values.get("name") or "").lower()
        if kind in ("og:image", "og:image:url", "twitter:image"):
            self.urls.append(values.get("content", ""))

def recover_publisher_image(item, trusted_hosts):
    """Enhance feed thumbnails without taking or hosting any publisher image."""
    try:
        url = item["url"]
        parsed = urllib.parse.urlparse(url)
        if parsed.scheme != "https" or not any(parsed.hostname == h or parsed.hostname.endswith("." + h) for h in trusted_hosts):
            return ""
        request = urllib.request.Request(url, headers={
            "User-Agent":"Mozilla/5.0 (compatible; OFUQ-NewsLinkPreview/1.0)",
            "Accept":"text/html,application/xhtml+xml"})
        with urllib.request.urlopen(request, timeout=9) as response:
            final = urllib.parse.urlparse(response.geturl())
            if final.scheme != "https" or not any(final.hostname == h or final.hostname.endswith("." + h) for h in trusted_hosts):
                return ""
            if "html" not in response.headers.get("Content-Type","").lower():
                return ""
            page = response.read(380_000).decode("utf-8","replace")
        parser = SocialImageParser()
        parser.feed(page)
        for image in parser.urls:
            absolute = urllib.parse.urljoin(url, html.unescape(image))
            image_url = urllib.parse.urlparse(absolute)
            if image_url.scheme == "https" and image_url.hostname and not image_url.username and not image_url.password:
                return absolute
    except (OSError, ValueError, UnicodeError, TimeoutError):
        pass
    return ""

def backfill_photos(items, earlier_items):
    """Try the official article's og:image for stories with empty RSS image."""
    saved = {x.get("url"):x.get("image") for x in earlier_items if isinstance(x,dict) and x.get("image")}
    trusted = set()
    for _,_,_,hosts in configured_feeds():
        trusted.update(hosts)
    missing = []
    for item in items:
        if not item.get("image") and saved.get(item.get("url")):
            item["image"] = saved[item["url"]]
        if not item.get("image") and item.get("url","").startswith("https:"):
            missing.append(item)
    if not missing:return
    fetched = 0
    with ThreadPoolExecutor(max_workers=6) as pool:
        jobs = {pool.submit(recover_publisher_image,item,trusted):item for item in missing[:72]}
        for job in as_completed(jobs):
            image = job.result()
            if image:
                jobs[job]["image"] = image
                fetched += 1
    print(f"PUBLISHER IMAGE RECOVERY: {fetched}/{min(len(missing),72)} social preview URLs",flush=True)

def fetch(source, section, url, allowed_hosts):
    req = urllib.request.Request(url, headers={"User-Agent": "OFUQ-NewsReader/2.0 (+source attribution)", "Accept": "application/rss+xml,application/xml,text/xml;q=0.9,*/*;q=0.5"})
    with urllib.request.urlopen(req, timeout=24) as response:
        raw = response.read(2_500_000)
    tree = ET.fromstring(raw)
    nodes = tree.findall(".//channel/item")
    if not nodes:
        nodes = tree.findall(".//{http://www.w3.org/2005/Atom}entry")
    if not nodes:
        nodes = tree.findall(".//{http://purl.org/rss/1.0/}item")
    items = []
    for node in nodes[:45]:
        title = clean(node.findtext("title") or node.findtext("{http://www.w3.org/2005/Atom}title") or node.findtext("{http://purl.org/rss/1.0/}title"), 190)
        link = (node.findtext("link") or node.findtext("{http://purl.org/rss/1.0/}link") or "").strip()
        if not link:
            element = node.find("{http://www.w3.org/2005/Atom}link")
            link = (element.get("href", "") if element is not None else "").strip()
        parsed = urllib.parse.urlparse(link)
        if parsed.path.startswith("/feed/view/ar/story/"):
            link = urllib.parse.urlunparse(parsed._replace(path=parsed.path.replace("/feed/view/ar/story/", "/ar/story/", 1)))
            parsed = urllib.parse.urlparse(link)
        if not title or parsed.scheme != "https" or not parsed.hostname or not any(parsed.hostname == h or parsed.hostname.endswith("." + h) for h in allowed_hosts):
            continue
        raw_date = node.findtext("pubDate") or node.findtext("{http://www.w3.org/2005/Atom}updated") or ""
        try:
            date = parsedate_to_datetime(raw_date).astimezone(timezone.utc).isoformat()
        except (TypeError, ValueError, OverflowError):
            try:
                date = datetime.fromisoformat(raw_date.replace("Z", "+00:00")).astimezone(timezone.utc).isoformat()
            except ValueError:
                date = ""
        description = clean(node.findtext("description") or node.findtext("{http://www.w3.org/2005/Atom}summary") or node.findtext("{http://purl.org/rss/1.0/}description"), 270)
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

def update_sitemap(items):
    """Rebuild the index from real archived article IDs, not stale hardcoded URLs."""
    pages = [("", ""), ("editorial.html", ""), ("privacy.html", "")]
    seen_ids = set()
    for story in items:
        ident = str(story.get("id") or item_id(story.get("url", "")))
        if not re.fullmatch(r"[a-f0-9]{14}|[0-9]{5,12}", ident) or ident in seen_ids:
            continue
        seen_ids.add(ident)
        updated = (story.get("published_at") or "")[:10]
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", updated):
            updated = ""
        pages.append(("story.html?id=" + ident, updated))
    lines = ['<?xml version="1.0" encoding="UTF-8"?>',
             '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for route, lastmod in pages:
        lines.append("  <url><loc>" + BASE + route + "</loc>" +
                     ("<lastmod>" + lastmod + "</lastmod>" if lastmod else "") + "</url>")
    lines.append("</urlset>")
    xml = "\n".join(lines) + "\n"
    if not SITEMAP.exists() or SITEMAP.read_text(encoding="utf-8") != xml:
        SITEMAP.write_text(xml, encoding="utf-8")
        print(f"SITEMAP SAVED: {len(pages)} real URLs")

def licensed_cards():
    """Restore all fully licensed stories to listings after each RSS refresh.

    External RSS feeds provide only summaries; this function exposes only the
    separately stored complete works that were explicitly approved and credited.
    """
    out = []
    for sid, article in load(FULL).items():
        if not isinstance(article, dict) or article.get("approved") is not True:
            continue
        if article.get("rights") != "licensed" or article.get("license") != "CC BY 3.0":
            continue
        url = article.get("original_url", "")
        if not re.fullmatch(r"[a-f0-9]{14}", sid) or not url.startswith("https://ar.globalvoices.org/"):
            continue
        blocks = article.get("paragraphs") or []
        if len(blocks) < 5 or article.get("word_count", 0) < 220:
            continue
        intro = next((b.get("text", "") for b in blocks if isinstance(b, dict) and b.get("type") == "p"), "")
        out.append({
            "id": sid, "title": article.get("title", ""), "url": url,
            "source": "الأصوات العالمية", "section": article.get("section") if article.get("section") in {"sports","technology","arts","sudan","region","variety"} else "articles",
            "published_at": article.get("published_at", ""),
            "excerpt": intro[:260], "image": article.get("image", ""), "full_article": True
        })
    return out

def main():
    collected = []
    counts = {}
    with ThreadPoolExecutor(max_workers=6) as executor:
        pending = {executor.submit(fetch, source, section, url, hosts): (source, section)
                   for source, section, url, hosts in configured_feeds()}
        for future in as_completed(pending):
            source, section = pending[future]
            try:
                records = future.result()
                counts[section] = counts.get(section, 0) + len(records)
                collected.extend(records)
                print(f"{section}: {len(records)} from {source}", flush=True)
            except Exception as exc:
                print(f"RSS unavailable [{section}] {source} {type(exc).__name__}: {str(exc)[:120]}", flush=True)
    previous = load(DEST)
    archived = load(ARCHIVE)
    if len(collected) < 10:
        print("Insufficient fresh RSS records: keep published news unchanged.")
        return
    by_url = {}
    for item in collected:
        older = by_url.get(item["url"])
        # Prefer specific editorial categories over generic world for the same URL.
        specialized = item["section"] in {"sports", "technology", "arts", "variety", "articles", "region"}
        existing_generic = older is not None and older.get("section") == "world"
        if older is None or (existing_generic and specialized):
            by_url[item["url"]] = item
        elif not older.get("image") and item.get("image"):
            older["image"] = item["image"]
    # Feeds such as Darfur24 omit media:thumbnail while their articles expose
    # actual per-story og:image. Recover those rather than a generic site logo.
    previous = load(DEST)
    archived = load(ARCHIVE)
    backfill_photos(list(by_url.values()),previous.get("items",[])+archived.get("items",[]))
    recent = sorted(by_url.values(), key=lambda x: x["published_at"], reverse=True)
    # Global Arabic news plus dedicated Sudan coverage, preserving country-only reports.
    # Classified by evidence in titles/topics; no fabricated location tags.
    sudan_terms = re.compile(r"السودان|سوداني|دارفور|الخرطوم|الفاشر|كردفان|أمدرمان|أم درمان|بورتسودان|نيالا|القضارف|عطبرة|سنار|نهر النيل|الجزيرة السودانية|الجنينة|الضعين|Sudan|Darfur|Khartoum|Kordofan|Omdurman|Nyala", re.I)
    for item in recent:
        if sudan_terms.search(item.get("title", "")) or item.get("source") in {"دارفور24","Sudan Tribune"}:
            item["section"] = "sudan"
    # Balanced editorial feed: cap items per publisher, not just by section, so no network dominates.
    chosen, seen = [], set()
    per_section, per_publisher = {}, {}
    def include(item):
        url, source, section = item["url"], item["source"], item["section"]
        if url in seen or per_section.get(section, 0) >= 36 or per_publisher.get(source, 0) >= 26:
            return False
        chosen.append(item); seen.add(url)
        per_section[section] = per_section.get(section, 0) + 1
        per_publisher[source] = per_publisher.get(source, 0) + 1
        return True
    for section in ["sudan", "world", "region", "sports", "technology", "arts", "variety", "articles"]:
        matching = [x for x in recent if x["section"] == section]
        # First take distinct publishers within each section.
        source_seen = set()
        for item in matching:
            if item["source"] not in source_seen and include(item):
                source_seen.add(item["source"])
        for item in matching:
            if sum(x["section"] == section for x in chosen) >= 24:
                break
            include(item)
    for item in recent:
        if len(chosen) >= 240:
            break
        include(item)
    # RSS may omit older long-form reports. Keep the CC BY complete stories
    # discoverable even when newer short headlines replace the feed window.
    full_items = licensed_cards()
    backfill_photos(full_items, chosen + archived.get("items", []) + previous.get("items", []))
    by_story = {x["url"]: x for x in chosen}
    for article in full_items:
        by_story[article["url"]] = article
    chosen = sorted(by_story.values(), key=lambda x: x.get("published_at", ""), reverse=True)

    # Preserve old UN material in the archive, and never fabricate missing topic coverage.
    history = sorted((x for x in full_items + chosen + archived.get("items", []) + previous.get("items", []) if x.get("source") not in {"BBC عربي"}), key=lambda x:x.get("published_at", ""), reverse=True)
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
        if len(archive) >= 1200:break
    payload = {"source_note":"روابط وعناوين وصور مصغّرة من خلاصات الناشرين؛ المحتوى الكامل لدى المصدر.", "updated_at":datetime.now(timezone.utc).isoformat(),"items":chosen}
    if previous.get("items") != chosen:
        DEST.write_text(json.dumps(payload, ensure_ascii=False, indent=2)+"\n",encoding="utf-8")
        print(f"NEWS SAVED: {len(chosen)} stories; sections: {counts}; with images: {sum(bool(x.get('image')) for x in chosen)}")
    if archived.get("items") != archive:
        ARCHIVE.write_text(json.dumps({**payload,"items":archive},ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
        print(f"ARCHIVE SAVED: {len(archive)}")
    update_sitemap(archive)
if __name__=="__main__":
    main()
