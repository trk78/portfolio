<div align="center">

# Portfolio

**Timéo’s portfolio — freelance web and application developer.**

### [▶ Visit: jeannin.dev](https://jeannin.dev)

[![Deploy](https://github.com/trk78/portfolio/actions/workflows/deploy.yml/badge.svg)](https://github.com/trk78/portfolio/actions/workflows/deploy.yml)
![Astro](https://img.shields.io/badge/Astro-7-BC52EE?logo=astro&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Cloudflare](https://img.shields.io/badge/Cloudflare-F38020?logo=cloudflare&logoColor=white)

</div>

---

## ✨ Features

| Feature | Details |
|---|---|
| Static portfolio | Astro 7 static site for Timéo, a freelance web and application developer (sole proprietor), deployed on Cloudflare Pages (project `timeo`). |
| Content-driven sections | Services, method steps, projects (hidden when empty), and animated project counters with live data sources. |
| Animations and interactions | CSS and plain JavaScript, without an animation library, in `src/pages/index.astro` and `src/components/Header.astro`. Disabled with reduced motion; mouse effects (`html.a-souris`) only run with an actual mouse. |
| Heading and navigation | Scroll progress ruler, cycling heading word, heading letters reacting on hover, animated dot grid and drifting purple lights behind the heading (canvas, reacts to the mouse, scatters on scroll), heading that stays in place and blurs out as the sections slide over it, custom cursor (inverting disc over the heading), and curtain page transitions. |
| Section reveals | Section headings and dividers animate in; method numbers fill in and the method line fills as the page scrolls. |
| Method interactions | The hovered step expands (bubble behind the number, other steps fade, large background scene: client conversation, quote filled in then stamped, typed code, deployment checklist and live status badge). |
| Service cards | Fill from the cursor entry point, with icons redrawn and enlarged and staggered bullet points. |
| Projects gallery | Counters, then large cards (text beside the full site screenshot): on large screens the section is pinned and vertical scroll moves the cards sideways (with parallax); on phones, native swipe with snapping. |
| Contact | Dark curtain revealed under the rounded bottom of the page, email letters rising one by one, magnetic arrow. |
| Contact | Copy-address button and email typed character by character. |

## ⚙️ How it works

### Editing content

| What | Where |
|---|---|
| Name, occupation, email, availability | `src/config.ts` → `SITE` |
| Legal information (SIRET, address) | `src/config.ts` → `LEGAL` |
| Services, method steps | `src/data/contenu.ts` |
| Projects (section hidden when empty) | `src/data/contenu.ts` → `projets` (logo, site link, GitHub link, `apercu` screenshot) |
| Animated counters in the Projects section | `src/data/contenu.ts` → `chiffres` (with `source`, fetched live; e.g. Ghostmails `GET https://api.ghostmails.cc/api/stats`) |
| Project logos / screenshots | `public/projets/` and `public/projets/apercus/` (1920×1200 WebP) |
| Colors, fonts | `src/styles/global.css` (`:root`) |

Fontsource fonts: import `@fontsource/<font>/<weight>` **without** `.css` (the package export already adds it).

### Project captures

`npm run captures` regenerates all the screenshots shown in the projects gallery (requires Edge installed, controlled by `puppeteer-core`; no browser is downloaded):

- `scripts/captures/ghostmails.mjs`: inbox with 4 fake emails, with an HTML email open. The API is mocked through request interception: no real address is created.
- `scripts/captures/undercover.mjs`: three phone screens (players, secret word, game in progress with one civilian eliminated), state injected through the app’s functions, composed side by side.
- `scripts/captures/unidroid.mjs [screenshots folder]`: UniDroid has no website; composes its README screenshots (launcher on a TV, remote on a phone) from `../unidroid-suite/docs/screenshots` by default.
- `scripts/captures/cadre.mjs`: shared composition helpers (`sharp`): dark 1920×1200 canvas with a colored glow, screens on the right where the card text does not cover them.
- `scripts/captures/page.mjs <url> <output.webp>`: simple capture (MyCityCost `/map`, PasteTok home page).

### Counters (Worker + D1)

`POST /hit` counts Undercover+ games started and valid links submitted to PasteTok (not confirmed downloads). `GET /stats` provides both totals, with a 60-second cache. Only these totals are stored. Allowed write origins: `https://trk78.github.io` and `http://localhost:*`; each call adds 1.

From `worker/`, create the database with `npx wrangler d1 create compteurs`, then replace the `database_id` placeholder in `wrangler.toml` with the returned ID.
Apply the schema with `npx wrangler d1 execute compteurs --remote --file=schema.sql`, then deploy with `npx wrangler deploy`.
For local development: `npx wrangler d1 execute compteurs --local --file=schema.sql`, then `npx wrangler dev`.

After deployment, adjust the URLs if needed in `src/data/contenu.ts`, `undercover-plus/script.js` and `pastetok/lib/tiktok.ts`.

## 🚀 Run locally

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # astro check + build into dist/
npm run preview
```

## 🌍 Deployment

Deployment runs automatically on every push to `main` (GitHub Actions, `.github/workflows/deploy.yml`) to Cloudflare Pages (project `timeo`).
Configure the GitHub secret `CLOUDFLARE_API_TOKEN` (with “Cloudflare Pages: Edit” permission) and variable `CLOUDFLARE_ACCOUNT_ID`.

Manual deployment: `npm run deploy` (build + `wrangler pages deploy`). Never pass `--force` to Wrangler.

- Domain: `jeannin.dev`, with DNS hosted by Cloudflare (Cloudflare registrar).
- `PUBLIC_SITE_URL` overrides the public URL (canonical + sitemap); defaults to `https://jeannin.dev`.

## 🗂️ Project structure

```text
.github/workflows/deploy.yml  # Automatic Cloudflare Pages deployment
astro.config.mjs             # Astro configuration and public site URL
public/projets/              # Project logos and apercus/ screenshots
scripts/captures/            # Project capture scripts
src/components/             # Shared components, including Header.astro
src/config.ts               # Identity, contact details and legal information
src/data/                   # Content and section numbering
src/layouts/                # Shared page layout
src/pages/                  # Home and legal pages
src/styles/global.css       # Global styles, colors and fonts
worker/                     # Counters Worker, D1 schema and Wrangler configuration
```

## ⚠️ Known limitations

The counters Worker has no per-IP rate limit. Its safeguards do not prevent repeated calls from a client spoofing the origin. No identifiers or IP addresses are stored.

## 📄 License

All rights reserved © Timéo Jeannin. The code is public for reference; the content (texts, images, personal information) may not be reused.
