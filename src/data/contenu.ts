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
      "Adresses e-mail jetables qui reçoivent en direct, sans inscription. Pièces jointes, 10 langues, en production et monétisé.",
    stack: ['Next.js 15', 'TypeScript', 'Hono', 'Tailwind CSS', 'Cloudflare Workers', 'Cloudflare Pages'],
    url: 'https://ghostmails.cc',
    logo: '/projets/ghostmails.svg',
  },
  {
    nom: 'Undercover+',
    type: 'Jeu web (PWA)',
    annee: '2025',
    resume:
      "Le jeu de déduction sociale Undercover sur un seul téléphone, avec des mots générés par IA sur n'importe quel thème. Jouable hors ligne.",
    stack: ['Vanilla JavaScript', 'PWA', 'Gemini 2.5 Flash', 'Cloudflare Workers', 'GitHub Pages'],
    url: 'https://timeojea.github.io/undercover-plus/',
    repo: 'https://github.com/timeojea/undercover-plus',
    logo: '/projets/undercover-plus.webp',
  },
  {
    nom: 'PasteTok',
    type: 'Outil web',
    annee: '2026',
    resume:
      'Télécharger une vidéo TikTok en MP4 sans filigrane ou en MP3, sans rien installer. Open source, bilingue, 100 % côté navigateur.',
    stack: ['Next.js 14', 'TypeScript', 'Tailwind CSS', 'GitHub Pages'],
    url: 'https://timeojea.github.io/pastetok/',
    repo: 'https://github.com/timeojea/pastetok',
    logo: '/projets/pastetok.svg',
  },
];
