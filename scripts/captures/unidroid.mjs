// UniDroid has no website: compose its README screenshots (launcher on a TV, remote on a phone).
// Usage: node unidroid.mjs [screenshots folder of the unidroid-suite repo] [output.webp]
import { composer, ecran } from './cadre.mjs';

const [dossier = '../unidroid-suite/docs/screenshots', sortie = 'public/projets/apercus/unidroid-suite.webp'] = process.argv.slice(2);
const tv = await ecran(`${dossier}/launcher-home.png`, 1180, { rayon: 18 });
const tel = await ecran(`${dossier}/remote.png`, 330, { rayon: 42, bord: 10 });
await composer('#b3263a', [
  { e: tv, x: 640, y: 60, rayon: 18 },
  { e: tel, x: 1520, y: 380, rayon: 42 },
], sortie);
