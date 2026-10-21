// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Adresse publique du site (canonical, sitemap).
const SITE = process.env.PUBLIC_SITE_URL || 'https://jeannin.dev';

export default defineConfig({
  site: SITE,
  integrations: [sitemap()],
});
