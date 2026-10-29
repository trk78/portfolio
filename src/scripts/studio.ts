// Product-shot studio for the wine estate demo: renders one scene per URL (?scene=…&w=…&h=…) with Three.js.
// Run locally and captured to WebP by scripts/captures/domaine.mjs; the demo page only uses the images.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

const alea = (graine: number) => () => {
  graine = (graine + 0x6d2b79f5) | 0;
  let t = Math.imul(graine ^ (graine >>> 15), 1 | graine);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const R = alea(7);
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const toile = (w: number, h: number, dessin: (c: CanvasRenderingContext2D) => void) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  dessin(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
};
const OR = '#c9a45c';
const lisser = (pts: number[][], n = 90) => new THREE.SplineCurve(pts.map(([r, y]) => new THREE.Vector2(r, y))).getPoints(n);
const SERIF = "'Cinzel', Georgia, serif";
const ITAL = "'Cormorant Garamond', Georgia, serif";

// ---------- Bottle: Bordeaux profile, glass, wine inside, label, capsule
const PROFIL = [
  [0, 0], [0.42, 0], [0.465, 0.03], [0.475, 0.12], [0.475, 1.72], [0.462, 1.88], [0.4, 2.1], [0.27, 2.32],
  [0.18, 2.46], [0.158, 2.58], [0.155, 2.86], [0.172, 2.89], [0.172, 2.99], [0.14, 3.0], [0, 3.0],
].map(([r, y]) => new THREE.Vector2(r, y));
type Etiquette = { fond: string; encre: string; nom: string; sous: string; motif: 'arbre' | 'bandes' | 'monogramme' | 'vagues' };
const etiquette = (e: Etiquette) =>
  toile(1024, 768, (c) => {
    c.fillStyle = e.fond;
    c.fillRect(0, 0, 1024, 768);
    c.fillStyle = 'rgba(0,0,0,.05)';
    for (let i = 0; i < 1400; i++) c.fillRect(R() * 1024, R() * 768, 2, 2);
    c.strokeStyle = e.encre;
    c.fillStyle = e.encre;
    c.textAlign = 'center';
    if (e.motif === 'arbre') {
      // Engraved bare tree, like a woodcut.
      const branche = (x: number, y: number, a: number, l: number, n: number) => {
        if (n === 0) return;
        const x2 = x + Math.cos(a) * l, y2 = y + Math.sin(a) * l;
        c.lineWidth = n * 1.4;
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x2, y2);
        c.stroke();
        branche(x2, y2, a - 0.42 + (R() - 0.5) * 0.3, l * 0.72, n - 1);
        branche(x2, y2, a + 0.42 + (R() - 0.5) * 0.3, l * 0.72, n - 1);
      };
      branche(512, 560, -Math.PI / 2, 120, 8);
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(380, 560);
      c.quadraticCurveTo(512, 540, 644, 560);
      c.stroke();
    } else if (e.motif === 'bandes') {
      for (let i = 0; i < 9; i++) {
        c.globalAlpha = 0.85;
        c.fillRect(0, 300 + i * 26, 1024, 12);
      }
      c.globalAlpha = 1;
    } else if (e.motif === 'vagues') {
      c.lineWidth = 3;
      for (let i = 0; i < 7; i++) {
        c.beginPath();
        for (let x = 0; x <= 1024; x += 16) c.lineTo(x, 330 + i * 30 + Math.sin(x / 60 + i) * 10);
        c.stroke();
      }
    } else {
      c.lineWidth = 3;
      c.beginPath();
      c.arc(512, 380, 110, 0, Math.PI * 2);
      c.stroke();
      c.font = `600 120px ${SERIF}`;
      c.fillText('CB', 512, 422);
    }
    c.font = `600 66px ${SERIF}`;
    c.fillText(e.nom, 512, e.motif === 'bandes' ? 220 : 170);
    c.font = `italic 500 44px ${ITAL}`;
    c.fillText(e.sous, 512, e.motif === 'bandes' ? 640 : 680);
  });
