// 3D wine bottle behind the wine estate demo page: the label draws itself, the wine fills the bottle,
// then the bottle turns its label to the camera, all driven by scroll (each section gives its stage in data-q).
// Hovering a wine on the page previews it (wine colour and label). Procedural: no model or photo to download.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export type Cuvee = { nom: string; type: string; millesime: string; couleur: string };

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const etape = (a: number, b: number, p: number) => clamp01((p - a) / (b - a));
const doux = (t: number) => t * t * (3 - 2 * t);

// Bordeaux bottle profile (radius, height), from the base to the lip.
const PROFIL = [
  [0, 0], [0.42, 0], [0.465, 0.03], [0.475, 0.12], [0.475, 1.72], [0.462, 1.88], [0.4, 2.1], [0.27, 2.32],
  [0.18, 2.46], [0.158, 2.58], [0.155, 2.86], [0.172, 2.89], [0.172, 2.99], [0.14, 3.0], [0, 3.0],
];
const rayonA = (y: number) => {
  for (let i = 1; i < PROFIL.length; i++) {
    const [r0, y0] = PROFIL[i - 1], [r1, y1] = PROFIL[i];
    if (y >= y0 && y <= y1 && y1 > y0) return r0 + ((r1 - r0) * (y - y0)) / (y1 - y0);
  }
  return 0;
};
const PLEIN = 2.2; // wine level when full (shoulder)

