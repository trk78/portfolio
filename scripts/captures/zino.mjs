// Composes three Zino screens (games menu, clan, profile) side by side, from the app screenshots of its website.
import { composer, ecran } from './cadre.mjs';

const SOURCE = process.argv[2] ?? '../zino/docs/img';
const SORTIE = process.argv[3] ?? 'public/projets/apercus/zino.webp';

const [a, b, c] = await Promise.all(
  ['app-fr-menu', 'app-fr-clan', 'app-fr-profil'].map((n) => ecran(`${SOURCE}/${n}.webp`, 340, { rayon: 44, bord: 12 })),
);
await composer('#1fc8ff', [
  { e: a, x: 820, y: 120, rayon: 44 },
  { e: b, x: 1180, y: 60, rayon: 44 },
  { e: c, x: 1540, y: 150, rayon: 44 },
], SORTIE);
