# PixPDFKit — أدوات PDF مجانية

موقع جديد عربي/إنجليزي، يوفر 13 أداة حقيقية تعمل داخل المتصفح دون رفع الملفات إلى خادم.

## التشغيل

شغّل `python -m http.server 8000` من المجلد الأعلى مع فتح `/PixPDFKit/ar/` عند وضعه في مجلد PixPDFKit. أو انشر الملفات مباشرة في جذر مستودع GitHub Pages. تحتاج مكتبتا pdf-lib وPDF.js إلى اتصال بالشبكة من CDNs موثوقة؛ JSZip مرفقة محلياً.

## نشر GitHub Pages

Repository Settings → Pages → Deploy from a branch → `main` → `/ (root)` → Save.

## AdSense

لم تُضَف أي شفرة إعلانية أو `ads.txt` تحتوي على ناشر غير مُتحقق منه. يلزم معرف حساب AdSense الصحيح والمراجعة الرسمية قبل تفعيل الإعلانات. عند الربط، استخدم ملف ads.txt الصحيح وبرمجة الموافقة على ملفات تعريف الارتباط عند اللزوم، وحدّث سياسة الخصوصية لتطابق السلوك الفعلي. لا نضع إعلانات صورية وهمية ولا ندّعي موافقة مضمونة.

## Limitations

Browser memory limits; PDFs with passwords may fail; compression rasterizes and may remove searchable text, or increase size. Digital signatures may be invalidated by edits. No server-side file uploads.

Copyright (c) 2026. Open-source libraries are credited and fetched from their respective CDNs.
