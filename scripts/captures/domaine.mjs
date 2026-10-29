// Renders the wine estate demo visuals from the studio page (needs `npm run dev` on port 4330).
// Usage: node scripts/captures/domaine.mjs [scene...]   (default: all). Output: public/demo/domaine/<scene>.webp
import { mkdirSync } from 'node:fs';
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';

const SORTIE = 'public/demo/domaine';
const BASE = process.env.STUDIO ?? 'http://localhost:4330/demo/studio/';
const tailles = {
  hero: [1500, 1200], rouge: [900, 1200], blanc: [900, 1200], bulles: [900, 1200], reserve: [900, 1200], cave: [1600, 900],
  'b-rose': [500, 1100], 'b-blanc': [500, 1100], 'b-rouge': [500, 1100], 'b-grand': [500, 1100],
};
const choix = process.argv.slice(2);
mkdirSync(SORTIE, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: true,
  args: ['--use-angle=d3d11', '--enable-gpu'],
});
for (const [scene, [w, h]] of Object.entries(tailles)) {
  if (choix.length && !choix.includes(scene)) continue;
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h });
  page.on('pageerror', (e) => console.error(scene, e.message));
  await page.goto(`${BASE}?scene=${scene}&w=${w}&h=${h}`, { waitUntil: 'networkidle0', timeout: 90_000 });
  await page.waitForFunction('window.__pret === true', { timeout: 90_000 });
  // Astro's dev toolbar sits over the canvas: hide it before the capture.
  await page.addStyleTag({ content: 'astro-dev-toolbar { display: none !important; }' });
  const png = await (await page.$('canvas')).screenshot({ omitBackground: true });
  await sharp(png).webp({ quality: 84, alphaQuality: 90 }).toFile(`${SORTIE}/${scene}.webp`);
  console.log(scene, 'ok');
  await page.close();
}
await browser.close();
