// 3D pizza assembled by scroll (pizzeria demo): dough, sauce, mozzarella, basil, then baking.
// Everything is procedural (geometry and canvas textures): no model or photo to download.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

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
// Soft blotches: radial gradients scattered over the canvas.
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

export function demarrer(section: HTMLElement, canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);

  // ---------- Lights: warm key light, orange rim, oven glow during baking
  const cle = new THREE.DirectionalLight('#ffe4bf', 2.6);
  cle.position.set(3, 6, 2.5);
  cle.castShadow = true;
  cle.shadow.mapSize.set(2048, 2048);
  cle.shadow.camera.left = cle.shadow.camera.bottom = -3;
  cle.shadow.camera.right = cle.shadow.camera.top = 3;
  cle.shadow.radius = 6;
  cle.shadow.bias = -0.0005;
  const contre = new THREE.DirectionalLight('#ff9a5a', 1.6);
  contre.position.set(-3, 2.5, -4);
  const four = new THREE.PointLight('#ff5a1f', 0, 12, 1.6);
  four.position.set(0, 1.2, -2.2);
  scene.add(cle, contre, four);

  // ---------- Wooden board and shadow catcher
  const bois = texture(toile(1024, (c, t) => {
    c.fillStyle = '#7a4d2a';
    c.fillRect(0, 0, t, t);
    for (let k = 0; k < 140; k++) {
      const y = R() * t;
      c.strokeStyle = `rgba(${R() > 0.5 ? '50,28,12' : '160,110,70'},${0.15 + R() * 0.25})`;
      c.lineWidth = 1 + R() * 4;
      c.beginPath();
      c.moveTo(0, y);
      for (let x = 0; x <= t; x += 32) c.lineTo(x, y + Math.sin(x / 90 + k) * 6 + (R() - 0.5) * 3);
      c.stroke();
    }
    grain(c, t, 18);
  }));
  const planche = new THREE.Mesh(
    new THREE.CylinderGeometry(2.35, 2.35, 0.12, 128),
    new THREE.MeshStandardMaterial({ map: bois, roughness: 0.75 }),
  );
  planche.position.y = -0.1;
  planche.receiveShadow = true;
  const sol = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ opacity: 0.45 }));
  sol.rotation.x = -Math.PI / 2;
  sol.position.y = -0.165;
  sol.receiveShadow = true;
  scene.add(planche, sol);

  const pizza = new THREE.Group();
  scene.add(pizza);

  // ---------- Dough: lathe profile (flat centre, puffy rim), irregular, planar UVs for the top texture
  const profil = [
    [0, -0.04], [1.6, -0.04], [1.82, -0.03], [1.95, 0.0], [1.99, 0.07], [1.96, 0.15], [1.86, 0.21],
    [1.74, 0.21], [1.64, 0.16], [1.57, 0.09], [1.5, 0.06], [0.8, 0.05], [0, 0.055],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const pate = new THREE.LatheGeometry(profil, 192);
  {
    const pos = pate.attributes.position;
    const uv = pate.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const r = Math.hypot(x, z);
      const a = Math.atan2(z, x);
      // Hand-stretched look: the rim swells unevenly around the pizza.
      const bosse = Math.sin(a * 3 + 1) * 0.04 + Math.sin(a * 7 + 2) * 0.025 + Math.sin(a * 13) * 0.012;
      const surRebord = clamp01((r - 1.45) / 0.3);
      const k = 1 + bosse * 0.5 * surRebord;
      pos.setXYZ(i, x * k, y + (y > 0 ? bosse * surRebord * 1.4 : 0), z * k);
      uv.setXY(i, x / 4.2 + 0.5, z / 4.2 + 0.5);
    }
    pate.computeVertexNormals();
  }
  // Raw then baked dough: the colour texture is redrawn as a mix when the bake progresses.
  const cru = toile(1024, (c, t) => {
    c.fillStyle = '#ead6ad';
    c.fillRect(0, 0, t, t);
    taches(c, t, 300, 'rgba(255,250,235,.5)', 4, 30);
    taches(c, t, 120, 'rgba(200,170,120,.25)', 10, 50);
    grain(c, t, 14);
  });
  const cuit = toile(1024, (c, t) => {
    const g = c.createRadialGradient(t / 2, t / 2, t * 0.3, t / 2, t / 2, t * 0.5);
    g.addColorStop(0, '#e7b46c');
    g.addColorStop(0.55, '#d48a3c');
    g.addColorStop(1, '#a8571f');
    c.fillStyle = g;
    c.fillRect(0, 0, t, t);
    const rebord = (x: number, y: number) => Math.hypot(x, y) > 0.36;
    taches(c, t, 900, 'rgba(250,215,150,.35)', 4, 18, rebord);
    // Leopard spotting: small charred bubbles, denser on the rim.
    taches(c, t, 1400, 'rgba(40,18,6,.85)', 2, 9, rebord);
    taches(c, t, 260, 'rgba(60,25,8,.5)', 8, 22, rebord);
    grain(c, t, 16);
  });
  const mixPate = document.createElement('canvas');
  mixPate.width = mixPate.height = 1024;
  const ctxMix = mixPate.getContext('2d')!;
  const texPate = texture(mixPate);
  let cuissonDessinee = -1;
  const dessinerPate = (k: number) => {
    if (Math.abs(k - cuissonDessinee) < 0.02) return;
    cuissonDessinee = k;
    ctxMix.globalAlpha = 1;
    ctxMix.drawImage(cru, 0, 0);
    ctxMix.globalAlpha = k;
    ctxMix.drawImage(cuit, 0, 0);
    texPate.needsUpdate = true;
  };
  dessinerPate(0);
  const relief = texture(toile(512, (c, t) => {
    c.fillStyle = '#808080';
    c.fillRect(0, 0, t, t);
    taches(c, t, 900, 'rgba(255,255,255,.35)', 2, 14);
    taches(c, t, 500, 'rgba(0,0,0,.3)', 2, 8);
  }), false);
  const matPate = new THREE.MeshStandardMaterial({ map: texPate, bumpMap: relief, bumpScale: 2.2, roughness: 0.85 });
  const disque = new THREE.Mesh(pate, matPate);
  disque.castShadow = disque.receiveShadow = true;
  pizza.add(disque);

  // ---------- Sauce: glossy disc with an uneven edge, spread from the centre
  const sauceGeo = new THREE.CircleGeometry(1.52, 160);
  {
    const pos = sauceGeo.attributes.position;
    for (let i = 1; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i);
      const a = Math.atan2(y, x);
      const k = 1 + Math.sin(a * 9) * 0.015 + Math.sin(a * 23 + 1) * 0.01 + (R() - 0.5) * 0.01;
      pos.setXY(i, x * k, y * k);
    }
  }
  const texSauce = texture(toile(1024, (c, t) => {
    c.fillStyle = '#b8240f';
    c.fillRect(0, 0, t, t);
    taches(c, t, 260, 'rgba(225,70,35,.55)', 10, 60);
    taches(c, t, 160, 'rgba(120,15,5,.45)', 8, 40);
    // Oregano flecks and a few olive-oil highlights.
    for (let k = 0; k < 900; k++) {
      c.fillStyle = `rgba(${R() > 0.5 ? '60,70,20' : '40,30,10'},.7)`;
      c.fillRect(R() * t, R() * t, 1 + R() * 2.5, 1 + R() * 1.5);
    }
    taches(c, t, 40, 'rgba(255,190,60,.35)', 6, 22);
  }));
  const sauce = new THREE.Mesh(
    sauceGeo,
    new THREE.MeshPhysicalMaterial({ map: texSauce, roughness: 0.38, clearcoat: 0.7, clearcoatRoughness: 0.25, bumpMap: relief, bumpScale: 0.6 }),
  );
  sauce.rotation.x = -Math.PI / 2;
  sauce.position.y = 0.068;
  sauce.receiveShadow = true;
  pizza.add(sauce);

  // ---------- Mozzarella: lumpy torn pieces that fall and bounce, then melt in the oven
  const matMozza = new THREE.MeshPhysicalMaterial({ color: '#fbf5e6', roughness: 0.42, sheen: 1, sheenColor: new THREE.Color('#fffaf0'), clearcoat: 0.35, clearcoatRoughness: 0.4 });
  const blanc = new THREE.Color('#fbf5e6'), dore = new THREE.Color('#f0cf93');
  const mozzas = Array.from({ length: 15 }, (_, i) => {
    const geo = new THREE.IcosahedronGeometry(0.2 + R() * 0.08, 4);
    const pos = geo.attributes.position;
    const graine = R() * 10;
    for (let j = 0; j < pos.count; j++) {
      const v = new THREE.Vector3().fromBufferAttribute(pos, j);
      const n = 1 + Math.sin(v.x * 9 + graine) * 0.12 + Math.sin(v.y * 11 + graine * 2) * 0.1 + Math.sin(v.z * 13) * 0.08;
      v.multiplyScalar(n);
      pos.setXYZ(j, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, matMozza);
    m.castShadow = m.receiveShadow = true;
    const a = R() * Math.PI * 2, d = 1.2 * Math.sqrt(R());
    m.userData = { x: Math.cos(a) * d, z: Math.sin(a) * d, debut: 0.31 + i * 0.011, rot: R() * Math.PI * 2, h: 2.6 + R() * 1.5 };
    pizza.add(m);
    return m;
  });

  // ---------- Basil: curled leaves that flutter down
  const feuille = new THREE.Shape();
  feuille.moveTo(0, -0.26);
  feuille.quadraticCurveTo(0.2, -0.1, 0.12, 0.12);
  feuille.quadraticCurveTo(0.05, 0.26, 0, 0.3);
  feuille.quadraticCurveTo(-0.05, 0.26, -0.12, 0.12);
  feuille.quadraticCurveTo(-0.2, -0.1, 0, -0.26);
  const feuilleGeo = new THREE.ShapeGeometry(feuille, 12);
  {
    const pos = feuilleGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setZ(i, pos.getX(i) ** 2 * 1.6 - pos.getY(i) * 0.08);
    feuilleGeo.rotateX(-Math.PI / 2);
    feuilleGeo.computeVertexNormals();
  }
  const matBasilic = new THREE.MeshPhysicalMaterial({ color: '#2f7d2c', roughness: 0.4, clearcoat: 0.5, side: THREE.DoubleSide });
  const basilics = Array.from({ length: 6 }, (_, i) => {
    const m = new THREE.Mesh(feuilleGeo, matBasilic);
    m.castShadow = true;
    const a = (i / 6) * Math.PI * 2 + R(), d = 0.35 + R() * 0.8;
    m.userData = { x: Math.cos(a) * d, z: Math.sin(a) * d, debut: 0.52 + i * 0.018, rot: R() * Math.PI * 2, s: 0.9 + R() * 0.5 };
    pizza.add(m);
    return m;
  });

  // ---------- Steam once baked
  const vapeur = texture(toile(128, (c, t) => {
    const g = c.createRadialGradient(t / 2, t / 2, 0, t / 2, t / 2, t / 2);
    g.addColorStop(0, 'rgba(255,255,255,.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, t, t);
  }));
  const fumees = Array.from({ length: 26 }, () => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: vapeur, transparent: true, depthWrite: false, opacity: 0 }));
    s.userData = { x: (R() - 0.5) * 2.4, z: (R() - 0.5) * 2.4, phase: R(), vitesse: 0.08 + R() * 0.08 };
    scene.add(s);
    return s;
  });

  // ---------- Scroll progress (smoothed) drives everything
  let cible = 0, p = 0, visible = true;
  const mesure = () => {
    const r = section.getBoundingClientRect();
    cible = clamp01(-r.top / (r.height - innerHeight));
  };
  const taille = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Portrait screens: step back so the whole pizza fits.
    camera.userData.recul = w < h ? 1.6 : 1;
    if (w > 860) camera.setViewOffset(w, h, -w * 0.14, 0, w, h);
    else camera.setViewOffset(w, h, 0, -h * 0.12, w, h);
    camera.updateProjectionMatrix();
  };
  taille();
  mesure();
  addEventListener('resize', taille);
  addEventListener('scroll', mesure, { passive: true });
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(section);

  const debut = performance.now();
  const rendu = () => {
    requestAnimationFrame(rendu);
    if (!visible) return;
    const t = (performance.now() - debut) / 1000;
    p += (cible - p) * 0.08;
    section.dataset.etape = String([0.14, 0.32, 0.52, 0.66, 0.86].filter((s) => p >= s).length);
    section.style.setProperty('--p', p.toFixed(4));

    // Dough appears, rising and turning.
    const apparition = doux(etape(0, 0.1, p));
    pizza.scale.setScalar(0.7 + apparition * 0.3);
    pizza.position.y = (1 - apparition) * -0.6;
    pizza.rotation.y = p * Math.PI * 1.6 + t * 0.05;

    // Sauce spreads in a spiral.
    const s = doux(etape(0.14, 0.3, p));
    sauce.scale.setScalar(Math.max(s, 0.001));
    sauce.rotation.z = (1 - s) * 2.5;
    sauce.visible = s > 0.002;

    // Baking: crust colour, cheese melt and browning, oven glow, steam.
    const cuisson = doux(etape(0.68, 0.86, p));
    dessinerPate(cuisson);
    matMozza.color.copy(blanc).lerp(dore, cuisson * 0.55);
    matBasilic.color.set('#2f7d2c').lerp(new THREE.Color('#1d4d1b'), cuisson * 0.6);
    four.intensity = Math.sin(Math.PI * etape(0.64, 0.9, p)) * (38 + Math.sin(t * 13) * 5 + Math.sin(t * 7.3) * 4);
    cle.color.set('#ffe4bf').lerp(new THREE.Color('#ffb070'), Math.sin(Math.PI * etape(0.64, 0.9, p)) * 0.6);

    for (const m of mozzas) {
      const { x, z, debut, rot, h } = m.userData;
      const k = etape(debut, debut + 0.07, p);
      m.visible = k > 0;
      m.position.set(x, 0.1 + (1 - rebond(k)) * h, z);
      m.rotation.set(0, rot + (1 - k) * 3, 0);
      m.scale.set(1 + cuisson * 0.45, 0.45 - cuisson * 0.25, 1 + cuisson * 0.45);
    }
    for (const [i, m] of basilics.entries()) {
      const { x, z, debut, rot, s: sc } = m.userData;
      const k = etape(debut, debut + 0.09, p);
      const chute = 1 - doux(k);
      m.visible = k > 0;
      // Flutter: swings sideways and tilts while falling, lands flat on the cheese.
      m.position.set(x + Math.sin(k * 9 + i) * 0.3 * chute, 0.17 + chute * 2.4, z + Math.cos(k * 7 + i) * 0.2 * chute);
      m.rotation.set(Math.sin(k * 11 + i) * 0.9 * chute, rot + chute * 4, Math.cos(k * 8) * 0.6 * chute);
      m.scale.setScalar(sc);
    }
    const fumee = etape(0.8, 0.92, p);
    for (const f of fumees) {
      const { x, z, phase, vitesse } = f.userData;
      const v = (t * vitesse + phase) % 1;
      f.position.set(x + Math.sin(t + phase * 9) * 0.15, 0.3 + v * 2.2, z);
      f.scale.setScalar(0.6 + v * 1.6);
      (f.material as THREE.SpriteMaterial).opacity = fumee * Math.sin(Math.PI * v) * 0.35;
    }

    // Camera: low side view at first, rising to an overhead hero shot at the end.
    const elev = THREE.MathUtils.lerp(0.32, 1.22, doux(p));
    const dist = THREE.MathUtils.lerp(7.2, 6.4, p) * (camera.userData.recul ?? 1);
    camera.position.set(Math.sin(0.4) * Math.cos(elev) * dist, Math.sin(elev) * dist, Math.cos(0.4) * Math.cos(elev) * dist);
    camera.lookAt(0, 0.05, 0);
    renderer.render(scene, camera);
  };
  rendu();
}
