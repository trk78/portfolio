// Records a short silent loop of each product in action for the projects gallery.
// Usage: node scripts/captures/videos.mjs [project...]   (default: all)
// Each recording is re-encoded to H.264 with a crossfade from its end into its start, so it loops seamlessly.
// Requires Edge and ffmpeg (in PATH). Nothing is created on the real services: APIs are mocked, counters blocked.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';
import { fond, ombre } from './cadre.mjs';

const SORTIE = 'public/projets/videos';
const FONDU = 0.8; // crossfade between the end and the start, in seconds
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const pub = /googlesyndication|doubleclick|adservice|googletagmanager|profitablecpm/;

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: true,
  defaultViewport: { width: 1920, height: 1200 },
});

// Records `scene(page)` once `preparer(page)` is done; returns the raw screencast.
const prise = async (nom, preparer, scene) => {
  const page = await browser.newPage();
  await preparer(page);
  // The screencast only sends frames when the page changes: a near-invisible blinking pixel keeps
  // the static moments (otherwise dropped, which shortens the clip and cuts its ending).
  await page.evaluate(() => {
    const p = document.createElement('div');
    p.style.cssText = 'position:fixed;right:0;bottom:0;width:2px;height:2px;z-index:2147483647;pointer-events:none';
    document.documentElement.append(p);
    let on = false;
    setInterval(() => (p.style.background = (on = !on) ? 'rgba(0,0,0,.02)' : 'rgba(0,0,0,.03)'), 40);
  });
  const brut = join(tmpdir(), `${nom}-brut.webm`);
  const rec = await page.screencast({ path: brut, quality: 18 });
  await scene(page);
  await rec.stop();
  await page.close();
  return brut;
};

// Films one page, then encodes the loop.
const filmer = async (nom, preparer, scene) => {
  const brut = await prise(nom, preparer, scene);
  boucler(brut, `${SORTIE}/${nom}.mp4`);
  rmSync(brut);
  console.log(nom, 'ok');
};

// The raw screencast has no duration in its header: normalise it to 24 fps first, then measure it.
const normaliser = (brut, largeur) => {
  const sortie = brut.replace(/\.\w+$/, '-24.mp4');
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', brut, '-vf', `fps=24,scale=${largeur}:-2`, '-c:v', 'libx264', '-crf', '12', sortie]);
  const duree = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', sortie]).toString());
  return { fichier: sortie, duree };
};

// The end of the clip fades into its first FONDU seconds: the output starts where that head ends.
const boucler = (brut, sortie) => {
  const { fichier: entree, duree: d } = normaliser(brut, 1280);
  const filtre =
    `[0:v]split[a][b];` +
    `[a]trim=start=${FONDU},setpts=PTS-STARTPTS[corps];` +
    `[b]trim=0:${FONDU},setpts=PTS-STARTPTS[tete];` +
    `[corps][tete]xfade=transition=fade:duration=${FONDU}:offset=${(d - 2 * FONDU).toFixed(2)},format=yuv420p[v]`;
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', entree, '-filter_complex', filtre, '-map', '[v]', '-an',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '28', '-movflags', '+faststart', sortie]);
  rmSync(entree);
};

// Static page used as a stage (Undercover+ phones, UniDroid devices), same layout as the screenshots.
const scene = (corps) => `<!doctype html><html><head><style>
  html,body{margin:0;width:1920px;height:1200px;overflow:hidden;background:#0f0e10}
  .fond{position:absolute;inset:0}
  .ecran{position:absolute;overflow:hidden;background:#0b0b0d;box-shadow:0 40px 80px rgba(0,0,0,.6)}
  .ecran img,.ecran iframe{display:block;border:0}
</style></head><body>${corps}</body></html>`;
const fondSvg = (lueur) => `<img class="fond" src="data:image/svg+xml;base64,${fond(lueur).toString('base64')}">`;

