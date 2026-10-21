export type Service = { titre: string; texte: string; points: string[] };
export type Etape = { titre: string; texte: string };
export type Projet = {
  nom: string;
  type: string; // ex. « Application web », « App mobile »
  annee: string;
  resume: string;
  stack: string[]; // mêmes libellés que les badges du README du projet
  url?: string; // site en ligne
  repo?: string; // dépôt GitHub public
  logo?: string; // chemin dans public/, ex. /projets/nom.svg
  apercu?: string; // capture du site affichée au survol (public/projets/apercus/)
};

export const services: Service[] = [
  {
    titre: 'Sites vitrines',
    texte: "Un site rapide, bien référencé, que vous pouvez faire évoluer sans moi.",
    points: ['Design sur mesure', 'SEO technique', 'Hébergement inclus ou chez vous'],
  },
  {
    titre: 'Applications web',
    texte: 'Outils métier, plateformes, tableaux de bord : du prototype à la production.',
    points: ['Next.js, Astro, TypeScript', 'Bases de données', 'Comptes utilisateurs'],
  },
  {
    titre: 'Applications mobiles',
    texte: 'Une seule base de code pour Android et iOS, publiée sur les stores.',
    points: ['Flutter + Firebase', 'Notifications, paiements', 'Publication stores'],
  },
  {
    titre: 'Automatisation & IA',
    texte: 'Bots, intégrations, agents IA : faire travailler les outils à votre place.',
    points: ['Bots Discord / API', 'Intégration de LLM', 'Scripts & workflows'],
  },
];

export const etapes: Etape[] = [
  { titre: 'Appel', texte: '30 min pour comprendre le besoin. Gratuit, sans engagement.' },
  { titre: 'Devis', texte: 'Périmètre, délai et prix fixes, par écrit, sous 48 h.' },
  { titre: 'Développement', texte: 'Livraisons régulières : vous voyez le projet avancer.' },
  { titre: 'Mise en ligne', texte: 'Déploiement, passation, et suivi après lancement.' },
];

// La section « Projets » n'apparaît que si la liste contient au moins un projet.
export const projets: Projet[] = [
  {
    nom: 'Ghostmails',
    type: 'Service web',
    annee: '2026',
    resume:
      "Adresses e-mail jetables qui reçoivent en direct, sans inscription : valables 1 h, prolongeables jusqu'à 24 h, pièces jointes, notifications, 10 langues. 100 % Cloudflare, en production.",
    stack: ['Next.js 15', 'TypeScript', 'Hono', 'Tailwind CSS', 'Cloudflare Workers', 'Cloudflare Pages'],
    url: 'https://ghostmails.cc',
    logo: '/projets/ghostmails.svg',
    apercu: '/projets/apercus/ghostmails.webp',
  },
  {
    nom: 'MyCityCost',
    type: 'Application web',
    annee: '2026',
    resume:
      'Comparer le coût et la qualité de vie entre 7 674 villes dans 179 pays : fiches ville, comparateur, carte, classement et simulateur de budget. Uniquement des données publiques sourcées, sans publicité.',
    stack: ['Next.js 14', 'TypeScript', 'Prisma 7', 'Neon PostgreSQL', 'Tailwind CSS 4', 'Cloudflare'],
    url: 'https://mycitycost.com',
    logo: '/projets/mycitycost.svg',
    apercu: '/projets/apercus/mycitycost.webp',
  },
  {
    nom: 'Undercover+',
    type: 'Jeu web (PWA)',
    annee: '2025',
    resume:
      "Le jeu de déduction sociale Undercover sur un seul téléphone, avec des paires de mots générées par IA sur n'importe quel thème. Jouable hors ligne, en français et en anglais, open source.",
    stack: ['Vanilla JavaScript', 'PWA', 'Gemini 2.5 Flash', 'Cloudflare Workers', 'GitHub Pages'],
    url: 'https://trk78.github.io/undercover-plus/',
    repo: 'https://github.com/trk78/undercover-plus',
    logo: '/projets/undercover-plus.webp',
    apercu: '/projets/apercus/undercover-plus.webp',
  },
  {
    nom: 'PasteTok',
    type: 'Outil web',
    annee: '2026',
    resume:
      'Télécharger une vidéo TikTok en MP4 sans filigrane, avec filigrane ou en MP3, avec aperçu avant téléchargement. Sans cookie, open source et bilingue.',
    stack: ['Next.js 14', 'TypeScript', 'Tailwind CSS', 'GitHub Pages'],
    url: 'https://trk78.github.io/pastetok/',
    repo: 'https://github.com/trk78/pastetok',
    logo: '/projets/pastetok.svg',
    apercu: '/projets/apercus/pastetok.webp',
  },
  {
    nom: 'UniDroid',
    type: 'App Android TV',
    annee: '2026',
    resume:
      "Écran d'accueil rapide pour box Android TV et vidéoprojecteurs, sans pub, avec une télécommande sur téléphone intégrée : appairage par code, souris, clavier en direct, 6 à 8 ms par touche.",
    stack: ['Android 5+', 'Java', 'Android TV'],
    repo: 'https://github.com/trk78/unidroid-suite',
    logo: '/projets/unidroid-suite.webp',
    apercu: '/projets/apercus/unidroid-suite.webp',
  },
];

// Chiffres animés en tête de la section Projets. Avec `source`, la valeur est lue en direct (JSON, champ `champ`)
// et le chiffre reste masqué tant qu'elle n'est pas arrivée.
export type Chiffre = { valeur: number; label: string; source?: string; champ?: string };
export const chiffres: Chiffre[] = [
  {
    valeur: 0,
    label: 'joueurs sur Undercover+',
    source: 'https://compteurs.timeo-jeannin.workers.dev/stats',
    champ: 'undercoverJoueurs',
  },
  {
    valeur: 0,
    label: 'vidéos TikTok téléchargées sur PasteTok',
    source: 'https://compteurs.timeo-jeannin.workers.dev/stats',
    champ: 'pastetokVideos',
  },
  { valeur: 7674, label: 'villes comparées sur MyCityCost' },
  {
    valeur: 0,
    label: 'adresses générées sur Ghostmails',
    source: 'https://api.ghostmails.cc/api/stats',
    champ: 'addressesCreated',
  },
  { valeur: 24, label: 'heures max pour une réponse' },
];