type Bouteille = { verre: string; distance: number; vin: string | null; etiquette: Etiquette; capsule: string; or?: boolean };
const bouteille = (b: Bouteille) => {
  const g = new THREE.Group();
  const verre = new THREE.Mesh(
    new THREE.LatheGeometry(PROFIL, 160),
    new THREE.MeshPhysicalMaterial({
      color: '#ffffff', roughness: 0.03, transmission: 1, thickness: 0.4, ior: 1.5,
      attenuationColor: new THREE.Color(b.verre), attenuationDistance: b.distance, clearcoat: 1, clearcoatRoughness: 0.02, specularIntensity: 1,
    }),
  );
  verre.castShadow = true;
  g.add(verre);
  if (b.vin) {
    const vin = new THREE.Mesh(
      new THREE.LatheGeometry(PROFIL.filter((p) => p.y <= 2.2).map((p) => new THREE.Vector2(p.x * 0.93, Math.max(p.y, 0.05))).concat([new THREE.Vector2(0.38, 2.2), new THREE.Vector2(0, 2.2)]), 96),
      new THREE.MeshPhysicalMaterial({ color: b.vin, roughness: 0.15, clearcoat: 1 }),
    );
    g.add(vin);
  }
  const lab = new THREE.Mesh(
    new THREE.CylinderGeometry(0.479, 0.479, 0.95, 96, 1, true, -1.25, 2.5),
    new THREE.MeshStandardMaterial({ map: etiquette(b.etiquette), roughness: 0.75 }),
  );
  lab.position.y = 1.0;
  g.add(lab);
  const capsule = new THREE.Mesh(
    new THREE.CylinderGeometry(0.178, 0.17, 0.48, 48),
    new THREE.MeshPhysicalMaterial({ color: b.capsule, metalness: b.or ? 1 : 0.7, roughness: b.or ? 0.25 : 0.35, clearcoat: 0.8 }),
  );
  capsule.position.y = 2.77;
  g.add(capsule);
  return g;
};

// ---------- Wine glass (and flute): thin glass, liquid, optional pouring stream
const verreAVin = (flute: boolean, vin: string, niveau: number) => {
  const g = new THREE.Group();
  const p = flute
    ? [[0, 0], [0.42, 0], [0.43, 0.02], [0.05, 0.06], [0.035, 0.2], [0.035, 1.1], [0.07, 1.2], [0.2, 1.5], [0.25, 2.1], [0.27, 2.7], [0.26, 3.0]]
    : [[0, 0], [0.55, 0], [0.56, 0.02], [0.06, 0.06], [0.045, 0.2], [0.045, 1.0], [0.08, 1.08], [0.35, 1.25], [0.52, 1.55], [0.56, 1.85], [0.5, 2.2], [0.42, 2.45]];
  const verre = new THREE.Mesh(
    new THREE.LatheGeometry(lisser(p, 120), 160),
    new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.04, transmission: 1, thickness: 0.05, ior: 1.5, clearcoat: 0.6, side: THREE.DoubleSide, specularIntensity: 0.55 }),
  );
  g.add(verre);
  const bas = flute ? 1.25 : 1.12;
  const interieur = p.filter(([, y]) => y >= bas && y <= niveau).map(([r, y]) => new THREE.Vector2(r * 0.95, y));
  const rayon = (y: number) => {
    for (let i = 1; i < p.length; i++) if (y >= p[i - 1][1] && y <= p[i][1]) return p[i - 1][0] + ((p[i][0] - p[i - 1][0]) * (y - p[i - 1][1])) / (p[i][1] - p[i - 1][1]);
    return 0;
  };
  const liquide = new THREE.Mesh(
    new THREE.LatheGeometry([new THREE.Vector2(0, bas), ...interieur, new THREE.Vector2(rayon(niveau) * 0.95, niveau), new THREE.Vector2(0, niveau)], 96),
    new THREE.MeshPhysicalMaterial({ color: vin, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.05, sheen: 0.4, sheenColor: new THREE.Color(vin) }),
  );
  g.add(liquide);
  return { g, niveau, rayon };
};
const versement = (vin: string, depuis: THREE.Vector3, vers: THREE.Vector3) => {
  const courbe = new THREE.CatmullRomCurve3([depuis, depuis.clone().lerp(vers, 0.3).add(V(0.15, 0, 0)), depuis.clone().lerp(vers, 0.7).add(V(0.04, 0, 0)), vers]);
  const g = new THREE.Group();
  const mat = new THREE.MeshPhysicalMaterial({ color: vin, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.03 });
  g.add(new THREE.Mesh(new THREE.TubeGeometry(courbe, 160, 0.045, 20), mat));
  // Splash where the stream hits the wine, and a few droplets.
  const anneau = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.025, 12, 40), mat);
  anneau.rotation.x = Math.PI / 2;
  anneau.position.copy(vers);
  g.add(anneau);
  for (let i = 0; i < 14; i++) {
    const d = new THREE.Mesh(new THREE.SphereGeometry(0.015 + R() * 0.03, 16, 12), mat);
    const a = R() * Math.PI * 2;
    d.position.copy(vers).add(V(Math.cos(a) * (0.12 + R() * 0.25), R() * 0.35, Math.sin(a) * (0.12 + R() * 0.25)));
    g.add(d);
  }
  return g;
};

