#!/usr/bin/env python3
"""Strict OFUQ publish gate: tests only articles that will actually be rendered."""
import json
from collections import Counter
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]/"ofuq-tv"
raw_news=json.loads((ROOT/"news.json").read_text(encoding="utf-8"))["items"]
full=json.loads((ROOT/"full-articles.json").read_text(encoding="utf-8"))
clips=json.loads((ROOT/"report-clips.json").read_text(encoding="utf-8"))["clips"]
sections=("world","sudan","region","sports","technology","arts","variety")
# The homepage renderer filters out unlicensed RSS briefs; keep only these.
visible=[x for x in raw_news if x.get("full_article") is True and x.get("id") in full]
hidden=len(raw_news)-len(visible)
totals=Counter(x.get("section") for x in visible)
photos=Counter(x.get("section") for x in visible if x.get("image"))
issues=[]
print("REAL ON-SITE FULL NEWS BY SECTION (article count, photo count):")
for section in sections:
    print(section,totals[section],photos[section])
print("Total licensed candidates",len(visible),"Hidden RSS summary records",hidden)
print("Global Voices full-text archive:",len(full))
for section,min_count in {"sudan":2,"world":100,"region":20,"sports":3,"technology":20,"arts":10,"variety":5}.items():
    if totals[section]<min_count:issues.append(f"Insufficient full-length reporting for {section}: {totals[section]} / {min_count}")
for n in visible:
    item=full.get(n["id"],{})
    if not (item.get("approved") is True and item.get("rights")=="licensed" and
            item.get("license")=="CC BY 3.0" and item.get("original_url")==n.get("url") and
            item.get("author") and len(item.get("paragraphs",[]))>=5 and item.get("word_count",0)>=220):
        issues.append("Article text rights or completeness not confirmed: "+n["id"])
        if len(issues)>75:break
    if not (n.get("image") and item.get("image") and
            item.get("image_rights") in ("licensed","original","public_domain") and
            item.get("image_creator") and item.get("image_license_url")):
        # The image being returned by an RSS or OG URL is not a reuse grant.
        issues.append("Publisher photograph needs item-level creator and reuse license: "+n["id"])
        if len(issues)>75:break
for section in sections:
    if photos[section] != totals[section]:
        issues.append(f"Some {section} full stories have no authentic publisher photograph")
if any(not x.get("date","").startswith("2026-") for x in clips):
    issues.append("Report footage must be original material recorded during 2026")
if len(clips)<2:issues.append("Insufficient dated video footage")
for issue in issues:print("PUBLICATION BLOCKER:",issue)
if issues:raise SystemExit(1)
print("PUBLISH GATE PASS — all visible articles have complete reusable text and item-level photo evidence")
