// Simple page capture: node page.mjs <url> <output.webp> [wait_ms]
import puppeteer from 'puppeteer-core';

const [url, sortie, attente = '6000'] = process.argv.slice(2);
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: true,
  defaultViewport: { width: 1920, height: 1200 },
});
const page = await browser.newPage();
await page.setRequestInterception(true);
page.on('request', (req) =>
  /googlesyndication|doubleclick|adservice|googletagmanager/.test(new URL(req.url()).hostname) ? req.abort() : req.continue(),
);
await page.goto(url, { waitUntil: 'networkidle2', timeout: 60_000 });
await new Promise((r) => setTimeout(r, Number(attente)));
await page.screenshot({ path: sortie, type: 'webp', quality: 80 });
await browser.close();