// ---------- Grapes, vine leaves, wine splash ribbons
const grappe = (x: number, y: number, z: number, n: number, echelle: number) => {
  const g = new THREE.Group();
  const mat = new THREE.MeshPhysicalMaterial({ color: '#180818', roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.25, sheen: 0.35, sheenColor: new THREE.Color('#5a4a70') });
  const geo = new THREE.SphereGeometry(0.11, 32, 24);
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const a = R() * Math.PI * 2, r = (1 - t) * 0.32 * R() + 0.05;
    const b = new THREE.Mesh(geo, mat);
    b.position.set(Math.cos(a) * r, -t * 1.1, Math.sin(a) * r);
    b.scale.setScalar(0.85 + R() * 0.3);
    b.castShadow = true;
    g.add(b);
  }
  const tige = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(0, 0.05, 0), V(0.05, 0.25, 0.02), V(-0.05, 0.45, 0)]), 20, 0.018, 8), new THREE.MeshStandardMaterial({ color: '#4b3a22', roughness: 0.8 }));
  g.add(tige);
  g.position.set(x, y, z);
  g.scale.setScalar(echelle);
  return g;
};
const texFeuille = toile(512, 512, (c) => {
  const g = c.createRadialGradient(256, 300, 20, 256, 256, 300);
  g.addColorStop(0, '#2e4416');
  g.addColorStop(0.6, '#1a2a0c');
  g.addColorStop(1, '#4a3210');
  c.fillStyle = g;
  c.fillRect(0, 0, 512, 512);
  c.strokeStyle = 'rgba(170,190,110,.45)';
  c.lineWidth = 3;
  for (let k = 0; k < 5; k++) {
    const a = -Math.PI / 2 + (k - 2) * 0.6;
    c.beginPath();
    c.moveTo(256, 420);
    c.lineTo(256 + Math.cos(a) * 220, 420 + Math.sin(a) * 260);
    c.stroke();
  }
});
const feuille = (x: number, y: number, z: number, rot: THREE.Euler, echelle: number) => {
  const s = new THREE.Shape();
  for (let i = 0; i <= 80; i++) {
    const a = (i / 80) * Math.PI * 2;
    // Five lobes with serrated edges.
    const r = 0.5 * (0.72 + 0.28 * Math.abs(Math.cos(a * 2.5))) * (1 + 0.04 * Math.sin(a * 40));
    const px = Math.cos(a) * r, py = Math.sin(a) * r * 1.05;
    i ? s.lineTo(px, py) : s.moveTo(px, py);
  }
  const geo = new THREE.ShapeGeometry(s, 4);
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i), py = pos.getY(i);
    uv.setXY(i, px + 0.5, py + 0.5);
    pos.setZ(i, (px * px + py * py) * 0.8 - Math.abs(px) * 0.2);
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ map: texFeuille, roughness: 0.6, clearcoat: 0.2, side: THREE.DoubleSide }));
  m.position.set(x, y, z);
  m.rotation.copy(rot);
  m.scale.setScalar(echelle);
  m.castShadow = true;
  return m;
};
const eclaboussure = (centre: THREE.Vector3, rayon: number, n: number) => {
  const g = new THREE.Group();
  const mat = new THREE.MeshPhysicalMaterial({ color: '#4a0410', roughness: 0.03, clearcoat: 1, clearcoatRoughness: 0.02 });
  for (let k = 0; k < n; k++) {
    const pts: THREE.Vector3[] = [];
    const a0 = R() * Math.PI * 2, h0 = (R() - 0.3) * 2.2, sens = R() > 0.5 ? 1 : -1;
    for (let i = 0; i < 12; i++) {
      const a = a0 + sens * i * 0.22;
      const r = rayon * (0.85 + 0.25 * Math.sin(i * 0.7 + k));
      pts.push(centre.clone().add(V(Math.cos(a) * r, h0 + i * 0.07 + Math.sin(i + k) * 0.06, Math.sin(a) * r)));
    }
    // Droplets flung off the end of each ribbon.
    for (let j = 0; j < 6; j++) {
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.02 + R() * 0.05, 20, 16), mat);
      d.position.copy(pts[Math.floor(R() * pts.length)]).add(V((R() - 0.5) * 0.4, (R() - 0.5) * 0.4, (R() - 0.5) * 0.4));
      g.add(d);
    }
  }
  return g;
};

