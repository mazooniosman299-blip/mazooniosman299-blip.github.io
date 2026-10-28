#!/usr/bin/env python3
"""Reconstruct a backup of the public PaperMorrow static deployment for manual Netlify upload.
Not the editable Manus source. Does not deploy the package. Workaround is provisional.
"""
import concurrent.futures
import hashlib
import io
import re
import sys
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

HOST = "https://incredible-bublanina-eaae4f.netlify.app"
OUT = Path("PaperMorrow_Netlify_Complete_2026-10-28.zip")
USER_AGENT = {"User-Agent": "Mozilla/5.0 (compatible; PaperMorrowArchiver/1.0)"}

def fetch(path):
    last = None
    for attempt in range(3):
        try:
            request = urllib.request.Request(HOST + path, headers=USER_AGENT)
            with urllib.request.urlopen(request, timeout=30) as response:
                if response.status != 200:
                    raise RuntimeError(f"HTTP {response.status}: {path}")
                return response.read()
        except Exception as err:
            last = err
            time.sleep(0.4 * (attempt + 1))
    raise RuntimeError(f"{path}: {last}")

def filename(path):
    name = urllib.parse.urlsplit(path).path.lstrip("/")
    return name + "index.html" if not name or name.endswith("/") else name

def pair(path):
    return path, fetch(path)

sitemap_index = fetch("/sitemap-index.xml")
sitemap = fetch("/sitemap-0.xml")
locs = [node.text for node in ET.fromstring(sitemap).findall(".//{*}loc")]
assert len(locs) == 62 and len(locs) == len(set(locs)), "Unexpected sitemap content; source deployment may have changed."
assert all(url.startswith(HOST + "/") for url in locs), "Sitemap includes another origin."
pages = sorted({urllib.parse.urlsplit(url).path for url in locs} | {"/404/"})
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
    page_data = dict(pool.map(pair, pages))
files = {filename(path): content for path, content in page_data.items()}
files.update({"sitemap-index.xml": sitemap_index, "sitemap-0.xml": sitemap})
for path in ("robots.txt", "ads.txt", "favicon.svg", "manus-routes.json"):
    files[path] = fetch("/" + path)

asset_pattern = re.compile(
    r"/?_assets/([A-Za-z0-9_.+~%-]+\.(?:js|css|woff2?|png|svg|webp|jpe?g|wasm|ico|ttf|avif|gif|json|bin))",
    re.I,
)
relative_pattern = re.compile(
    r"\./([A-Za-z0-9_.+~%-]+\.(?:js|css|woff2?|png|svg|webp|jpe?g|wasm|ico|ttf|avif|gif|json|bin))",
    re.I,
)
assets, downloaded = set(), set()

def scan(path, content):
    text = content.decode("utf-8", "replace")
    for asset in asset_pattern.findall(text):
        assets.add("/_assets/" + asset)
    if path.startswith("_assets/"):
        for asset in relative_pattern.findall(text):
            assets.add("/_assets/" + asset)

for path, content in files.items():
    if path.endswith(".html"):
        scan(path, content)

for _ in range(8):
    todo = sorted(assets - downloaded)
    if not todo:
        break
    assert len(todo) < 200, "Unexpected asset discovery count."
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as pool:
        items = list(pool.map(pair, todo))
    for path, content in items:
        downloaded.add(path)
        files[path.lstrip("/")] = content
        if path.endswith((".js", ".css", ".svg", ".json")):
            scan(path.lstrip("/"), content)

asset = "_assets/ToolWorkbench.DKrvvzVM.js"
assert asset in files, "Original ToolWorkbench asset changed. Abort instead of publishing an unsafe package."
bundle = files[asset].decode("utf-8")
old = "a=typeof Worker<\u0060u\u0060&&(!r||typeof OffscreenCanvas<\u0060u\u0060)"
patched = old + "&&e.operation!==\u0060pdf-to-images\u0060&&!(e.operation===\u0060compress-pdf\u0060&&E.pdfMode===\u0060raster\u0060)"
assert bundle.count(old) == 1 and patched not in bundle, "Worker routing changed; manual review required."
files[asset] = bundle.replace(old, patched, 1).encode("utf-8")
assert len(page_data) == 63
assert len([path for path in files if path.endswith("index.html") and "tools/" in path]) == 48
assert len([path for path in files if path.startswith("_assets/")]) >= 30
assert b"pub-5086201923236113" in files["ads.txt"]
assert all(filename(path) in files for path in pages)
files["404.html"] = files.pop("404/index.html")
with zipfile.ZipFile(OUT, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=8) as archive:
    for path, contents in sorted(files.items()):
        archive.writestr(path, contents)
with zipfile.ZipFile(OUT) as archive:
    assert archive.testzip() is None, "Corrupt archive"
    assert len(archive.namelist()) == len(files)
print("SUCCESS", {"archive": str(OUT), "bytes": OUT.stat().st_size, "sha256": hashlib.sha256(OUT.read_bytes()).hexdigest(), "pages": 63, "tool_pages": 48, "files": len(files), "pdf_raster_workaround": True})
