# Portfolio

Site vitrine de Timéo, développeur web & applications (auto-entrepreneur). Astro 7 statique, déployé sur Cloudflare Pages (projet `timeo`) → https://jeannin.dev

## Commandes

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # astro check + build dans dist/
npm run preview
```

## Modifier le contenu

| Quoi | Où |
|---|---|
| Nom, métier, e-mail, disponibilité | `src/config.ts` → `SITE` |
| Mentions légales (SIRET, adresse) | `src/config.ts` → `LEGAL` |
| Services, étapes de la méthode | `src/data/contenu.ts` |
| Projets (section masquée si vide) | `src/data/contenu.ts` → `projets` (logo, lien site, lien GitHub, capture `apercu`) |
| Chiffres animés de la section Projets | `src/data/contenu.ts` → `chiffres` (avec `source`, lu en direct ; ex. Ghostmails `GET https://api.ghostmails.cc/api/stats`) |
| Logos / captures des projets | `public/projets/` et `public/projets/apercus/` (1920×1200 webp) |
| Couleurs, polices | `src/styles/global.css` (`:root`) |

## Captures des projets

`npm run captures` régénère les 4 captures affichées en fond au survol d'un projet (Edge installé, piloté par `puppeteer-core`, pas de navigateur téléchargé) :

- `scripts/captures/ghostmails.mjs` : boîte avec 4 e-mails fictifs, un e-mail HTML ouvert. L'API est simulée par interception : aucune adresse réelle créée.
- `scripts/captures/undercover.mjs` : partie en cours (6 joueurs, un civil éliminé), état injecté via les fonctions de l'app.
- `scripts/captures/page.mjs <url> <sortie.webp>` : capture simple (carte MyCityCost `/map`, accueil PasteTok).

## Animations et interactions

Tout est en CSS ou en JS sans bibliothèque, dans `src/pages/index.astro` et `src/components/Header.astro`.
Coupé si « mouvement réduit » ; les effets souris (`html.a-souris`) seulement avec une vraie souris.

Règle de progression au défilement · mot du titre qui change · lettres du titre au survol · grille de points animée derrière le titre (canvas, réagit à la souris) · curseur personnalisé · titres et traits de section qui apparaissent · chiffres de la méthode remplis · cartes de services inclinables · compteurs · capture du projet survolé en fond de section (fondu entre deux calques) · e-mail écrit lettre par lettre · transitions entre pages.

## Déploiement (Cloudflare Pages)

Automatique à chaque push sur `main` (GitHub Actions, `.github/workflows/deploy.yml`).
Secret GitHub `CLOUDFLARE_API_TOKEN` (droit « Cloudflare Pages : Edit »), variable `CLOUDFLARE_ACCOUNT_ID`.

À la main : `npm run deploy` (build + `wrangler pages deploy`). Ne jamais passer `--force` à wrangler.

- Domaine : `jeannin.dev`, DNS chez Cloudflare (registrar Cloudflare)
- `PUBLIC_SITE_URL` surcharge l'URL publique (canonical + sitemap), défaut `https://jeannin.dev`

Polices Fontsource : importer `@fontsource/<police>/<poids>` **sans** `.css` (l'export du paquet l'ajoute déjà).