// ---------- Background: vertical gradient plus warm bokeh lights (blurred by the depth of field)
const fondDegrade = (haut: string, bas: string, halo: string) =>
  toile(512, 512, (c) => {
    const g = c.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, haut);
    g.addColorStop(1, bas);
    c.fillStyle = g;
    c.fillRect(0, 0, 512, 512);
    const r = c.createRadialGradient(330, 220, 10, 330, 220, 300);
    r.addColorStop(0, halo);
    r.addColorStop(1, 'transparent');
    c.fillStyle = r;
    c.fillRect(0, 0, 512, 512);
  });
const bokeh = (scene: THREE.Scene, n: number, couleurs: string[], z: number) => {
  const tex = toile(128, 128, (c) => {
    const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.7, 'rgba(255,255,255,.8)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 128, 128);
  });
  for (let i = 0; i < n; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: couleurs[i % couleurs.length], transparent: true, opacity: 0.25 + R() * 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
    s.position.set((R() - 0.5) * 9, R() * 5 - 0.5, z - R() * 2);
    s.scale.setScalar(0.2 + R() * 0.5);
    scene.add(s);
  }
};

// ---------- Barrel cellar
const tonneau = () => {
  const p: THREE.Vector2[] = [];
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    p.push(new THREE.Vector2(0.55 + Math.sin(t * Math.PI) * 0.1, t * 1.6 - 0.8));
  }
  const tex = toile(1024, 512, (c) => {
    for (let i = 0; i < 32; i++) {
      c.fillStyle = `hsl(${24 + R() * 6}, ${45 + R() * 15}%, ${22 + R() * 10}%)`;
      c.fillRect(i * 32, 0, 32, 512);
      c.fillStyle = 'rgba(0,0,0,.35)';
      c.fillRect(i * 32, 0, 2, 512);
    }
    // Iron hoops and the wine stain around the bung.
    for (const y of [60, 150, 362, 452]) {
      c.fillStyle = '#1a1310';
      c.fillRect(0, y, 1024, 22);
    }
    c.fillStyle = 'rgba(90,10,20,.5)';
    c.beginPath();
    c.ellipse(512, 256, 50, 30, 0, 0, Math.PI * 2);
    c.fill();
  });
  tex.wrapS = THREE.RepeatWrapping;
  const m = new THREE.Mesh(new THREE.LatheGeometry(p, 48), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 }));
  m.rotation.z = Math.PI / 2;
  m.castShadow = m.receiveShadow = true;
  const fond = new THREE.Mesh(new THREE.CircleGeometry(0.55, 48), new THREE.MeshStandardMaterial({ color: '#4a2c18', roughness: 0.8 }));
  fond.position.x = 0.8;
  fond.rotation.y = Math.PI / 2;
  const g = new THREE.Group();
  g.add(m, fond);
  return g;
};