// Website staging: the desktop site in a browser window and the mobile site on a phone, filmed one after
// the other then composed on the dark background; the screenshot is a frame of the composition.
const FEN = { x: 560, y: 64, l: 1260, barre: 44, r: 14 };
FEN.h = Math.round((FEN.l * 800) / 1280);
const TEL = { x: 1500, y: 430, l: 300, bord: 12, r: 44 };
TEL.lc = TEL.l - TEL.bord * 2;
TEL.hc = Math.round((TEL.lc * 844) / 390);
const svg = (l, h, corps) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${l}" height="${h}">${corps}</svg>`);
const mettreEnScene = async (nom, lueur, domaine, ordi, tel) => {
  const bruts = [
    await prise(`${nom}-ordi`, async (p) => {
      await p.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1.5 });
      await ordi.preparer(p);
    }, ordi.jouer),
    await prise(`${nom}-tel`, async (p) => {
      await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
      await tel.preparer(p);
    }, tel.jouer),
  ];
  const [a, b] = [normaliser(bruts[0], FEN.l), normaliser(bruts[1], TEL.lc)];
  // The desktop take sets the length; a shorter phone take holds its last frame.
  const d = a.duree;
  const hFen = FEN.barre + FEN.h;
  const hTel = TEL.hc + TEL.bord * 2;
  const fichier = (n) => join(tmpdir(), `${nom}-${n}.png`);
  const [oF, oT] = [await ombre({ largeur: FEN.l, hauteur: hFen }, FEN.r), await ombre({ largeur: TEL.l, hauteur: hTel }, TEL.r)];
  const chrome = svg(FEN.l, hFen, `<rect width="${FEN.l}" height="${hFen}" rx="${FEN.r}" fill="#1d1b22"/>
    <circle cx="24" cy="22" r="6" fill="#ff5f57"/><circle cx="44" cy="22" r="6" fill="#febc2e"/><circle cx="64" cy="22" r="6" fill="#28c840"/>
    <rect x="${FEN.l / 2 - 220}" y="9" width="440" height="26" rx="13" fill="#2b2932"/>
    <text x="${FEN.l / 2}" y="27" text-anchor="middle" font-family="Arial" font-size="14" fill="#b9b4c2">${domaine}</text>`);
  await sharp(fond(lueur))
    .composite([
      { input: oF.input, left: FEN.x + oF.decalage, top: FEN.y + oF.decalage },
      { input: chrome, left: FEN.x, top: FEN.y },
      { input: oT.input, left: TEL.x + oT.decalage, top: TEL.y + oT.decalage },
      { input: svg(TEL.l, hTel, `<rect width="${TEL.l}" height="${hTel}" rx="${TEL.r}" fill="#0b0b0d"/>`), left: TEL.x, top: TEL.y },
    ])
    .png()
    .toFile(fichier('fond'));
  // Masks: the page under the window bar keeps square top corners; the phone screen is rounded all around.
  const r = FEN.r;
  await sharp(svg(FEN.l, FEN.h, `<rect width="100%" height="100%"/><path d="M0 0H${FEN.l}V${FEN.h - r}Q${FEN.l} ${FEN.h} ${FEN.l - r} ${FEN.h}H${r}Q0 ${FEN.h} 0 ${FEN.h - r}Z" fill="#fff"/>`)).png().toFile(fichier('masque-ordi'));
  await sharp(svg(TEL.lc, TEL.hc, `<rect width="100%" height="100%"/><rect width="100%" height="100%" rx="32" fill="#fff"/>`)).png().toFile(fichier('masque-tel'));
  const composee = join(tmpdir(), `${nom}-scene.mp4`);
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-loop', '1', '-i', fichier('fond'), '-i', a.fichier, '-i', b.fichier,
    '-loop', '1', '-i', fichier('masque-ordi'), '-loop', '1', '-i', fichier('masque-tel'), '-filter_complex',
    `[1:v]scale=${FEN.l}:${FEN.h},format=rgba[a];[3:v]format=gray[ma];[a][ma]alphamerge[ra];` +
      `[2:v]tpad=stop_mode=clone:stop_duration=10,scale=${TEL.lc}:${TEL.hc},format=rgba[b];[4:v]format=gray[mb];[b][mb]alphamerge[rb];` +
      `[0:v][ra]overlay=${FEN.x}:${FEN.y + FEN.barre}[t];[t][rb]overlay=${TEL.x + TEL.bord}:${TEL.y + TEL.bord},format=yuv420p[v]`,
    '-map', '[v]', '-t', d.toFixed(2), '-r', '24', '-c:v', 'libx264', '-crf', '12', composee]);
  const image = fichier('apercu');
  // Near the end: every scene has its final state on screen by then (loaded pictures, opened email).
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-ss', (d - 0.3).toFixed(2), '-i', composee, '-frames:v', '1', image]);
  await sharp(image).webp({ quality: 82 }).toFile(`public/projets/apercus/${nom}.webp`);
  boucler(composee, `${SORTIE}/${nom}.mp4`);
  for (const f of [...bruts, a.fichier, b.fichier, composee, image, fichier('fond'), fichier('masque-ordi'), fichier('masque-tel')]) rmSync(f);
  console.log(nom, 'ok');
};
// Declines the cookie banner when there is one.
const refuserCookies = (page) =>
  page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Refuser')?.click());

