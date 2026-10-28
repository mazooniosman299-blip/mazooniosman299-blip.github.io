# أدواتك الذكية + PixPDFKit — Free PDF Tools

This repository hosts two free browser-based utilities projects.

## PixPDFKit — primary website

**Arabic:** https://mazooniosman299-blip-github-io.pages.dev/ar/

**English:** https://mazooniosman299-blip-github-io.pages.dev/en/

**Sitemap:** https://mazooniosman299-blip-github-io.pages.dev/sitemap.xml

PixPDFKit offers 13 PDF tools in Arabic and English (26 tool pages), including PDF merge, split, compression, PDF-to-JPG, PDF-to-PNG, images-to-PDF, page rotation, deletion, reordering, extraction, watermarking, numbering and metadata editing. The site also has practical PDF guides about document privacy, upload size limits and job-application documents.

**PixPDFKit هو الموقع الأساسي لأدوات PDF المجانية.** يمكنك دمج الملفات وتقسيمها وتحويلها وتنظيم صفحاتها مباشرة من المتصفح:

- [الأدوات بالعربية](https://mazooniosman299-blip-github-io.pages.dev/ar/)
- [Free PDF tools in English](https://mazooniosman299-blip-github-io.pages.dev/en/)
- [فحص حجم PDF قبل رفعه](https://mazooniosman299-blip-github-io.pages.dev/ar/guides/pdf-under-2mb)
- [ترتيب السيرة الذاتية والشهادات](https://mazooniosman299-blip-github-io.pages.dev/ar/guides/job-application-pdf)

Some tools download open-source JavaScript libraries from external CDNs. Read the site privacy notice for limitations.

### Source and publishing

- Source pages: [`PixPDFKit/`](PixPDFKit/)
- Cloudflare Pages build script: [`scripts/build_cloudflare_pages.py`](scripts/build_cloudflare_pages.py)
- Cloudflare production output: `dist-cloudflare/` (generated during build, not committed)
- Live public sitemap: https://mazooniosman299-blip-github-io.pages.dev/sitemap.xml
- Automated checks: [`.github/workflows/verify-cloudflare-pages.yml`](.github/workflows/verify-cloudflare-pages.yml)
- Local source checks: `python3 PixPDFKit/tests/audit.py` and `python3 PixPDFKit/tests/verify.py`

The GitHub Pages copy of PixPDFKit is kept as a fallback; its canonical search URLs point to the Cloudflare production host.

## أدواتك الذكية — Other free utilities

The main GitHub Pages homepage, https://mazooniosman299-blip.github.io/, contains additional tools for images, text, QR codes and calculations. The PDF directory on that homepage links to the primary PixPDFKit website.

## Important notes

Google Search indexing and Google AdSense approval are independent of successful deployment. This project does not promise indexing, ad approval or earnings.

**Last README update:** 2026-10-28.
