// Capture ghostmails.cc with a fake inbox: all API requests are mocked
// (no real address created, public counter unchanged).
import puppeteer from 'puppeteer-core';

const SORTIE = process.argv[2] ?? 'public/projets/apercus/ghostmails.webp';
const now = Date.now();
const min = 60_000;
const ADDR = { id: 'demo', address: 'velvet.otter42@ghostmails.cc', domain: 'ghostmails.cc', created_at: now - 6 * min, expires_at: now + 54 * min };

const emails = [
  { id: 'e1', sender: 'Pixel Forum <bonjour@pixelforum.example>', subject: 'Confirmez votre inscription à Pixel Forum', has_attachments: 0, received_at: now - 1 * min, read: 0 },
  { id: 'e2', sender: 'Boutique Lumen <commandes@lumen.example>', subject: 'Votre code de réduction de bienvenue : -15 %', has_attachments: 0, received_at: now - 3 * min, read: 0 },
  { id: 'e3', sender: 'Studio Nova <no-reply@studionova.example>', subject: 'Votre code de vérification : 482 913', has_attachments: 0, received_at: now - 4 * min, read: 1 },
  { id: 'e4', sender: 'Le Fil Tech <newsletter@lefiltech.example>', subject: 'Les 5 outils dev de la semaine', has_attachments: 1, received_at: now - 5 * min, read: 1 },
];

const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">
  <div style="background:linear-gradient(135deg,#7c6aff,#a78bfa);padding:28px 32px;color:#fff">
    <div style="font-size:22px;font-weight:700">Pixel Forum</div>
    <div style="opacity:.85;margin-top:4px">La communauté des créateurs pixel art</div>
  </div>
  <div style="padding:28px 32px;color:#1f2937;line-height:1.6">
    <h2 style="margin:0 0 12px;font-size:20px">Bienvenue parmi nous !</h2>
    <p style="margin:0 0 16px">Merci de vous être inscrit. Il ne reste qu'une étape : confirmez votre adresse e-mail pour activer votre compte.</p>
    <p style="text-align:center;margin:28px 0"><a href="#" style="background:#7c6aff;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:700;display:inline-block">Confirmer mon adresse</a></p>
    <p style="margin:0;color:#6b7280;font-size:13px">Ce lien expire dans 24 heures. Si vous n'êtes pas à l'origine de cette inscription, ignorez simplement ce message.</p>
  </div>
  <div style="padding:16px 32px;background:#f9fafb;color:#9ca3af;font-size:12px">Pixel Forum · Se désabonner</div>
</div>`;

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: true,
  defaultViewport: { width: 1920, height: 1200 },
});
const page = await browser.newPage();
await page.evaluateOnNewDocument(() => {
  localStorage.setItem('gm_consent', 'essential');
  localStorage.setItem('gm_lang', 'fr');
});
await page.setRequestInterception(true);
page.on('request', (req) => {
  const url = new URL(req.url());
  if (url.hostname !== 'api.ghostmails.cc' && !url.hostname.endsWith('workers.dev')) {
    // Keep ad networks out of the capture.
    if (/googlesyndication|doubleclick|adservice|profitablecpm/.test(url.hostname)) return req.abort();
    return req.continue();
  }
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
    return json({ ...e, read: 1, body_text: 'Bienvenue sur Pixel Forum', body_html: m[1] === 'e1' ? html : `<p>${e.subject}</p>`, attachments: [] });
  }
  return json({});
});

await page.goto('https://ghostmails.cc/', { waitUntil: 'networkidle2', timeout: 60_000 });
await new Promise((r) => setTimeout(r, 1500));
// Open the first email (the one with HTML content).
await page.locator('::-p-text(Confirmez votre inscription)').click();
const ouvert = true;
await new Promise((r) => setTimeout(r, 2500));
await page.screenshot({ path: SORTIE, type: 'webp', quality: 80 });
console.log('ouvert:', ouvert);
await browser.close();