const projets = {
  // Ghostmails: the inbox (mocked API), three emails opened one after the other.
  async ghostmails() {
    const now = Date.now();
    const min = 60_000;
    const ADDR = { id: 'demo', address: 'velvet.otter42@ghostmails.cc', domain: 'ghostmails.cc', created_at: now - 6 * min, expires_at: now + 54 * min };
    const emails = [
      { id: 'e1', sender: 'Pixel Forum <bonjour@pixelforum.example>', subject: 'Confirmez votre inscription à Pixel Forum', has_attachments: 0, received_at: now - 1 * min, read: 0 },
      { id: 'e2', sender: 'Boutique Lumen <commandes@lumen.example>', subject: 'Votre code de réduction de bienvenue : -15 %', has_attachments: 0, received_at: now - 3 * min, read: 0 },
      { id: 'e3', sender: 'Studio Nova <no-reply@studionova.example>', subject: 'Votre code de vérification : 482 913', has_attachments: 0, received_at: now - 4 * min, read: 1 },
      { id: 'e4', sender: 'Le Fil Tech <newsletter@lefiltech.example>', subject: 'Les 5 outils dev de la semaine', has_attachments: 1, received_at: now - 5 * min, read: 1 },
    ];
    const carte = (titre, couleur, texte) => `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;background:#fff">
      <div style="background:${couleur};padding:28px 32px;color:#fff;font-size:22px;font-weight:700">${titre}</div>
      <div style="padding:28px 32px;color:#1f2937;line-height:1.6">${texte}</div></div>`;
    const corps = {
      e1: carte('Pixel Forum', 'linear-gradient(135deg,#7c6aff,#a78bfa)', '<h2 style="margin:0 0 12px">Bienvenue parmi nous !</h2><p>Confirmez votre adresse e-mail pour activer votre compte.</p><p style="text-align:center;margin:28px 0"><a style="background:#7c6aff;color:#fff;padding:14px 28px;border-radius:8px;font-weight:700;text-decoration:none">Confirmer mon adresse</a></p>'),
      e2: carte('Boutique Lumen', 'linear-gradient(135deg,#f59e0b,#ef4444)', '<h2 style="margin:0 0 12px">-15 % sur votre première commande</h2><p>Votre code : <b style="font-size:22px;letter-spacing:2px">LUMEN15</b></p>'),
      e3: carte('Studio Nova', 'linear-gradient(135deg,#0ea5e9,#22c55e)', '<p>Votre code de vérification :</p><p style="font-size:40px;font-weight:700;letter-spacing:8px;text-align:center;margin:20px 0">482 913</p><p style="color:#6b7280;font-size:13px">Valable 10 minutes.</p>'),
    };
    const preparer = async (page) => {
        await page.evaluateOnNewDocument(() => {
          localStorage.setItem('gm_consent', 'essential');
          localStorage.setItem('gm_lang', 'fr');
        });
        await page.setRequestInterception(true);
        page.on('request', (req) => {
          const url = new URL(req.url());
          if (url.hostname !== 'api.ghostmails.cc' && !url.hostname.endsWith('workers.dev')) return pub.test(url.hostname) ? req.abort() : req.continue();
          const cors = { 'Access-Control-Allow-Origin': 'https://ghostmails.cc', 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS' };
          if (req.method() === 'OPTIONS') return req.respond({ status: 204, headers: cors });
          const json = (body) => req.respond({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify(body) });
          const p = url.pathname;
          if (p === '/api/addresses' && req.method() === 'GET') return json([ADDR]);
          if (p === '/api/addresses/domains') return json(['ghostmails.cc']);
          if (p === '/api/emails/demo') return json(emails);
          const m = p.match(/^\/api\/emails\/demo\/(e\d)$/);
          if (m) {
            const e = emails.find((x) => x.id === m[1]);
            return json({ ...e, read: 1, body_text: e.subject, body_html: corps[m[1]] ?? `<p>${e.subject}</p>`, attachments: [] });
          }
          return json({});
        });
        await page.goto('https://ghostmails.cc/', { waitUntil: 'networkidle2', timeout: 60_000 });
    };
    await mettreEnScene(
      'ghostmails',
      '#7c6aff',
      'ghostmails.cc',
      {
        async preparer(page) {
          await preparer(page);
          await page.locator('::-p-text(Confirmez votre inscription)').click();
          await attendre(1500);
        },
        async jouer(page) {
          await attendre(2200);
          await page.locator('::-p-text(Votre code de vérification)').click();
          await attendre(2400);
          await page.locator('::-p-text(Votre code de réduction)').click();
          await attendre(2200);
        },
      },
      {
        async preparer(page) {
          await preparer(page);
          await attendre(1000);
        },
        async jouer(page) {
          await attendre(1600);
          await page.locator('::-p-text(Votre code de vérification)').click();
          await attendre(5400);
        },
      },
    );
  },

  // PasteTok: a link is typed and submitted, the video card appears (tikwm API mocked, counter blocked).
  async pastetok() {
    const couverture = await sharp(
      Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="720" height="1280">
        <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff5f6d"/><stop offset="1" stop-color="#7c3aed"/></linearGradient></defs>
        <rect width="100%" height="100%" fill="url(#g)"/>
        <text x="50%" y="46%" text-anchor="middle" font-family="Arial" font-weight="900" font-size="96" fill="#fff">PÂTES</text>
        <text x="50%" y="56%" text-anchor="middle" font-family="Arial" font-weight="900" font-size="96" fill="#fff">EN 60 s</text></svg>`),
    ).jpeg().toBuffer();
    const avatar = await sharp({ create: { width: 128, height: 128, channels: 3, background: '#f59e0b' } }).jpeg().toBuffer();
    const preparer = async (page) => {
        await page.setRequestInterception(true);
        page.on('request', async (req) => {
          const url = new URL(req.url());
          if (url.hostname.endsWith('workers.dev') || pub.test(url.hostname)) return req.abort();
          if (url.hostname === 'cdn.demo.example') {
            return req.respond({ status: 200, contentType: 'image/jpeg', headers: { 'Access-Control-Allow-Origin': '*' }, body: url.pathname.includes('avatar') ? avatar : couverture });
          }
          if (url.hostname === 'www.tikwm.com') {
            await attendre(700);
            return req.respond({
              status: 200,
              contentType: 'application/json',
              headers: { 'Access-Control-Allow-Origin': '*' },
              body: JSON.stringify({ code: 0, data: { id: '7400000000000000000', title: 'Recette express : des pâtes crémeuses en 60 secondes', author: { nickname: 'chef.lea', avatar: 'https://cdn.demo.example/avatar.jpg' }, cover: 'https://cdn.demo.example/cover.jpg', duration: 58, play_count: 1_240_000, digg_count: 98_400, play: 'https://cdn.demo.example/v.mp4', wmplay: 'https://cdn.demo.example/wm.mp4', music: 'https://cdn.demo.example/a.mp3' } }),
            });
          }
          return req.continue();
        });
        await page.goto('https://trk78.github.io/pastetok/', { waitUntil: 'networkidle2', timeout: 60_000 });
        await attendre(1000);
    };
    // A link is typed and submitted, after `pause` ms; the video card appears.
    const coller = (pause) => async (page) => {
      await attendre(pause);
      await page.type('input', 'https://www.tiktok.com/@chef.lea/video/7400000000000000000', { delay: 28 });
      await attendre(400);
      await page.click('button[type="submit"]');
      await page.waitForNavigation({ timeout: 8000 }).catch(() => {});
      await attendre(3500 - pause);
    };
    await mettreEnScene('pastetok', '#fe2c55', 'trk78.github.io/pastetok', { preparer, jouer: coller(900) }, { preparer, jouer: coller(2000) });
  },

  // MyCityCost: the cost of living map, zoomed in on a region then panned slowly; the Paris page scrolls on the phone.
  async mycitycost() {
    const ouvrir = async (page, url) => {
      await page.setRequestInterception(true);
      page.on('request', (req) => (pub.test(new URL(req.url()).hostname) ? req.abort() : req.continue()));
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 60_000 });
      await attendre(1500);
      await refuserCookies(page);
      await attendre(1500);
    };
    await mettreEnScene('mycitycost', '#e8603c', 'mycitycost.com', {
      async preparer(page) {
        await ouvrir(page, 'https://mycitycost.com/map');
        // Pollution layer: green to red, more telling than the default data coverage layer.
        await page.select('select:has(option[value="pm25"])', 'pm25');
        await attendre(1500);
        const r = await page.$eval('.leaflet-container', (el) => el.getBoundingClientRect().toJSON());
        page.carte = { x: r.x + r.width / 2, y: r.y + r.height / 2 };
        await page.mouse.move(page.carte.x, page.carte.y);
      },
      async jouer(page) {
        const { x, y } = page.carte;
        await attendre(500);
        await page.click('.leaflet-control-zoom-in');
        await attendre(1300);
        // Slow drag across the map.
        await page.mouse.move(x, y);
        await page.mouse.down();
        for (let k = 1; k <= 50; k++) {
          await page.mouse.move(x - k * 6, y - k * 2);
          await attendre(45);
        }
        await page.mouse.up();
        await attendre(500);
        await page.click('.leaflet-control-zoom-in');
        await attendre(1800);
      },
    }, {
      preparer: (page) => ouvrir(page, 'https://mycitycost.com/city/paris'),
      async jouer(page) {
        await attendre(1200);
        for (let k = 0; k < 90; k++) {
          await page.evaluate(() => scrollBy(0, 9));
          await attendre(40);
        }
        await attendre(1600);
      },
    });
  },

  // Undercover+: three phones (same layout as the screenshot) playing at the same time.
  async 'undercover-plus'() {
    const tel = (x, y) =>
      `<div class="ecran" style="left:${x}px;top:${y}px;width:340px;height:709px;border-radius:44px;padding:12px;box-sizing:border-box">
        <iframe src="https://trk78.github.io/undercover-plus/" style="width:430px;height:932px;transform:scale(${316 / 430});transform-origin:0 0;border-radius:32px"></iframe></div>`;
    await filmer(
      'undercover-plus',
      async (page) => {
        // Stage written into the app's own origin (a 404 page, whose CSP would block the iframes without the bypass).
        await page.setBypassCSP(true);
        await page.goto('https://trk78.github.io/undercover-plus/__scene', { timeout: 60_000 });
        await page.setContent(scene(fondSvg('#8e2de2') + tel(820, 120) + tel(1180, 60) + tel(1540, 150)), { waitUntil: 'networkidle2', timeout: 60_000 });
        const [a, b, c] = page.frames().filter((f) => f !== page.mainFrame());
        // Wait until each app has declared its state (its `let` globals throw before that).
        for (const f of [a, b, c]) await f.waitForFunction(() => { try { return Array.isArray(currentPlayers); } catch { return false; } }, { timeout: 30_000 });
        // Same six players in every phone; avatars generated by the app, one color each.
        const joueurs = async (f, n) =>
          f.evaluate(async (n) => {
            const noms = ['Léa', 'Hugo', 'Inès', 'Malik', 'Chloé', 'Tom'];
            const alea = Math.random;
            const liste = [];
            for (const [i, nom] of noms.slice(0, n).entries()) {
              Math.random = () => i / 6 + 0.01;
              liste.push({ id: i + 1, name: nom, avatar: await generateDefaultAvatar() });
            }
            Math.random = alea;
            currentPlayers = liste;
            renderSetupList();
          }, n);
        await joueurs(a, 3);
        await joueurs(b, 6);
        await b.evaluate(() => {
          settings.undercover = 1;
          settings.white = 1;
          setupGame();
        });
        await joueurs(c, 6);
        await c.evaluate(() => {
          settings.undercover = 1;
          settings.white = 1;
          setupGame();
          for (let i = 0; i < currentPlayers.length; i++) nextPlayerDistrib();
          renderGameList();
        });
        page.telephones = [a, b, c];
        await attendre(800);
      },
      async (page) => {
        const [a, b, c] = page.telephones;
        const civil = () =>
          c.evaluate(() => {
            const p = gameData.find((p) => !p.isDead && p.role !== 'Undercover' && p.role !== 'Mr. White');
            if (p) p.isDead = true;
            renderGameList();
          });
        const ajouter = (n) =>
          a.evaluate(async (n) => {
            const noms = ['Léa', 'Hugo', 'Inès', 'Malik', 'Chloé', 'Tom'];
            const alea = Math.random;
            Math.random = () => (n - 1) / 6 + 0.01;
            currentPlayers.push({ id: n, name: noms[n - 1], avatar: await generateDefaultAvatar() });
            Math.random = alea;
            renderSetupList();
          }, n);
        await attendre(700);
        await b.evaluate(() => showSecret());
        await ajouter(4);
        await attendre(1500);
        await b.evaluate(() => hideSecret());
        await civil();
        await attendre(900);
        await b.evaluate(() => nextPlayerDistrib());
        await ajouter(5);
        await attendre(1200);
        await b.evaluate(() => showSecret());
        await attendre(1200);
        await ajouter(6);
        await civil();
        await attendre(1600);
        await b.evaluate(() => hideSecret());
        await attendre(900);
      },
    );
  },

  // Zino: needs a signed-in account, so the three phones play the app tour recorded for its website,
  // each from a different moment (offsets kept under the 19.2 s tour, so no phone wraps around).
  async zino() {
    const tour = `data:video/mp4;base64,${readFileSync('../zino/docs/img/tour-fr.mp4').toString('base64')}`;
    const tel = (x, y, debut) =>
      `<div class="ecran" style="left:${x}px;top:${y}px;width:340px;height:699px;border-radius:44px;padding:12px;box-sizing:border-box">
        <video src="${tour}" data-debut="${debut}" muted playsinline preload="auto" style="width:316px;height:675px;object-fit:cover;border-radius:32px"></video></div>`;
    await filmer(
      'zino',
      async (page) => {
        await page.setContent(scene(fondSvg('#1fc8ff') + tel(820, 120, 0) + tel(1180, 60, 6) + tel(1540, 150, 11.5)), { waitUntil: 'load' });
        await page.evaluate(() =>
          Promise.all(
            [...document.querySelectorAll('video')].map(
              (v) =>
                new Promise((ok) => {
                  v.addEventListener('seeked', ok, { once: true });
                  v.currentTime = Number(v.dataset.debut);
                }),
            ),
          ),
        );
      },
      async (page) => {
        await page.evaluate(() => document.querySelectorAll('video').forEach((v) => v.play()));
        await attendre(7000);
      },
    );
  },

  // UniDroid: the launcher screens change on the TV while the remote screens change on the phone.
  async 'unidroid-suite'() {
    const dossier = '../unidroid-suite/docs/screenshots';
    const img = (f) => `data:image/png;base64,${readFileSync(`${dossier}/${f}`).toString('base64')}`;
    const pile = (fichiers, w) =>
      fichiers.map((f, k) => `<img src="${img(f)}" style="position:absolute;inset:0;width:${w}px;opacity:${k ? 0 : 1};transition:opacity .9s" data-k="${k}">`).join('');
    await filmer(
      'unidroid-suite',
      async (page) => {
        await page.setContent(
          scene(
            fondSvg('#b3263a') +
              `<div class="ecran" id="tv" style="left:640px;top:60px;width:1180px;height:664px;border-radius:18px">${pile(['launcher-home.png', 'launcher-picture.png', 'launcher-settings.png'], 1180)}</div>` +
              `<div class="ecran" id="tel" style="left:1520px;top:380px;width:330px;height:691px;border-radius:42px;padding:10px;box-sizing:border-box"><div style="position:relative;width:310px;height:671px;overflow:hidden;border-radius:32px">${pile(['remote.png', 'remote-add.png', 'remote-edit.png'], 310)}</div></div>`,
          ),
          { waitUntil: 'load' },
        );
        await attendre(500);
      },
      async (page) => {
        const montrer = (id, k) =>
          page.evaluate((id, k) => document.querySelectorAll(`#${id} img`).forEach((i) => (i.style.opacity = i.dataset.k == k ? '1' : '0')), id, k);
        await attendre(1600);
        await montrer('tel', 1);
        await attendre(1000);
        await montrer('tv', 1);
        await attendre(2000);
        await montrer('tel', 2);
        await attendre(1000);
        await montrer('tv', 2);
        await attendre(2400);
      },
    );
  },
};

mkdirSync(SORTIE, { recursive: true });
const choix = process.argv.slice(2);
for (const [nom, f] of Object.entries(projets)) {
  if (choix.length && !choix.includes(nom)) continue;
  try {
    await f();
  } catch (e) {
    console.error(nom, 'failed:', e.message);
  }
}
await browser.close();
