// Composes screenshots onto a 1920×1200 dark canvas for the projects gallery.
// The card text sits bottom-left, so screens go on the right and towards the top.
import sharp from 'sharp';

export const W = 1920;
export const H = 1200;

// Dark background with a colored glow on the right (behind the screens).
export const fond = (lueur) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs><radialGradient id="g" cx="72%" cy="40%" r="60%">
      <stop offset="0" stop-color="${lueur}" stop-opacity="0.55"/><stop offset="1" stop-color="${lueur}" stop-opacity="0"/>
    </radialGradient></defs>
    <rect width="100%" height="100%" fill="#0f0e10"/><rect width="100%" height="100%" fill="url(#g)"/>
  </svg>`);

// Screenshot resized to `largeur`, with rounded corners and an optional dark bezel (phones).
export const ecran = async (source, largeur, { rayon = 24, bord = 0 } = {}) => {
  const img = sharp(source).resize({ width: largeur - bord * 2 });
  const { height } = await img.clone().toBuffer({ resolveWithObject: true }).then((r) => r.info);
  const h = height + bord * 2;
  const masque = (w, hh, r) =>
    Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${hh}"><rect width="${w}" height="${hh}" rx="${r}" fill="#fff"/></svg>`);
  const contenu = await img
    .composite([{ input: masque(largeur - bord * 2, height, Math.max(rayon - bord, 4)), blend: 'dest-in' }])
    .png()
    .toBuffer();
  const cadre = await sharp({ create: { width: largeur, height: h, channels: 4, background: '#0b0b0d' } })
    .composite([
      { input: contenu, left: bord, top: bord },
      { input: masque(largeur, h, rayon), blend: 'dest-in' },
    ])
    .png()
    .toBuffer();
  return { input: cadre, largeur, hauteur: h };
};

// Soft shadow under a screen.
export const ombre = async ({ largeur, hauteur }, rayon = 24) => ({
  input: await sharp(
    Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${largeur + 160}" height="${hauteur + 160}">
      <rect x="80" y="100" width="${largeur}" height="${hauteur}" rx="${rayon}" fill="#000" fill-opacity="0.65"/></svg>`),
  )
    .blur(30)
    .png()
    .toBuffer(),
  decalage: -80,
});

// Places screens ({ ecran, x, y }) on the background and writes a WebP.
export const composer = async (lueur, places, sortie) => {
  const calques = [];
  for (const { e, x, y, rayon } of places) {
    const o = await ombre(e, rayon);
    calques.push({ input: o.input, left: x + o.decalage, top: y + o.decalage }, { input: e.input, left: x, top: y });
  }
  await sharp(fond(lueur)).composite(calques).webp({ quality: 82 }).toFile(sortie);
};
