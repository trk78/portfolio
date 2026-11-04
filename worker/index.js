// Each call adds 1: one Undercover+ game started, one PasteTok link submitted.
const NOMS = ['undercover-parties', 'pastetok-videos'];

function origineAutorisee(origin) {
  return origin === 'https://trk78.github.io';
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === '/stats' && request.method === 'GET') {
      try {
        const { results } = await env.DB.prepare(
          'SELECT nom, valeur FROM compteurs WHERE nom IN (?, ?)'
        ).bind(...NOMS).all();
        const valeurs = Object.fromEntries(results.map(({ nom, valeur }) => [nom, valeur]));
        return Response.json({
          undercoverParties: valeurs[NOMS[0]] || 0,
          pastetokVideos: valeurs[NOMS[1]] || 0,
        }, { headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=60' } });
      } catch {
        return new Response('Service indisponible', { status: 503, headers: { 'Access-Control-Allow-Origin': '*' } });
      }
    }

    if (pathname !== '/hit') return new Response('Introuvable', { status: 404 });
    const origin = request.headers.get('Origin');
    if (!origineAutorisee(origin)) return new Response('Origine interdite', { status: 403 });
    const headers = { 'Access-Control-Allow-Origin': origin, 'Vary': 'Origin', 'Cache-Control': 'no-store' };
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: {
        ...headers,
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type',
      } });
    }
    if (request.method !== 'POST') return new Response('Méthode interdite', { status: 405, headers });

    // Simple safeguards: origin required, per-IP limit, body size capped, allow-listed names, fixed increment.
    // The limit's key is not stored by this Worker.
    // shortcut: the origin can be spoofed outside a browser and the limit is per IP, so a distributed script can still inflate the totals; add a signed token if that happens.
    const { success } = await env.LIMITE.limit({ key: request.headers.get('CF-Connecting-IP') || 'inconnue' });
    if (!success) return new Response('Trop de requêtes', { status: 429, headers });

    let donnees;
    try {
      const lecteur = request.body?.getReader();
      if (!lecteur) return new Response('Corps manquant', { status: 400, headers });
      const morceaux = [];
      let taille = 0;
      while (true) {
        const { done, value } = await lecteur.read();
        if (done) break;
        taille += value.byteLength;
        if (taille > 256) {
          await lecteur.cancel();
          return new Response('Corps trop volumineux', { status: 413, headers });
        }
        morceaux.push(value);
      }
      donnees = JSON.parse(await new Blob(morceaux).text());
    } catch {
      return new Response('JSON invalide', { status: 400, headers });
    }
    if (!donnees || !NOMS.includes(donnees.nom)) {
      return new Response('Compteur invalide', { status: 400, headers });
    }
    const n = 1;
    try {
      await env.DB.prepare(
        'INSERT INTO compteurs (nom, valeur) VALUES (?, ?) ON CONFLICT(nom) DO UPDATE SET valeur = valeur + ?'
      ).bind(donnees.nom, n, n).run();
      return new Response(null, { status: 204, headers });
    } catch {
      return new Response('Service indisponible', { status: 503, headers });
    }
  },
};