// ---------- Scenes
type Scene = { scene: THREE.Scene; camera: THREE.PerspectiveCamera; mise?: number; flou?: number; bloom?: number; transparent?: boolean };
const lumiereStudio = (scene: THREE.Scene, cle = '#fff1dc', fort = 3) => {
  const k = new THREE.SpotLight(cle, fort * 18, 30, 0.5, 0.9, 2);
  k.position.set(-3, 6, 4);
  k.castShadow = true;
  k.shadow.mapSize.set(2048, 2048);
  const rimG = new THREE.DirectionalLight('#ffd6a0', 1.6);
  rimG.position.set(-4, 2, -3);
  const rimD = new THREE.DirectionalLight('#ff8a6a', 1.3);
  rimD.position.set(4, 3, -3);
  scene.add(k, rimG, rimD);
};
const cuvees: Record<string, Bouteille> = {
  'b-rose': { verre: '#ffffff', distance: 30, vin: '#f08a92', etiquette: { fond: '#151112', encre: '#f2c6cb', nom: 'ROSÉE', sous: 'du Matin · 2023', motif: 'bandes' }, capsule: '#e6b8bd' },
  'b-blanc': { verre: '#e6f0d6', distance: 8, vin: '#e2cf7a', etiquette: { fond: '#cfe3c2', encre: '#24402c', nom: 'COTEAU', sous: 'Blanc · 2022', motif: 'vagues' }, capsule: '#24402c' },
  'b-rouge': { verre: '#2c3a26', distance: 0.5, vin: null, etiquette: { fond: '#f3ece0', encre: '#2a1a1c', nom: 'BRUME', sous: 'd’Automne · 2021', motif: 'arbre' }, capsule: '#5b2a6e' },
  'b-grand': { verre: '#1e2a1c', distance: 0.4, vin: null, etiquette: { fond: '#f3ece0', encre: '#1b1b1f', nom: 'GRAND VIN', sous: 'Clos du Haut · 2019', motif: 'monogramme' }, capsule: '#c9a45c', or: true },
};