export function demarrer(
  canvas: HTMLCanvasElement,
  ancres: HTMLElement[],
  defaut: Cuvee,
  echec: (e: unknown) => void,
  pret: () => void,
) {
  const animer = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = true;
  renderer.localClippingEnabled = true;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.02).texture;
  scene.environmentIntensity = 0.9;
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);

  // ---------- Background: warm paper vignette centred behind the bottle (redrawn on resize)
  const fond = document.createElement('canvas');
  fond.width = fond.height = 512;
  const texFond = new THREE.CanvasTexture(fond);
  texFond.colorSpace = THREE.SRGBColorSpace;
  scene.background = texFond;
  const dessinerFond = (cx: number, cy: number) => {
    const c = fond.getContext('2d')!;
    const g = c.createRadialGradient(cx * 512, cy * 512, 0, cx * 512, cy * 512, 460);
    g.addColorStop(0, '#fbf7ef');
    g.addColorStop(0.6, '#efe6d6');
    g.addColorStop(1, '#ddd0bb');
    c.fillStyle = g;
    c.fillRect(0, 0, 512, 512);
    texFond.needsUpdate = true;
  };

  // ---------- Lights: soft warm key with shadow, cool rim outlining the glass, golden hour later
  const cle = new THREE.DirectionalLight('#fff1dc', 2.2);
  cle.position.set(3, 6, 4);
  cle.castShadow = true;
  cle.shadow.mapSize.set(2048, 2048);
  cle.shadow.radius = 8;
  cle.shadow.camera.left = cle.shadow.camera.bottom = -3;
  cle.shadow.camera.right = cle.shadow.camera.top = 3;
  const contre = new THREE.DirectionalLight('#e8f0ff', 2.4);
  contre.position.set(-3, 3, -4);
  const appoint = new THREE.DirectionalLight('#ffffff', 0.4);
  appoint.position.set(-3, 2, 4);
  scene.add(cle, contre, appoint);

  // ---------- Marble plinth and shadow catcher
  const marbre = document.createElement('canvas');
  marbre.width = marbre.height = 1024;
  {
    const c = marbre.getContext('2d')!;
    c.fillStyle = '#efe9df';
    c.fillRect(0, 0, 1024, 1024);
    for (let k = 0; k < 26; k++) {
      c.strokeStyle = `rgba(150,135,115,${0.08 + Math.random() * 0.18})`;
      c.lineWidth = 0.6 + Math.random() * 2.4;
      c.beginPath();
      let x = Math.random() * 1024, y = Math.random() * 1024;
      c.moveTo(x, y);
      for (let j = 0; j < 14; j++) c.lineTo((x += (Math.random() - 0.3) * 120), (y += (Math.random() - 0.5) * 90));
      c.stroke();
    }
  }
  const texMarbre = new THREE.CanvasTexture(marbre);
  texMarbre.colorSpace = THREE.SRGBColorSpace;
  const socle = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.55, 0.16, 96), new THREE.MeshPhysicalMaterial({ map: texMarbre, roughness: 0.25, clearcoat: 0.6 }));
  socle.position.y = -0.08;
  socle.receiveShadow = socle.castShadow = true;
  const sol = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ opacity: 0.18 }));
  sol.rotation.x = -Math.PI / 2;
  sol.position.y = -0.16;
  sol.receiveShadow = true;
  scene.add(socle, sol);

  const bouteille = new THREE.Group();
  scene.add(bouteille);

  // ---------- Glass: physically based transmission, faint green tint
  const verre = new THREE.Mesh(
    new THREE.LatheGeometry(PROFIL.map(([r, y]) => new THREE.Vector2(r, y)), 128),
    new THREE.MeshPhysicalMaterial({
      color: '#ffffff', metalness: 0, roughness: 0.04, transmission: 1, thickness: 0.35, ior: 1.5,
      attenuationColor: new THREE.Color('#c9dcc0'), attenuationDistance: 2.5, clearcoat: 1, clearcoatRoughness: 0.03,
      specularIntensity: 1, envMapIntensity: 1.2, side: THREE.DoubleSide,
    }),
  );
  verre.castShadow = true;
  bouteille.add(verre);

  // ---------- Wine: an inner volume clipped at the current level, with a flat surface on top
  const niveau = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
  const matVin = new THREE.MeshPhysicalMaterial({ color: defaut.couleur, roughness: 0.1, transmission: 0.08, thickness: 1, clearcoat: 0.6, clippingPlanes: [niveau], side: THREE.DoubleSide });
  const vin = new THREE.Mesh(
    new THREE.LatheGeometry(PROFIL.filter(([, y]) => y <= 2.6).map(([r, y]) => new THREE.Vector2(r * 0.93, Math.max(y, 0.05))), 96),
    matVin,
  );
  const surface = new THREE.Mesh(new THREE.CircleGeometry(1, 64), new THREE.MeshPhysicalMaterial({ color: defaut.couleur, roughness: 0.05, clearcoat: 1, transmission: 0.2 }));
  surface.rotation.x = -Math.PI / 2;
  bouteille.add(vin, surface);

  // ---------- Capsule over the cork
  const capsule = new THREE.Mesh(new THREE.CylinderGeometry(0.176, 0.176, 0.42, 48), new THREE.MeshPhysicalMaterial({ color: '#5a1022', metalness: 0.75, roughness: 0.3, clearcoat: 0.6 }));
  capsule.position.y = 2.8;
  capsule.castShadow = true;
  bouteille.add(capsule);

  // ---------- Label: drawn on a canvas, revealed progressively (border, then text), rewritten for a previewed wine
  const etiquette = document.createElement('canvas');
  etiquette.width = 1024;
  etiquette.height = 768;
  const ctx = etiquette.getContext('2d')!;
  const texEtiquette = new THREE.CanvasTexture(etiquette);
  texEtiquette.colorSpace = THREE.SRGBColorSpace;
  texEtiquette.anisotropy = 8;
  let dessinee = '';
  const dessinerEtiquette = (c: Cuvee, k: number) => {
    const etat = `${c.nom}|${k.toFixed(2)}`;
    if (etat === dessinee) return;
    dessinee = etat;
    const W = 1024, H = 768;
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#f6efe1';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(160,130,90,.06)';
    for (let i = 0; i < 900; i++) ctx.fillRect((i * 97) % W, (i * 61) % H, 2, 2);
    // Double gold frame traced around the label.
    ctx.strokeStyle = '#a8823d';
    for (const [m, l] of [[40, 4], [58, 1.5]]) {
      const per = 2 * (W - 2 * m + H - 2 * m);
      ctx.lineWidth = l;
      ctx.setLineDash([per * doux(etape(0, 0.5, k)), per]);
      ctx.strokeRect(m, m, W - 2 * m, H - 2 * m);
    }
    ctx.setLineDash([]);
    const texte = (s: string, police: string, y: number, couleur: string, a: number) => {
      ctx.globalAlpha = a;
      ctx.fillStyle = couleur;
      ctx.font = police;
      ctx.textAlign = 'center';
      ctx.fillText(s, W / 2, y);
    };
    const serif = "'Cormorant Garamond', Georgia, serif";
    texte('VAL DE LOIRE', `600 30px ${serif}`, 140, '#8a6a33', etape(0.35, 0.55, k));
    // Engraved hills and mist under the name.
    ctx.globalAlpha = etape(0.45, 0.65, k);
    ctx.strokeStyle = '#7d6a4f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(300, 330);
    ctx.quadraticCurveTo(420, 250, 512, 300);
    ctx.quadraticCurveTo(610, 240, 724, 330);
    ctx.stroke();
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(330 + i * 30, 345 + i * 14);
      ctx.bezierCurveTo(450, 335 + i * 14, 570, 355 + i * 14, 694 - i * 30, 345 + i * 14);
      ctx.stroke();
    }
    texte('Clos des Brumes', `italic 600 108px ${serif}`, 450, '#3b1520', etape(0.5, 0.75, k));
    texte(c.nom, `500 46px ${serif}`, 530, '#6b2233', etape(0.6, 0.85, k));
    texte(`${c.type} · ${c.millesime}`, `600 30px ${serif}`, 600, '#8a6a33', etape(0.7, 0.92, k));
    texte('MIS EN BOUTEILLE AU DOMAINE', `600 20px ${serif}`, 690, '#9c8763', etape(0.8, 1, k));
    ctx.globalAlpha = 1;
    texEtiquette.needsUpdate = true;
  };
  const etiquetteMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.479, 0.479, 0.86, 96, 1, true, -1.2, 2.4),
    new THREE.MeshStandardMaterial({ map: texEtiquette, roughness: 0.85, side: THREE.DoubleSide }),
  );
  etiquetteMesh.position.y = 1.05;
  bouteille.add(etiquetteMesh);

  // ---------- Scroll: q interpolated between the sections' anchors (section top at 65% of the screen)
  let cible = 0, q = 0, mobile = false;
  const mesure = () => {
    const y = scrollY + innerHeight * 0.65;
    const pts = ancres.map((a) => [a.getBoundingClientRect().top + scrollY, Number(a.dataset.q)]);
    cible = pts[0][1];
    for (let k = 0; k < pts.length - 1; k++) {
      if (y >= pts[k][0]) cible = pts[k][1] + (pts[k + 1][1] - pts[k][1]) * clamp01((y - pts[k][0]) / (pts[k + 1][0] - pts[k][0]));
    }
  };
  const taille = () => {
    const w = innerWidth, h = innerHeight;
    if (!w || !h) return;
    mobile = w <= 860;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    if (mobile) camera.setViewOffset(w, h, 0, h * 0.2, w, h);
    else camera.setViewOffset(w, h, -w * 0.24, 0, w, h);
    camera.updateProjectionMatrix();
    dessinerFond(mobile ? 0.5 : 0.74, mobile ? 0.3 : 0.5);
    mesure();
  };
  taille();
  addEventListener('resize', taille);
  new ResizeObserver(taille).observe(document.documentElement);
  addEventListener('scroll', mesure, { passive: true });

  let choix: Cuvee | null = null, apercu = 0, arret = false, premier = false;
  const couleur = new THREE.Color(defaut.couleur), couleurCible = new THREE.Color();
  const neutre = new THREE.Color('#fff1dc'), dore = new THREE.Color('#ffc27a');
  const debut = performance.now();
  canvas.addEventListener('webglcontextlost', () => {
    arret = true;
    echec(new Error('WebGL context lost'));
  });
  const image = () => {
    const t = (performance.now() - debut) / 1000;
    q += (cible - q) * 0.07;
    apercu += ((choix ? 1 : 0) - apercu) * 0.1;

    // Label, then wine (a previewed wine is shown full with its own label).
    const cuvee = choix ?? defaut;
    dessinerEtiquette(apercu > 0.5 ? cuvee : defaut, Math.max(etape(0.12, 0.3, q), apercu));
    couleurCible.set(apercu > 0.02 ? cuvee.couleur : defaut.couleur);
    couleur.lerp(couleurCible, 0.08);
    matVin.color.copy(couleur);
    (surface.material as THREE.MeshPhysicalMaterial).color.copy(couleur);
    const rempli = Math.max(doux(etape(0.3, 0.52, q)), apercu);
    const h = 0.06 + rempli * (PLEIN - 0.06);
    niveau.constant = h;
    vin.visible = surface.visible = rempli > 0.01;
    surface.position.y = h;
    surface.scale.setScalar(Math.max(rayonA(h) * 0.93, 0.01));

    // Turn: slow spin, then the label comes to face the camera for the close-up (or the preview).
    const arrivee = doux(clamp01(t / 1.4));
    bouteille.position.y = (1 - arrivee) * -0.6;
    const tour = q * Math.PI * 3 + (animer ? t * 0.25 : 0);
    const face = Math.max(doux(etape(0.55, 0.7, q)) * (1 - etape(0.9, 1, q)), apercu);
    const vise = Math.round(tour / (Math.PI * 2)) * Math.PI * 2;
    bouteille.rotation.y = tour + (vise - tour) * face;
    bouteille.rotation.z = Math.sin(t * 0.6) * 0.01 * (animer ? 1 : 0);

    // Golden hour over the tasting part.
    const heure = Math.sin(Math.PI * etape(0.55, 0.95, q));
    cle.color.copy(neutre).lerp(dore, heure * 0.7);
    cle.intensity = 2.2 + heure * 0.6;

    // Camera: three-quarter view, close on the label in the middle, wider at the end.
    const pres = Math.max(Math.sin(Math.PI * etape(0.5, 0.95, q)), apercu * 0.6);
    const dist = (mobile ? 13 : 10) - pres * 2.6;
    const elev = 0.18 - pres * 0.1;
    const az = 0.35 + (animer ? Math.sin(t * 0.2) * 0.05 : 0);
    camera.position.set(Math.sin(az) * Math.cos(elev) * dist, 1.4 + Math.sin(elev) * dist, Math.cos(az) * Math.cos(elev) * dist);
    camera.lookAt(0, 1.4 - pres * 0.3, 0);
    renderer.render(scene, camera);
    if (!premier) {
      premier = true;
      pret();
    }
  };
  const rendu = () => {
    if (arret) return;
    requestAnimationFrame(rendu);
    if (document.hidden || !innerWidth || !innerHeight) return;
    try {
      image();
    } catch (e) {
      arret = true;
      echec(e);
    }
  };
  // Canvas text needs the label font loaded first.
  document.fonts.load("italic 600 40px 'Cormorant Garamond'").finally(rendu);
  return {
    montrer(c: Cuvee | null) {
      choix = c;
    },
  };
}
