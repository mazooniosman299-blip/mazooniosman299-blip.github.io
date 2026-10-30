#!/usr/bin/env python3
"""Conservative, read-only publication gate. Do not confuse media URLs with reuse rights."""
import json
from pathlib import Path
from collections import Counter
ROOT=Path(__file__).resolve().parents[1]/"ofuq-tv"
news=json.loads((ROOT/"news.json").read_text(encoding="utf-8"))["items"]
full=json.loads((ROOT/"full-articles.json").read_text(encoding="utf-8"))
clips=json.loads((ROOT/"report-clips.json").read_text(encoding="utf-8"))["clips"]
sections=("world","sudan","region","sports","technology","arts","variety","articles")
totals=Counter(x.get("section") for x in news)
complete=Counter(x.get("section") for x in news if x.get("full_article") and x.get("id") in full)
# "articles" is a virtual site filter that includes all licensed full texts.
complete["articles"]=sum(bool(x.get("full_article") and x.get("id") in full) for x in news)
photos=Counter(x.get("section") for x in news if x.get("image"))
# Full-article filter spans other topical sections; don't undercount its source photos.
article_filter=[x for x in news if x.get("full_article") or x.get("section")=="articles"]
totals["articles"]=len(article_filter)
photos["articles"]=sum(bool(x.get("image")) for x in article_filter)
print("SECTION AUDIT (total, legally complete, source-image URL)")
for section in sections:
    print(f"{section}: {totals[section]}, {complete[section]}, {photos[section]}")
print("SCHEDULE: primary 15-minute Cron / hourly secondary; a scheduled run is not proof of successful publication.")
print("MEDIA VIDEO YEARS:",sorted(set(x.get("date","")[:4] for x in clips)))
unknown_source_images=[x for x in news if x.get("image") and not (
    x.get("image_license_url") and x.get("image_creator") and x.get("image_rights") in ("licensed","original","public_domain"))]
unverified_full_images=[x for x in full.values() if x.get("image") and not (
    x.get("image_license_url") and x.get("image_creator") and x.get("image_rights") in ("licensed","original","public_domain"))]
issues=[]
if any(totals[s]<1 for s in sections): issues.append("Empty news sections: "+", ".join(s for s in sections if totals[s]<1))
if any(complete[s]<1 for s in sections): issues.append("No licensed complete article in: "+", ".join(s for s in sections if complete[s]<1))
if any(photos[s]!=totals[s] for s in sections): issues.append("Not all stories have per-story photographs")
if unknown_source_images: issues.append(f"{len(unknown_source_images)} linked publisher images lack explicit individually documented reuse rights")
if unverified_full_images: issues.append(f"{len(unverified_full_images)} full-story images lack creator and item-level photo license metadata")
if any(not x.get("date","").startswith("2026-") for x in clips):issues.append("Footage older than 2026")
if len(clips)<2:issues.append("Fewer than two footage clips")
for issue in issues:print("PUBLICATION BLOCKER:",issue)
if issues:raise SystemExit(1)
print("PUBLICATION GATE PASSED: metadata coverage only; not a legal opinion.")
