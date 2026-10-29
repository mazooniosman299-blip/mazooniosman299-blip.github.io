#!/usr/bin/env python3
"""Read-only verification of OFUQ sitemap and modern Arabic news pipeline."""
import ast
import json
import pathlib
import re
import xml.etree.ElementTree as ET

ROOT = pathlib.Path(__file__).resolve().parents[1]
script = ROOT / "scripts" / "update_ofuq_news.py"
ast.parse(script.read_text(encoding="utf-8"))
base = ROOT / "ofuq-tv"
archive = json.loads((base / "news-archive.json").read_text(encoding="utf-8"))
recent = json.loads((base / "news.json").read_text(encoding="utf-8"))
root = ET.parse(base / "sitemap.xml").getroot()
ns = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
urls = {e.text for e in root.findall(".//sm:loc", ns)}
prefix = "https://mazooniosman299-blip.github.io/ofuq-tv/"
if prefix not in urls:
    raise AssertionError("Homepage is missing from sitemap")
for item in recent.get("items", []):
    item_id = str(item.get("id") or "")
    if not re.fullmatch(r"[a-f0-9]{14}|[0-9]{5,12}", item_id):
        raise AssertionError(f"Invalid article ID {item_id!r}")
    target = prefix + "story.html?id=" + item_id
    if target not in urls:
        raise AssertionError(f"Published article missing in sitemap: {item_id}")
    if not any(a.get("id") == item_id for a in archive.get("items", [])):
        raise AssertionError(f"Article missing from archive: {item_id}")
assert len(urls) >= len(recent.get("items", [])) + 3
print(f"PASS: sitemap contains {len(urls)} valid routes; {len(recent['items'])} current articles and source archive are consistent.")
