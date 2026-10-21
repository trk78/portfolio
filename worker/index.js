const NOMS = ['undercover-joueurs', 'pastetok-videos'];

function origineAutorisee(origin) {
  return origin === 'https://trk78.github.io' || /^http:\/\/localhost(?::\d+)?$/.test(origin || '');
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
          undercoverJoueurs: valeurs[NOMS[0]] || 0,
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

    // Garde-fous simples : origine obligatoire, corps limité, noms et incréments bornés.
    // Shortcut : pas de limite par IP ; une origine peut être usurpée hors navigateur.
    // Aucun identifiant ni IP n'est conservé ; les appels répétés restent possibles.
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
    if (donnees.nom === NOMS[0] && (!Number.isInteger(donnees.n) || donnees.n < 3 || donnees.n > 20)) {
      return new Response('Incrément invalide', { status: 400, headers });
    }
    const n = donnees.nom === NOMS[1] ? 1 : donnees.n;
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
