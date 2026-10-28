// 3D pizza behind the whole pizzeria demo page: it builds up as the visitor scrolls down through the sections
// (dough, sauce, mozzarella, salame, basil, oven, olive oil). Each section carries the stage it starts (data-q).
// Everything is procedural (geometry and canvas textures): no model or photo to download.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

// Seeded random so the pizza looks the same on every visit.
const alea = (graine: number) => () => {
  graine = (graine + 0x6d2b79f5) | 0;
  let t = Math.imul(graine ^ (graine >>> 15), 1 | graine);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const R = alea(42);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const etape = (a: number, b: number, p: number) => clamp01((p - a) / (b - a));
const doux = (t: number) => t * t * (3 - 2 * t);
const rebond = (t: number) => {
  const n = 7.5625, d = 2.75;
  if (t < 1 / d) return n * t * t;
  if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
  if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
  return n * (t -= 2.625 / d) * t + 0.984375;
};

// Stage starts (q): sauce, mozzarella, salame, basil, oven, olive oil. The index of the current stage is reported to the page.
const SEUILS = [0.12, 0.27, 0.42, 0.55, 0.68, 0.88];

const toile = (taille: number, dessin: (c: CanvasRenderingContext2D, t: number) => void) => {
  const c = document.createElement('canvas');
  c.width = c.height = taille;
  dessin(c.getContext('2d')!, taille);
  return c;
};
const texture = (c: HTMLCanvasElement, couleur = true) => {
  const t = new THREE.CanvasTexture(c);
  if (couleur) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
};
// Soft blotches: radial gradients scattered over the canvas (optionally limited to a zone).
const taches = (c: CanvasRenderingContext2D, t: number, n: number, couleur: string, rmin: number, rmax: number, zone?: (x: number, y: number) => boolean) => {
  for (let k = 0; k < n; k++) {
    const x = R() * t, y = R() * t;
    if (zone && !zone(x / t - 0.5, y / t - 0.5)) continue;
    const r = rmin + R() * (rmax - rmin);
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, couleur);
    g.addColorStop(1, 'transparent');
    c.fillStyle = g;
    c.fillRect(x - r, y - r, r * 2, r * 2);
  }
};
const grain = (c: CanvasRenderingContext2D, t: number, force: number) => {
  const img = c.getImageData(0, 0, t, t);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = (R() - 0.5) * force;
    img.data[i] += v;
    img.data[i + 1] += v;
    img.data[i + 2] += v;
  }
  c.putImageData(img, 0, 0);
};
// Texture redrawn as a mix of two states (raw / baked) when the bake progresses.
const melange = (a: HTMLCanvasElement, b: HTMLCanvasElement) => {
  const c = document.createElement('canvas');
  c.width = a.width;
  c.height = a.height;
  const ctx = c.getContext('2d')!;
  const tex = texture(c);
  let fait = -1;
  return {
    tex,
    regler(k: number) {
      if (Math.abs(k - fait) < 0.02) return;
      fait = k;
      ctx.globalAlpha = 1;
      ctx.drawImage(a, 0, 0);
      ctx.globalAlpha = k;
      ctx.drawImage(b, 0, 0);
      tex.needsUpdate = true;
    },
  };
};
// Lumpy shape: a sphere pushed in and out by a few sine waves.
const bosseler = (geo: THREE.BufferGeometry, force: number, graine: number) => {
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let j = 0; j < pos.count; j++) {
    v.fromBufferAttribute(pos, j);
    v.multiplyScalar(1 + (Math.sin(v.x * 9 + graine) * 0.12 + Math.sin(v.y * 11 + graine * 2) * 0.1 + Math.sin(v.z * 13 + graine) * 0.08) * force);
    pos.setXYZ(j, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
};

// echec: called once if WebGL breaks after start (render error or context lost); errors at start are thrown.
export function demarrer(canvas: HTMLCanvasElement, ancres: HTMLElement[], surEtape: (i: number, cuisson: number) => void, echec: (e: unknown) => void) {
  const animer = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.45;
  // Long lens: product-shot perspective, little distortion.
  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 100);

  // ---------- Lights: warm spot (natural falloff on the board), orange rim, front fill, oven glow during baking
  const cle = new THREE.SpotLight('#ffe4bf', 70, 30, 0.42, 0.85, 2);
  cle.position.set(3.2, 7.5, 3);
  cle.castShadow = true;
  cle.shadow.mapSize.set(2048, 2048);
  cle.shadow.radius = 5;
  cle.shadow.bias = -0.0004;
  cle.shadow.normalBias = 0.02;
  const contre = new THREE.DirectionalLight('#ff9a5a', 1.2);
  contre.position.set(-3, 2.5, -4);
  const appoint = new THREE.DirectionalLight('#fff1e0', 0.45);
  appoint.position.set(-2, 1, 4);
  const four = new THREE.PointLight('#ff5a1f', 0, 12, 1.6);
  four.position.set(0, 1.2, -2.2);
  scene.add(cle, contre, appoint, four);

  // ---------- Background: dark warm vignette centred behind the pizza (redrawn on resize)
  const fond = document.createElement('canvas');
  fond.width = fond.height = 512;
  const texFond = texture(fond);
  scene.background = texFond;
  const dessinerFond = (cx: number, cy: number) => {
    const c = fond.getContext('2d')!;
    const g = c.createRadialGradient(cx * 512, cy * 512, 0, cx * 512, cy * 512, 420);
    g.addColorStop(0, '#3b1d0e');
    g.addColorStop(0.55, '#1a0f09');
    g.addColorStop(1, '#0d0806');
    c.fillStyle = g;
    c.fillRect(0, 0, 512, 512);
    texFond.needsUpdate = true;
  };

  // ---------- Wooden board, contact shadow and shadow catcher
  const bois = texture(toile(1024, (c, t) => {
    c.fillStyle = '#7a4d2a';
    c.fillRect(0, 0, t, t);
    for (let k = 0; k < 160; k++) {
      const y = R() * t;
      c.strokeStyle = `rgba(${R() > 0.5 ? '50,28,12' : '160,110,70'},${0.12 + R() * 0.25})`;
      c.lineWidth = 1 + R() * 4;
      c.beginPath();
      c.moveTo(0, y);
      for (let x = 0; x <= t; x += 32) c.lineTo(x, y + Math.sin(x / 90 + k) * 6 + (R() - 0.5) * 3);
      c.stroke();
    }
    // Knife marks and flour dusted on the board.
    for (let k = 0; k < 30; k++) {
      c.strokeStyle = 'rgba(40,20,8,.25)';
      c.lineWidth = 1;
      const x = R() * t, y = R() * t, a = R() * 6.28, l = 40 + R() * 120;
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      c.stroke();
    }
    taches(c, t, 260, 'rgba(240,225,200,.18)', 3, 26);
    grain(c, t, 18);
  }));
  const planche = new THREE.Mesh(
    new THREE.CylinderGeometry(2.4, 2.4, 0.12, 128),
    new THREE.MeshStandardMaterial({ map: bois, roughness: 0.78, bumpMap: bois, bumpScale: 0.6 }),
  );
  planche.position.y = -0.1;
  planche.receiveShadow = true;
  // Ambient occlusion where the crust touches the board.
  const ao = new THREE.Mesh(
    new THREE.CircleGeometry(2.3, 96),
    new THREE.MeshBasicMaterial({
      transparent: true,
      depthWrite: false,
      map: texture(toile(512, (c, t) => {
        const g = c.createRadialGradient(t / 2, t / 2, t * 0.36, t / 2, t / 2, t * 0.5);
        g.addColorStop(0, 'rgba(0,0,0,.75)');
        g.addColorStop(0.4, 'rgba(0,0,0,.35)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = g;
        c.fillRect(0, 0, t, t);
      })),
    }),
  );
  ao.rotation.x = -Math.PI / 2;
  ao.position.y = -0.038;
  const sol = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ opacity: 0.5 }));
  sol.rotation.x = -Math.PI / 2;
  sol.position.y = -0.165;
  sol.receiveShadow = true;
  scene.add(planche, ao, sol);

  const pizza = new THREE.Group();
  scene.add(pizza);

  // ---------- Dough: lathe profile (flat centre, tall puffy rim), uneven, planar UVs for the top texture
  const profil = [
    [0, -0.04], [1.6, -0.04], [1.84, -0.03], [1.97, 0.02], [2.02, 0.1], [2.0, 0.2], [1.92, 0.27],
    [1.8, 0.29], [1.69, 0.24], [1.6, 0.15], [1.52, 0.08], [1.45, 0.06], [0.8, 0.05], [0, 0.055],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const pateGeo = new THREE.LatheGeometry(profil, 240);
  {
    const pos = pateGeo.attributes.position;
    const uv = pateGeo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const r = Math.hypot(x, z);
      const a = Math.atan2(z, x);
      // Hand-stretched look: the rim swells unevenly around the pizza.
      const bosse = Math.sin(a * 3 + 1) * 0.05 + Math.sin(a * 7 + 2) * 0.03 + Math.sin(a * 13) * 0.015 + Math.sin(a * 29 + 4) * 0.008;
      const surRebord = clamp01((r - 1.45) / 0.3);
      const k = 1 + bosse * 0.45 * surRebord;
      pos.setXYZ(i, x * k, y + (y > 0.05 ? bosse * surRebord * 1.6 : 0), z * k);
      uv.setXY(i, x / 4.3 + 0.5, z / 4.3 + 0.5);
    }
    pateGeo.computeVertexNormals();
  }
  const rebordZone = (x: number, y: number) => Math.hypot(x, y) > 0.35;
  const pate = melange(
    toile(1024, (c, t) => {
      c.fillStyle = '#ecd9b1';
      c.fillRect(0, 0, t, t);
      taches(c, t, 400, 'rgba(255,252,240,.55)', 4, 30);
      taches(c, t, 140, 'rgba(205,175,125,.25)', 10, 50);
      grain(c, t, 12);
    }),
    toile(1024, (c, t) => {
      const g = c.createRadialGradient(t / 2, t / 2, t * 0.3, t / 2, t / 2, t * 0.5);
      g.addColorStop(0, '#e6b36a');
      g.addColorStop(0.5, '#d68d3e');
      g.addColorStop(1, '#a3541d');
      c.fillStyle = g;
      c.fillRect(0, 0, t, t);
      taches(c, t, 900, 'rgba(250,218,155,.35)', 4, 18, rebordZone);
      // Leopard spotting: small charred bubbles, denser on the rim, with flour still visible.
      taches(c, t, 1600, 'rgba(36,16,5,.85)', 2, 8, rebordZone);
      taches(c, t, 300, 'rgba(60,25,8,.5)', 8, 24, rebordZone);
      taches(c, t, 200, 'rgba(250,240,220,.25)', 3, 12, rebordZone);
      grain(c, t, 16);
    }),
  );
  const relief = texture(toile(1024, (c, t) => {
    c.fillStyle = '#808080';
    c.fillRect(0, 0, t, t);
    taches(c, t, 1600, 'rgba(255,255,255,.35)', 2, 14);
    taches(c, t, 900, 'rgba(0,0,0,.3)', 2, 8);
    taches(c, t, 120, 'rgba(255,255,255,.25)', 18, 50);
  }), false);
  // Raw dough has a dusty flour sheen that disappears in the oven; the charred crust glows while baking.
  const matPate = new THREE.MeshPhysicalMaterial({
    map: pate.tex, bumpMap: relief, bumpScale: 0.9, roughness: 0.82,
    sheen: 0.8, sheenRoughness: 0.6, sheenColor: new THREE.Color('#fff6e4'),
    emissive: new THREE.Color('#ff4a10'), emissiveIntensity: 0,
  });
  const disque = new THREE.Mesh(pateGeo, matPate);
  disque.castShadow = disque.receiveShadow = true;
  pizza.add(disque);

  // Blisters on the rim: small bubbles that char in the oven.
  const matBulle = new THREE.MeshStandardMaterial({ color: '#e8d2a6', roughness: 0.8 });
  const brule = new THREE.Color('#2a1206'), pale = new THREE.Color('#e8d2a6');
  for (let i = 0; i < 22; i++) {
    const a = R() * Math.PI * 2, r = 1.72 + R() * 0.2;
    const b = new THREE.Mesh(bosseler(new THREE.SphereGeometry(0.05 + R() * 0.06, 16, 12), 0.6, R() * 9), matBulle);
    b.position.set(Math.cos(a) * r, 0.22 + R() * 0.06, Math.sin(a) * r);
    b.scale.y = 0.6;
    b.castShadow = true;
    pizza.add(b);
  }

  // ---------- Sauce: glossy, chunky disc with an uneven edge, oil spots smoother than the rest
  const sauceGeo = new THREE.CircleGeometry(1.5, 160);
  {
    const pos = sauceGeo.attributes.position;
    for (let i = 1; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i);
      const a = Math.atan2(y, x);
      const k = 1 + Math.sin(a * 9) * 0.015 + Math.sin(a * 23 + 1) * 0.01 + (R() - 0.5) * 0.012;
      pos.setXY(i, x * k, y * k);
    }
  }
  const sauceTex = texture(toile(1024, (c, t) => {
    c.fillStyle = '#b5220e';
    c.fillRect(0, 0, t, t);
    taches(c, t, 300, 'rgba(228,72,36,.55)', 10, 60);
    taches(c, t, 200, 'rgba(115,14,4,.45)', 8, 40);
    taches(c, t, 500, 'rgba(240,110,70,.45)', 3, 9);
    for (let k = 0; k < 1100; k++) {
      c.fillStyle = `rgba(${R() > 0.5 ? '60,70,20' : '40,30,10'},.7)`;
      c.fillRect(R() * t, R() * t, 1 + R() * 2.5, 1 + R() * 1.5);
    }
    taches(c, t, 50, 'rgba(255,190,60,.35)', 6, 22);
    const g = c.createRadialGradient(t / 2, t / 2, t * 0.4, t / 2, t / 2, t * 0.5);
    g.addColorStop(0, 'transparent');
    g.addColorStop(1, 'rgba(70,10,0,.55)');
    c.fillStyle = g;
    c.fillRect(0, 0, t, t);
  }));
  const sauceRelief = texture(toile(512, (c, t) => {
    c.fillStyle = '#808080';
    c.fillRect(0, 0, t, t);
    taches(c, t, 700, 'rgba(255,255,255,.4)', 3, 12);
    taches(c, t, 300, 'rgba(0,0,0,.3)', 4, 16);
  }), false);
  const sauceRugosite = texture(toile(512, (c, t) => {
    c.fillStyle = '#6a6a6a';
    c.fillRect(0, 0, t, t);
    taches(c, t, 70, 'rgba(0,0,0,.9)', 6, 26);
  }), false);
  const sauce = new THREE.Mesh(
    sauceGeo,
    new THREE.MeshPhysicalMaterial({ map: sauceTex, roughness: 0.6, roughnessMap: sauceRugosite, clearcoat: 0.8, clearcoatRoughness: 0.2, bumpMap: sauceRelief, bumpScale: 1.4 }),
  );
  sauce.rotation.x = -Math.PI / 2;
  sauce.position.y = 0.068;
  sauce.receiveShadow = true;
  pizza.add(sauce);

  // ---------- Mozzarella: torn lumps that fall and bounce, then melt into glossy blistered puddles
  const mozza = melange(
    toile(512, (c, t) => {
      c.fillStyle = '#f3ead4';
      c.fillRect(0, 0, t, t);
      taches(c, t, 200, 'rgba(235,225,205,.5)', 6, 30);
      grain(c, t, 6);
    }),
    toile(512, (c, t) => {
      c.fillStyle = '#f7ead0';
      c.fillRect(0, 0, t, t);
      taches(c, t, 120, 'rgba(232,180,95,.75)', 8, 40);
      taches(c, t, 90, 'rgba(170,95,30,.7)', 4, 16);
      taches(c, t, 40, 'rgba(90,45,12,.6)', 2, 6);
      grain(c, t, 6);
    }),
  );
  const matMozza = new THREE.MeshPhysicalMaterial({ map: mozza.tex, roughness: 0.45, sheen: 1, sheenColor: new THREE.Color('#fffaf0'), clearcoat: 0.4, clearcoatRoughness: 0.35 });
  const mozzas = Array.from({ length: 18 }, (_, i) => {
    const m = new THREE.Mesh(bosseler(new THREE.IcosahedronGeometry(0.2 + R() * 0.09, 5), 1.7, R() * 10), matMozza);
    m.castShadow = m.receiveShadow = true;
    const a = R() * Math.PI * 2, d = 1.22 * Math.sqrt(R());
    m.userData = { x: Math.cos(a) * d, z: Math.sin(a) * d, debut: 0.27 + i * 0.0075, rot: R() * Math.PI * 2, h: 2.6 + R() * 1.5 };
    pizza.add(m);
    return m;
  });

  // ---------- Salame: thin slices that flip down like coins, then cup and crisp in the oven (morph target)
  const salameTex = texture(toile(512, (c, t) => {
    const g = c.createRadialGradient(t / 2, t / 2, t * 0.3, t / 2, t / 2, t * 0.5);
    g.addColorStop(0, '#a3261a');
    g.addColorStop(0.85, '#8a1d12');
    g.addColorStop(1, '#4e0d06');
    c.fillStyle = g;
    c.fillRect(0, 0, t, t);
    taches(c, t, 160, 'rgba(160,40,25,.6)', 6, 22);
    for (let k = 0; k < 140; k++) {
      c.fillStyle = `rgba(245,${185 + R() * 40},${170 + R() * 40},${0.6 + R() * 0.4})`;
      c.beginPath();
      c.ellipse(R() * t, R() * t, 2 + R() * 6, 2 + R() * 5, R() * 3, 0, 6.3);
      c.fill();
    }
    for (let k = 0; k < 90; k++) {
      c.fillStyle = 'rgba(25,10,8,.8)';
      c.fillRect(R() * t, R() * t, 2, 2);
    }
  }));
  const salameGeo = new THREE.CylinderGeometry(0.23, 0.23, 0.028, 48, 1);
  {
    // Planar UVs from the top, and a "cupped" copy: the edge curls up when baked.
    const pos = salameGeo.attributes.position;
    const uv = salameGeo.attributes.uv;
    const creux = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      uv.setXY(i, x / 0.46 + 0.5, z / 0.46 + 0.5);
      const r = Math.hypot(x, z) / 0.23;
      creux[i * 3] = x * 0.94;
      creux[i * 3 + 1] = y + r * r * 0.085;
      creux[i * 3 + 2] = z * 0.94;
    }
    salameGeo.morphAttributes.position = [new THREE.Float32BufferAttribute(creux, 3)];
  }
  const matSalame = new THREE.MeshPhysicalMaterial({ map: salameTex, roughness: 0.45, clearcoat: 0.6, clearcoatRoughness: 0.3 });
  const salames = Array.from({ length: 10 }, (_, i) => {
    const m = new THREE.Mesh(salameGeo, matSalame);
    m.castShadow = m.receiveShadow = true;
    const a = (i / 10) * Math.PI * 2 + R() * 0.4, d = i === 0 ? 0 : 0.55 + R() * 0.7;
    m.userData = { x: Math.cos(a) * d, z: Math.sin(a) * d, debut: 0.42 + i * 0.009, h: 2.4 + R() * 1.2 };
    pizza.add(m);
    return m;
  });

  // ---------- Basil: textured, curled leaves that flutter down
  const feuille = new THREE.Shape();
  feuille.moveTo(0, -0.26);
  feuille.quadraticCurveTo(0.2, -0.1, 0.12, 0.12);
  feuille.quadraticCurveTo(0.05, 0.26, 0, 0.3);
  feuille.quadraticCurveTo(-0.05, 0.26, -0.12, 0.12);
  feuille.quadraticCurveTo(-0.2, -0.1, 0, -0.26);
  const feuilleGeo = new THREE.ShapeGeometry(feuille, 16);
  {
    const pos = feuilleGeo.attributes.position;
    const uv = feuilleGeo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i);
      uv.setXY(i, (x + 0.2) / 0.4, (y + 0.26) / 0.56);
      pos.setZ(i, x * x * 2.2 - y * 0.12 + Math.sin(y * 9) * 0.01);
    }
    feuilleGeo.rotateX(-Math.PI / 2);
    feuilleGeo.computeVertexNormals();
  }
  const basilicTex = texture(toile(256, (c, t) => {
    const g = c.createLinearGradient(0, 0, t, 0);
    g.addColorStop(0, '#1f5e1f');
    g.addColorStop(0.5, '#3f9a36');
    g.addColorStop(1, '#1f5e1f');
    c.fillStyle = g;
    c.fillRect(0, 0, t, t);
    c.strokeStyle = 'rgba(170,220,140,.75)';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(t / 2, t);
    c.lineTo(t / 2, 0);
    c.stroke();
    c.lineWidth = 1.5;
    for (let k = 1; k < 7; k++) {
      const y = t - (k / 7) * t;
      c.beginPath();
      c.moveTo(t / 2, y);
      c.quadraticCurveTo(t * 0.3, y - t * 0.08, t * 0.12, y - t * 0.16);
      c.moveTo(t / 2, y);
      c.quadraticCurveTo(t * 0.7, y - t * 0.08, t * 0.88, y - t * 0.16);
      c.stroke();
    }
  }));
  // Thin leaves let a little light through (transmission-like sheen) and are glossy on top.
  const matBasilic = new THREE.MeshPhysicalMaterial({ map: basilicTex, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.3, sheen: 0.5, sheenColor: new THREE.Color('#b8f08a'), side: THREE.DoubleSide });
  const basilics = Array.from({ length: 7 }, (_, i) => {
    const m = new THREE.Mesh(feuilleGeo, matBasilic);
    m.castShadow = true;
    const a = (i / 7) * Math.PI * 2 + R(), d = 0.3 + R() * 0.85;
    m.userData = { x: Math.cos(a) * d, z: Math.sin(a) * d, debut: 0.55 + i * 0.015, rot: R() * Math.PI * 2, s: 0.9 + R() * 0.5 };
    pizza.add(m);
    return m;
  });

  // ---------- Olive oil: a thin glossy drizzle drawn progressively at the very end
  const points: THREE.Vector3[] = [];
  for (let k = 0; k <= 80; k++) {
    const a = k * 0.19, r = 0.2 + k * 0.0145;
    points.push(new THREE.Vector3(Math.cos(a) * r + (R() - 0.5) * 0.04, 0.24, Math.sin(a) * r + (R() - 0.5) * 0.04));
  }
  const huileGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 400, 0.014, 8);
  const huile = new THREE.Mesh(
    huileGeo,
    new THREE.MeshPhysicalMaterial({ color: '#d9b43a', roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.02, transparent: true, opacity: 0.85, emissive: new THREE.Color('#5a3d00'), emissiveIntensity: 0.4 }),
  );
  pizza.add(huile);
  const huileTotal = huileGeo.index!.count;

  // ---------- Steam once baked
  const vapeur = texture(toile(128, (c, t) => {
    const g = c.createRadialGradient(t / 2, t / 2, 0, t / 2, t / 2, t / 2);
    g.addColorStop(0, 'rgba(255,255,255,.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, t, t);
  }));
  const fumees = Array.from({ length: 30 }, () => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: vapeur, transparent: true, depthWrite: false, opacity: 0 }));
    s.userData = { x: (R() - 0.5) * 2.4, z: (R() - 0.5) * 2.4, phase: R(), vitesse: 0.07 + R() * 0.08 };
    scene.add(s);
    return s;
  });

  // ---------- Post-processing: soft bloom on highlights and glow, shallow depth of field on the pizza
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { samples: 4, type: THREE.HalfFloatType }));
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.2, 0.5, 1.1);
  composer.addPass(bloom);
  const flou = new BokehPass(scene, camera, { focus: 9, aperture: 0.00035, maxblur: 0.006 });
  composer.addPass(flou);
  composer.addPass(new OutputPass());

  // ---------- Scroll: q is interpolated between the sections' stage anchors (section top at 65% of the screen)
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
    mobile = w <= 860;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    composer.setPixelRatio(renderer.getPixelRatio());
    camera.aspect = w / h;
    // Desktop: pizza on the right of the text column. Phone: pizza in the upper part of the screen.
    if (mobile) camera.setViewOffset(w, h, 0, h * 0.2, w, h);
    else camera.setViewOffset(w, h, -w * 0.25, 0, w, h);
    camera.updateProjectionMatrix();
    dessinerFond(mobile ? 0.5 : 0.72, mobile ? 0.3 : 0.55);
    mesure();
  };
  taille();
  addEventListener('resize', taille);
  addEventListener('scroll', mesure, { passive: true });

  const vert = new THREE.Color('#ffffff'), fane = new THREE.Color('#6a7a55');
  const cru = new THREE.Color('#ffffff'), grille = new THREE.Color('#d08070');
  const chaud = new THREE.Color('#ffb070'), neutre = new THREE.Color('#ffe4bf');
  const debut = performance.now();
  let derniere = -1;
  let arret = false;
  const casse = (e: unknown) => {
    if (arret) return;
    arret = true;
    echec(e);
  };
  canvas.addEventListener('webglcontextlost', () => casse(new Error('WebGL context lost')));
  const rendu = () => {
    if (arret) return;
    requestAnimationFrame(rendu);
    if (document.hidden) return;
    try {
      image();
    } catch (e) {
      casse(e);
    }
  };
  const image = () => {
    const t = (performance.now() - debut) / 1000;
    q += (cible - q) * 0.07;
    const i = SEUILS.filter((s) => q >= s).length;
    const cuisson = doux(etape(0.68, 0.86, q));
    if (i !== derniere) surEtape((derniere = i), cuisson);
    document.documentElement.style.setProperty('--cuisson', cuisson.toFixed(3));

    // The pizza rises into view on load and keeps turning slowly.
    const arrivee = doux(clamp01(t / 1.4));
    pizza.scale.setScalar(0.8 + arrivee * 0.2);
    pizza.position.y = (1 - arrivee) * -0.5;
    pizza.rotation.y = q * Math.PI * 1.6 + (animer ? t * 0.08 : 0);

    const s = doux(etape(0.12, 0.25, q));
    sauce.scale.setScalar(Math.max(s, 0.001));
    sauce.rotation.z = (1 - s) * 2.5;
    sauce.visible = s > 0.002;

    // Baking: crust and cheese textures, melting, charred blisters, glowing crust, oven light, steam.
    pate.regler(cuisson);
    mozza.regler(cuisson);
    const lueur = Math.sin(Math.PI * etape(0.64, 0.92, q));
    const vacille = 1 + Math.sin(t * 13) * 0.12 + Math.sin(t * 7.3) * 0.1;
    matPate.sheen = 0.8 * (1 - cuisson);
    matPate.emissiveIntensity = lueur * 0.18 * vacille;
    matBulle.color.copy(pale).lerp(brule, cuisson * 0.9);
    matBasilic.color.copy(vert).lerp(fane, cuisson * 0.5);
    matSalame.color.copy(cru).lerp(grille, cuisson * 0.6);
    matMozza.roughness = 0.45 - cuisson * 0.2;
    matMozza.clearcoat = 0.4 + cuisson * 0.4;
    four.intensity = lueur * 40 * vacille;
    cle.color.copy(neutre).lerp(chaud, lueur * 0.6);
    bloom.strength = 0.2 + lueur * 0.4;

    for (const m of mozzas) {
      const { x, z, debut: d0, rot, h } = m.userData;
      const k = etape(d0, d0 + 0.07, q);
      m.visible = k > 0;
      m.position.set(x, 0.1 + (1 - rebond(k)) * h - cuisson * 0.02, z);
      m.rotation.set(0, rot + (1 - k) * 3, 0);
      m.scale.set(1.15 + cuisson * 0.7, 0.3 - cuisson * 0.18, 1 + cuisson * 0.75);
    }
    for (const [n, m] of salames.entries()) {
      const { x, z, debut: d0, h } = m.userData;
      const k = etape(d0, d0 + 0.07, q);
      m.visible = k > 0;
      m.position.set(x, 0.15 + (1 - rebond(k)) * h - cuisson * 0.02, z);
      m.rotation.set((1 - k) * Math.PI * 3, n, (1 - k) * 0.8);
      m.morphTargetInfluences![0] = cuisson;
    }
    for (const [n, m] of basilics.entries()) {
      const { x, z, debut: d0, rot, s: sc } = m.userData;
      const k = etape(d0, d0 + 0.09, q);
      const chute = 1 - doux(k);
      m.visible = k > 0;
      m.position.set(x + Math.sin(k * 9 + n) * 0.3 * chute, 0.2 + chute * 2.4, z + Math.cos(k * 7 + n) * 0.2 * chute);
      m.rotation.set(Math.sin(k * 11 + n) * 0.9 * chute, rot + chute * 4, Math.cos(k * 8) * 0.6 * chute);
      m.scale.setScalar(sc * (1 - cuisson * 0.12));
    }
    // Drizzle drawn from the centre outwards (index count must stay a multiple of 3).
    const filet = etape(0.88, 0.98, q);
    huile.visible = filet > 0;
    huileGeo.setDrawRange(0, Math.floor((huileTotal * filet) / 3) * 3);
    const fumee = etape(0.8, 0.92, q);
    for (const f of fumees) {
      const { x, z, phase, vitesse } = f.userData;
      const v = (t * vitesse + phase) % 1;
      f.position.set(x + Math.sin(t + phase * 9) * 0.15, 0.35 + v * 2.2, z);
      f.scale.setScalar(0.6 + v * 1.6);
      (f.material as THREE.SpriteMaterial).opacity = fumee * Math.sin(Math.PI * v) * 0.3;
    }

    // Camera: three-quarter view of the bare dough, lower during the assembly, overhead hero shot at the end.
    const elev = q < 0.12 ? 0.62 : THREE.MathUtils.lerp(0.45, 1.15, doux(etape(0.12, 1, q)));
    const dist = (mobile ? 18 : 15) - q * 1.2;
    const az = 0.4 + (animer ? Math.sin(t * 0.15) * 0.08 : 0);
    camera.position.set(Math.sin(az) * Math.cos(elev) * dist, Math.sin(elev) * dist, Math.cos(az) * Math.cos(elev) * dist);
    camera.lookAt(0, 0.08, 0);
    (flou.uniforms as Record<string, THREE.IUniform>).focus.value = camera.position.length();
    composer.render();
  };
  rendu();
}
