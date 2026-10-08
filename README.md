# Portfolio

Site vitrine de Timéo, développeur web & applications (auto-entrepreneur). Astro 7 statique, déployé sur Cloudflare Pages (projet `timeo`) → https://timeojea.ovh

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
| Projets (section masquée si vide) | `src/data/contenu.ts` → `projets` |
| Couleurs, polices | `src/styles/global.css` (`:root`) |

## Déploiement (Cloudflare Pages)

Automatique à chaque push sur `main` (GitHub Actions, `.github/workflows/deploy.yml`).
Secret GitHub `CLOUDFLARE_API_TOKEN` (droit « Cloudflare Pages : Edit »), variable `CLOUDFLARE_ACCOUNT_ID`.

À la main : `npm run deploy` (build + `wrangler pages deploy`). Ne jamais passer `--force` à wrangler.

- Domaine : `timeojea.ovh`, DNS chez Cloudflare (registrar OVH)
- `PUBLIC_SITE_URL` surcharge l'URL publique (canonical + sitemap), défaut `https://timeojea.ovh`

Polices Fontsource : importer `@fontsource/<police>/<poids>` **sans** `.css` (l'export du paquet l'ajoute déjà).
