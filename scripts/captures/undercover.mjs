// Capture d'Undercover+ en pleine partie : 6 joueurs, 1 Undercover + 1 Mr. White, un civil déjà éliminé.
// Tout reste dans le navigateur de capture (localStorage d'un profil jetable) : rien n'est envoyé nulle part.
import puppeteer from 'puppeteer-core';

const SORTIE = process.argv[2] ?? 'public/projets/apercus/undercover-plus.webp';
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: true,
  defaultViewport: { width: 1920, height: 1200 },
});
const page = await browser.newPage();
page.on('dialog', (d) => d.accept());
await page.goto('https://trk78.github.io/undercover-plus/', { waitUntil: 'networkidle2', timeout: 60_000 });

const etat = await page.evaluate(async () => {
  const noms = ['Léa', 'Hugo', 'Inès', 'Malik', 'Chloé', 'Tom'];
  const couleurs = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6', '#e67e22'];
  // Avatars générés par l'app elle-même, une couleur différente par joueur.
  const aleaOrigine = Math.random;
  const joueurs = [];
  for (const [i, nom] of noms.entries()) {
    Math.random = () => i / couleurs.length + 0.01;
    joueurs.push({ id: i + 1, name: nom, avatar: await generateDefaultAvatar() });
  }
  Math.random = aleaOrigine;
  currentPlayers = joueurs;
  saveLobbyPlayers();
  renderSetupList();
  settings.undercover = 1;
  settings.white = 1;
  setupGame();
  // Distribution des mots : on passe le téléphone à chaque joueur.
  for (let i = 0; i < joueurs.length; i++) nextPlayerDistrib();
  // Un civil a déjà été éliminé au premier tour.
  const civil = gameData.find((p) => p.role !== 'Undercover' && p.role !== 'Mr. White');
  civil.isDead = true;
  renderGameList();
  return { ecranJeu: !document.getElementById('screen-game').classList.contains('hidden'), elimine: civil.name };
});
await new Promise((r) => setTimeout(r, 800));
await page.screenshot({ path: SORTIE, type: 'webp', quality: 80 });
console.log(etat);
await browser.close();
