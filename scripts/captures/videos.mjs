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
import { fond } from './cadre.mjs';

const SORTIE = 'public/projets/videos';
const FONDU = 0.8; // crossfade between the end and the start, in seconds
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const pub = /googlesyndication|doubleclick|adservice|googletagmanager|profitablecpm/;
const portable = (page) => page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1.5 });

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: true,
  defaultViewport: { width: 1920, height: 1200 },
});

// Films `scene(page)` once `preparer(page)` is done, then encodes the loop.
const filmer = async (nom, preparer, scene) => {
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
  boucler(brut, `${SORTIE}/${nom}.mp4`);
  rmSync(brut);
  console.log(nom, 'ok');
};

// The end of the clip fades into its first FONDU seconds: the output starts where that head ends.
// The raw screencast has no duration in its header: normalise it to 24 fps first, then measure it.
const boucler = (brut, sortie) => {
  const entree = brut.replace('.webm', '.mp4');
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', brut, '-vf', 'fps=24,scale=1280:-2', '-c:v', 'libx264', '-crf', '12', entree]);
  const d = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', entree]).toString());
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
    await filmer(
      'ghostmails',
      async (page) => {
        await portable(page);
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
        await page.locator('::-p-text(Confirmez votre inscription)').click();
        await attendre(1500);
      },
      async (page) => {
        await attendre(2200);
        await page.locator('::-p-text(Votre code de vérification)').click();
        await attendre(2400);
        await page.locator('::-p-text(Votre code de réduction)').click();
        await attendre(2200);
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
    await filmer(
      'pastetok',
      async (page) => {
        await portable(page);
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
      },
      async (page) => {
        await attendre(900);
        await page.type('input', 'https://www.tiktok.com/@chef.lea/video/7400000000000000000', { delay: 28 });
        await attendre(400);
        await page.click('button[type="submit"]');
        await page.waitForNavigation({ timeout: 8000 }).catch(() => {});
        await attendre(2600);
      },
    );
  },

  // MyCityCost: the cost of living map, zoomed in on a region then panned slowly.
  async mycitycost() {
    await filmer(
      'mycitycost',
      async (page) => {
        await page.setRequestInterception(true);
        page.on('request', (req) => (pub.test(new URL(req.url()).hostname) ? req.abort() : req.continue()));
        await portable(page);
        await page.goto('https://mycitycost.com/map', { waitUntil: 'networkidle2', timeout: 60_000 });
        await page.locator('::-p-text(Refuser)').setTimeout(3000).click().catch(() => {});
        await attendre(3000);
        const r = await page.$eval('.leaflet-container', (el) => el.getBoundingClientRect().toJSON());
        page.carte = { x: r.x + r.width / 2, y: r.y + r.height / 2 };
        await page.mouse.move(page.carte.x, page.carte.y);
      },
      async (page) => {
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
    );
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
