#!/usr/bin/env python3
"""Curate short, time-limited breaking alerts from an official first-party RSS headline.
Do not manufacture breaking status from ordinary headlines, copy articles or images.
Existing editor-approved alerts can be retained until expiry.
"""
from __future__ import annotations

import datetime as dt
import html
import json
import pathlib
import re
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "ofuq-tv" / "breaking.json"
URLS = [
    "https://news.un.org/feed/subscribe/ar/news/all/rss.xml",
    "https://news.un.org/feed/subscribe/ar/news/region/middle-east/feed/rss.xml",
]
ALLOWED = {"news.un.org", "www.news.un.org", "www.ungeneva.org"}
PREFIX = re.compile(r"^\s*(?:(?:خبر\s+)?عاجل)\s*[:：\-–—]\s*", re.I)


def canonical(url: str) -> str | None:
    try:
        p = urllib.parse.urlparse(url)
        if p.scheme != "https" or p.hostname not in ALLOWED:
            return None
        path = p.path
        if path.startswith("/feed/view/ar/story/"):
            path = path.replace("/feed/view/ar/story/", "/ar/story/", 1)
        return urllib.parse.urlunparse(p._replace(path=path, fragment=""))
    except (TypeError, ValueError):
        return None


def date_parse(s: str) -> dt.datetime | None:
    try:
        if "T" in s:
            d = dt.datetime.fromisoformat(s.replace("Z", "+00:00"))
        else:
            d = parsedate_to_datetime(s)
        if d.tzinfo is None:
            return None
        return d.astimezone(dt.timezone.utc)
    except (TypeError, ValueError, OverflowError):
        return None


def active(item: dict, now: dt.datetime) -> bool:
    if not isinstance(item, dict) or item.get("signal") not in (
        "explicit_official_alert", "editor_approved"
    ):
        return False
    if not canonical(item.get("source_url", "")):
        return False
    published = date_parse(item.get("published_at", ""))
    expiry = date_parse(item.get("expires_at", ""))
    if published is None or expiry is None:
        return False
    return (
        len(item.get("headline", "")) >= 8
        and now - dt.timedelta(minutes=1) <= expiry
        and dt.timedelta(0) <= now - published <= dt.timedelta(hours=4)
        and dt.timedelta(0) < expiry - published <= dt.timedelta(hours=4)
    )


def source_alerts(now: dt.datetime) -> list[dict]:
    alerts = []
    for feed in URLS:
        try:
            req = urllib.request.Request(feed, headers={"User-Agent": "OfuqTV-BreakingAlerts/1.0"})
            with urllib.request.urlopen(req, timeout=20) as response:
                root = ET.fromstring(response.read(800_000))
            for node in root.findall(".//channel/item")[:45]:
                raw_title = html.unescape(" ".join((node.findtext("title") or "").split()))
                if not PREFIX.match(raw_title):
                    continue
                headline = PREFIX.sub("", raw_title, count=1).strip()
                if not (8 <= len(headline) <= 210):
                    continue
                url = canonical((node.findtext("link") or "").strip())
                when = date_parse(node.findtext("pubDate") or "")
                if url is None or when is None or not (dt.timedelta(0) <= now - when <= dt.timedelta(hours=3)):
                    continue
                expiry = when + dt.timedelta(hours=3)
                alerts.append({
                    "headline": headline,
                    "source_url": url,
                    "published_at": when.isoformat(),
                    "expires_at": expiry.isoformat(),
                    "signal": "explicit_official_alert",
                    "source_name": "أخبار الأمم المتحدة",
                })
        except (OSError, ValueError, ET.ParseError) as exc:
            print(f"Official alert feed unavailable, will not fabricate data: {type(exc).__name__}: {exc}")
    return alerts


def main() -> None:
    now = dt.datetime.now(dt.timezone.utc)
    old = {}
    if OUTPUT.exists():
        try:
            old = json.loads(OUTPUT.read_text(encoding="utf8"))
        except (OSError, json.JSONDecodeError):
            pass
    previous = [i for i in old.get("items", []) if active(i, now) and i["signal"] == "editor_approved"]
    alerts = source_alerts(now)
    unique = {}
    for a in previous + alerts:
        if active(a, now):
            unique[a["source_url"]] = a
    desired = sorted(unique.values(), key=lambda x:x["published_at"], reverse=True)[:3]
    if desired == old.get("items", []):
        print("No breaking news changes.")
        return
    data = {
        "updated_at": now.isoformat(),
        "source_policy": "Display only a fresh, explicitly urgent official headline or an editorially approved alert, automatically expiring within 4 hours.",
        "items": desired,
    }
    OUTPUT.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
    print(f"Breaking-news file updated: {len(desired)} active alerts.")


if __name__ == "__main__":
    main()
