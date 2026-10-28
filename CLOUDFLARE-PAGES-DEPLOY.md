# PixPDFKit on Cloudflare Pages — verified publishing settings

This site is built from the **current** \`PixPDFKit/\` folder of this repository, so all existing 46 pages and 13 browser-based tools ship without modifying the GitHub Pages copy.

**Cloudflare Pages → Create application → Pages → Connect to GitHub:**

- Repository: \`mazooniosman299-blip/mazooniosman299-blip.github.io\`
- Production branch: \`main\`
- Framework preset: \`None\`
- Root directory: \`/\` (repository root)
- Build command: \`python3 scripts/build_cloudflare_pages.py\`
- Build output directory: \`dist-cloudflare\`
- No paid plan needed for static assets. Do not add an API token into source control.

The build automatically finds the stable \`<project>.pages.dev\` host from Cloudflare's \`CF_PAGES_URL\`, even if a deployment URL has a preview hash. It copies site assets, moves /PixPDFKit URLs to the new domain root, rewrites canonical/hreflang/OG links and all 46 sitemap entries to Cloudflare's extensionless public HTML routes, updates PWA paths, installs the verified root ads.txt publisher, and publishes a correct root robots.txt. Preview branches receive noindex headers and robots Disallow.

**After first deployment:** Open the Cloudflare-provided project URL and validate /ar/, /en/, /ads.txt, /sitemap.xml, /robots.txt, and live PDF tools. If a custom domain is added later, set \`SITE_ORIGIN=https://yourdomain.com\` as a Cloudflare build environment variable and redeploy. Do not change the primary Google AdSense site while the new deployment is unverified. AdSense review and Search Console verification for a newly-created host are separate and must be completed through the correct Google account.

**Don't publish these commands as a terminal-only site.** Cloudflare must have the Git integration created in the owner's account. The script alone does not create a Cloudflare project.

**Local verification:**

\`\`\`bash
CF_PAGES_URL=https://preview-1234.pixpdfkit.pages.dev CF_PAGES_BRANCH=main python3 scripts/build_cloudflare_pages.py
\`\`\`

Maintaining the source: the existing PixPDFKit sync job manages the \`PixPDFKit/\` directory; the Cloudflare build uses that directory as its source. Do not hand-edit generated \`dist-cloudflare/\` output or overwrite it with the obsolete ZIP release.
