#!/usr/bin/env python3
"""Build PixPDFKit for Cloudflare Pages, without modifying GitHub Pages originals."""
import os
import re
import shutil
import xml.etree.ElementTree as ET
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "PixPDFKit"
OUTPUT = ROOT / "dist-cloudflare"
OLD_ORIGIN = "https://mazooniosman299-blip.github.io/PixPDFKit"
PUBLISHER = "google.com, pub-5086201923236113, DIRECT, f08c47fec0942fa0"


def get_site_origin():
    explicit = os.environ.get("SITE_ORIGIN", "").strip().rstrip("/")
    if explicit:
        u = urlsplit(explicit)
        if u.scheme != "https" or not u.hostname or u.path or u.query or u.fragment:
            raise ValueError("SITE_ORIGIN must be an HTTPS site origin, e.g. https://example.com")
        return explicit
    pages_url = os.environ.get("CF_PAGES_URL", "").strip()
    host = urlsplit(pages_url).hostname
    if not host or not host.endswith(".pages.dev"):
        raise ValueError("Missing Cloudflare Pages URL: deploy on Pages or set SITE_ORIGIN for testing")
    labels = host.split(".")
    if len(labels) < 3:
        raise ValueError("Unexpected CF_PAGES_URL")
    project = labels[-3]  # Stable project host, not the hash/branch-specific preview host.
    return "https://" + project + ".pages.dev"


def run():
    origin = get_site_origin()
    if not (SOURCE / "ar/index.html").exists() or not (SOURCE / "en/index.html").exists():
        raise FileNotFoundError("PixPDFKit source pages not found")
    if OUTPUT.exists():
        shutil.rmtree(OUTPUT)
    shutil.copytree(
        SOURCE, OUTPUT,
        ignore=shutil.ignore_patterns("__pycache__", ".DS_Store", "tests", ".git", ".github"),
    )
    updates = 0
    for file in OUTPUT.rglob("*"):
        if not file.is_file() or file.suffix not in {".html", ".xml", ".js", ".css", ".json", ".webmanifest", ".txt", ".svg"}:
            continue
        data = file.read_text(encoding="utf-8")
        new_data = data.replace(OLD_ORIGIN, origin).replace("/PixPDFKit/", "/")
        # Pages automatically redirects /page.html -> /page. Publish the
        # destination URL consistently in links, canonicals, hreflang and JSON-LD.
        if file.suffix == ".html":
            new_data = re.sub(r'\.html(?=["\'<> ])', "", new_data)
        elif file.name == "sitemap.xml":
            new_data = new_data.replace(".html</loc>", "</loc>")
        if new_data != data:
            file.write_text(new_data, encoding="utf-8")
            updates += 1

    # Cloudflare Pages uses the independent root, not GitHub's /PixPDFKit subfolder.
    (OUTPUT / "robots.txt").write_text(
        f"User-agent: *\nAllow: /\nSitemap: {origin}/sitemap.xml\n", encoding="utf-8"
    )
    ads_file = ROOT / "ads.txt"
    ads = ads_file.read_text(encoding="utf-8").strip()
    if PUBLISHER not in ads.splitlines():
        raise ValueError("Root ads.txt must contain the verified AdSense publisher ID")
    (OUTPUT / "ads.txt").write_text(ads + "\n", encoding="utf-8")
    # Search Console ownership: the same Google verification file is used on
    # the GitHub Pages site and must also exist at the NEW site's domain root.
    verification_name = "google611146e9ceec162a.html"
    verification_source = ROOT / verification_name
    expected_verification = "google-site-verification: " + verification_name
    if verification_source.read_text(encoding="utf-8").strip() != expected_verification:
        raise ValueError("Google Search Console verification file has unexpected content")
    shutil.copyfile(verification_source, OUTPUT / verification_name)


    # Preview deployments must not compete with production for Google indexing.
    branch = os.environ.get("CF_PAGES_BRANCH", "main")
    if branch != "main":
        (OUTPUT / "robots.txt").write_text("User-agent: *\nDisallow: /\n", encoding="utf-8")
        (OUTPUT / "_headers").write_text("/*\n  X-Robots-Tag: noindex\n", encoding="utf-8")
    else:
        (OUTPUT / "_headers").write_text(
            "/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n", encoding="utf-8"
        )

    manifest = (OUTPUT / "manifest.webmanifest").read_text(encoding="utf-8")
    if '"/ar/"' not in manifest or '"/favicon.svg"' not in manifest:
        raise AssertionError("PWA manifest still points at a nested GitHub Pages folder")

    root = ET.parse(OUTPUT / "sitemap.xml").getroot()
    locs = [x.text for x in root.findall("{http://www.sitemaps.org/schemas/sitemap/0.9}url/{http://www.sitemaps.org/schemas/sitemap/0.9}loc")]
    assert len(locs) == 46 and len(set(locs)) == 46, "All 46 unique links must be in the sitemap"
    assert not any(u.endswith(".html") for u in locs), "Cloudflare sitemap must use canonical extensionless HTML routes"
    assert len(list(OUTPUT.rglob("*.html"))) >= 46, "Missing translated HTML pages"
    for location in locs:
        if not location.startswith(origin + "/"):
            raise AssertionError(f"Offsite or obsolete sitemap URL: {location}")
        relative = location[len(origin) + 1:]
        target = OUTPUT / relative
        if relative.endswith("/"):
            target = target / "index.html"
        elif target.suffix == "":
            # Public Cloudflare route is clean; source file keeps .html.
            target = target.with_suffix(".html")
        if not target.exists():
            raise AssertionError(f"Sitemap URL missing HTML: {location}")
    for page in OUTPUT.rglob("*.html"):
        if page.name == "google611146e9ceec162a.html":
            continue  # Google ownership token is intentionally a plain one-line file.
        content = page.read_text(encoding="utf-8")
        if OLD_ORIGIN in content:
            raise AssertionError(f"Obsolete canonical URL in {page}")
        if 'name="google-adsense-account"' not in content:
            raise AssertionError(f"Missing publisher verification in {page}")
    print(f"PASS: origin={origin}; {len(locs)} sitemap links; all HTML has correct publisher; adjusted {updates} files.")
    print(f"Cloudflare Pages output: {OUTPUT}")


if __name__ == "__main__":
    run()
