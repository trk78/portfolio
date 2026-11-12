// Composes three Zino screens (Neon Run guide, game stats, level road) side by side.
// Zino needs a signed-in account to show its menu, so the screens come from its own widget tests:
// run `flutter test --dart-define=SCREENSHOTS=true` in the Zino repo first (writes build/screens/).
import sharp from 'sharp';
import { composer, ecran } from './cadre.mjs';

const SOURCE = process.argv[2] ?? '../zino/build/screens';
const SORTIE = process.argv[3] ?? 'public/projets/apercus/zino.webp';

// The guide is a bottom sheet: drop the empty band above it.
const guide = await sharp(`${SOURCE}/guide_neonrun.png`).extract({ left: 0, top: 110, width: 390, height: 734 }).toBuffer();
const [a, b, c] = await Promise.all(
  [guide, `${SOURCE}/game_stats.png`, `${SOURCE}/level_road.png`].map((s) => ecran(s, 340, { rayon: 44, bord: 12 })),
);
await composer('#1fc8ff', [
  { e: a, x: 820, y: 120, rayon: 44 },
  { e: b, x: 1180, y: 60, rayon: 44 },
  { e: c, x: 1540, y: 150, rayon: 44 },
], SORTIE);