const scenes: Record<string, () => Scene> = {
  hero() {
    const scene = new THREE.Scene();
    scene.background = fondDegrade('#1a0508', '#07030a', 'rgba(140,20,40,.55)');
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    camera.position.set(0.4, 2.0, 8.4);
    camera.lookAt(0.2, 1.55, 0);
    lumiereStudio(scene);
    const b = bouteille({ ...cuvees['b-rouge'], etiquette: { fond: '#f3ece0', encre: '#2a1a1c', nom: 'CLOS DES BRUMES', sous: 'Grand Vin de Loire', motif: 'arbre' } });
    b.rotation.set(0.05, -0.15, -0.12);
    b.position.set(0.25, 0, 0);
    scene.add(b);
    scene.add(eclaboussure(V(0.25, 1.4, 0), 0.9, 7));
    scene.add(grappe(-1.25, 2.45, 0.6, 46, 1.25), grappe(1.6, 2.7, -0.4, 40, 1.05), grappe(-1.0, 0.7, 0.9, 30, 0.9), grappe(1.4, 0.9, 0.7, 34, 1));
    scene.add(
      feuille(-1.6, 2.8, 0.2, new THREE.Euler(0.4, 0.6, 0.3), 1.3),
      feuille(1.9, 3.1, -0.6, new THREE.Euler(0.2, -0.7, -0.4), 1.1),
      feuille(-1.5, 0.3, 0.4, new THREE.Euler(-0.6, 0.4, 0.2), 0.9),
      feuille(1.9, 0.2, 0.2, new THREE.Euler(-0.4, -0.5, -0.3), 0.95),
    );
    bokeh(scene, 18, ['#ff7a5a', '#c8344a', '#ffb07a'], -5);
    return { scene, camera, mise: 8.4, flou: 0.00025, bloom: 0.35 };
  },
  rouge() {
    const scene = new THREE.Scene();
    scene.background = fondDegrade('#2a0710', '#050203', 'rgba(150,25,40,.6)');
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    camera.position.set(0, 1.9, 5.4);
    camera.lookAt(0, 1.55, 0);
    lumiereStudio(scene);
    const v = verreAVin(false, '#6a0a18', 1.62);
    scene.add(v.g, versement('#6a0a18', V(-0.35, 4.2, 0), V(0.02, 1.62, 0)));
    bokeh(scene, 26, ['#ff6a4a', '#ff9a6a', '#c8344a'], -4);
    return { scene, camera, mise: 5.4, flou: 0.0006, bloom: 0.4 };
  },
  blanc() {
    const scene = new THREE.Scene();
    scene.background = fondDegrade('#16120a', '#040303', 'rgba(150,120,60,.45)');
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    camera.position.set(0, 1.9, 5.4);
    camera.lookAt(0, 1.55, 0);
    lumiereStudio(scene, '#fff6e2');
    const v = verreAVin(false, '#e3c86a', 1.58);
    scene.add(v.g, versement('#e8d07a', V(0.4, 4.2, 0), V(-0.02, 1.58, 0)));
    bokeh(scene, 26, ['#ffd27a', '#fff0c0', '#e8b45a'], -4);
    return { scene, camera, mise: 5.4, flou: 0.0006, bloom: 0.45 };
  },
  bulles() {
    const scene = new THREE.Scene();
    scene.background = fondDegrade('#1a1208', '#050403', 'rgba(200,150,70,.5)');
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    camera.position.set(0.3, 1.8, 6.2);
    camera.lookAt(0.3, 1.5, 0);
    lumiereStudio(scene, '#fff1d6');
    const b = bouteille({ verre: '#1e2a1c', distance: 0.4, vin: null, etiquette: { fond: '#151112', encre: OR, nom: 'FINES BULLES', sous: 'Méthode traditionnelle', motif: 'monogramme' }, capsule: OR, or: true });
    b.position.set(-0.55, 0, -0.4);
    const f = verreAVin(true, '#e9d08a', 2.4);
    f.g.position.set(0.75, 0, 0.4);
    scene.add(b, f.g);
    // Bubbles rising in the flute.
    const mat = new THREE.MeshPhysicalMaterial({ color: '#fff6d8', transmission: 0.8, roughness: 0, clearcoat: 1 });
    for (let i = 0; i < 60; i++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.008 + R() * 0.012, 10, 8), mat);
      s.position.set(0.75 + (R() - 0.5) * 0.35, 1.35 + R() * 1.0, 0.4 + (R() - 0.5) * 0.35);
      scene.add(s);
    }
    bokeh(scene, 34, ['#ffd27a', '#ffb05a', '#fff0c0'], -4);
    return { scene, camera, mise: 6.2, flou: 0.0005, bloom: 0.5 };
  },
  reserve() {
    const scene = new THREE.Scene();
    scene.background = fondDegrade('#120a08', '#030202', 'rgba(120,70,30,.4)');
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    camera.position.set(1.4, 2.2, 6.6);
    camera.lookAt(-0.2, 1.4, -1);
    lumiereStudio(scene, '#ffe2b0', 2.5);
    for (let i = 0; i < 6; i++) {
      const b = bouteille({ ...cuvees['b-grand'] });
      b.position.set(-2.4 + i * 0.95, 0, -i * 0.7);
      b.rotation.y = 0.4;
      scene.add(b);
    }
    return { scene, camera, mise: 6.4, flou: 0.0007, bloom: 0.35 };
  },
  cave() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#050303');
    scene.fog = new THREE.Fog('#0a0605', 4, 22);
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 1.5, 6);
    camera.lookAt(0, 1.3, -10);
    const pierre = toile(1024, 1024, (c) => {
      c.fillStyle = '#5a4a3a';
      c.fillRect(0, 0, 1024, 1024);
      for (let y = 0; y < 1024; y += 64)
        for (let x = (y / 64) % 2 ? -64 : 0; x < 1024; x += 128) {
          c.fillStyle = `hsl(30, ${15 + R() * 10}%, ${28 + R() * 14}%)`;
          c.fillRect(x + 3, y + 3, 122, 58);
        }
    });
    pierre.wrapS = pierre.wrapT = THREE.RepeatWrapping;
    pierre.repeat.set(6, 3);
    const voute = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 30, 64, 1, true, Math.PI / 2, Math.PI), new THREE.MeshStandardMaterial({ map: pierre, roughness: 0.9, side: THREE.BackSide }));
    voute.rotation.x = Math.PI / 2;
    voute.position.set(0, 0.6, -8);
    const sol = new THREE.Mesh(new THREE.PlaneGeometry(6, 30), new THREE.MeshStandardMaterial({ map: pierre, roughness: 0.95 }));
    sol.rotation.x = -Math.PI / 2;
    sol.position.set(0, 0, -8);
    sol.receiveShadow = true;
    scene.add(voute, sol);
    for (let i = 0; i < 9; i++) {
      for (const cote of [-1, 1]) {
        const t = tonneau();
        t.position.set(cote * 1.75, 0.66, 3 - i * 2.2);
        t.rotation.y = cote > 0 ? Math.PI : 0;
        scene.add(t);
      }
      const l = new THREE.PointLight('#ffb062', 6, 6, 1.6);
      l.position.set(0, 3.2, 3 - i * 2.2);
      scene.add(l);
    }
    scene.add(new THREE.AmbientLight('#3a2416', 0.4));
    return { scene, camera, mise: 8, flou: 0.0003, bloom: 0.6 };
  },
};
// Product bottles on a transparent background.
for (const [nom, b] of Object.entries(cuvees)) {
  scenes[nom] = () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(22, 1, 0.1, 100);
    camera.position.set(0, 1.55, 9);
    camera.lookAt(0, 1.5, 0);
    lumiereStudio(scene, '#fff4e4', 2.5);
    const bt = bouteille(b);
    bt.rotation.y = -0.2;
    scene.add(bt);
    return { scene, camera, transparent: true };
  };
}

export async function rendre(canvas: HTMLCanvasElement) {
  const params = new URLSearchParams(location.search);
  const w = Number(params.get('w') ?? 1200), h = Number(params.get('h') ?? 900);
  await document.fonts.load(`600 40px ${SERIF}`);
  await document.fonts.load(`italic 500 40px ${ITAL}`);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(w, h, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.shadowMap.enabled = true;
  renderer.setClearColor(0x000000, 0);
  const s = scenes[params.get('scene') ?? 'hero']();
  s.scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.03).texture;
  s.scene.environmentIntensity = 0.35;
  s.camera.aspect = w / h;
  s.camera.updateProjectionMatrix();
  if (s.transparent) {
    renderer.render(s.scene, s.camera);
  } else {
    const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(w, h, { samples: 8, type: THREE.HalfFloatType }));
    composer.addPass(new RenderPass(s.scene, s.camera));
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(w, h), s.bloom ?? 0.3, 0.5, 1.15));
    composer.addPass(new BokehPass(s.scene, s.camera, { focus: s.mise ?? 6, aperture: s.flou ?? 0.0004, maxblur: 0.01 }));
    composer.addPass(new OutputPass());
    composer.render();
  }
  (window as unknown as { __pret: boolean }).__pret = true;
}
