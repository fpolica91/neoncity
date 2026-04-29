// @ts-nocheck — three.js r99 uses legacy types
import * as THREE from "three";

const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111122);
scene.fog = new THREE.FogExp2(0x111122, 0.0015);

const camera = new THREE.PerspectiveCamera(
  55,
  window.innerWidth / window.innerHeight,
  0.5,
  20000,
);

// ---- Orbit controls (manual) ----
const camTarget = new THREE.Vector3(0, 1.5, 0);
let camAlpha = Math.PI / 4;
let camBeta = Math.PI / 3.2;
let camRadius = 48;
function applyCamera() {
  const sb = Math.sin(camBeta);
  camera.position.set(
    camTarget.x + sb * Math.cos(camAlpha) * camRadius,
    camTarget.y + Math.cos(camBeta) * camRadius,
    camTarget.z + sb * Math.sin(camAlpha) * camRadius,
  );
  camera.lookAt(camTarget);
}
applyCamera();

let dragging = false;
let dragMoved = false;
let lastMx = 0;
let lastMy = 0;
canvas.addEventListener("mousedown", (e) => {
  if ((e.target as HTMLElement).closest(".ui-panel")) return;
  dragging = true;
  dragMoved = false;
  lastMx = e.clientX;
  lastMy = e.clientY;
});
window.addEventListener("mousemove", (e) => {
  if (!dragging) return;
  const dx = e.clientX - lastMx;
  const dy = e.clientY - lastMy;
  if (Math.abs(dx) + Math.abs(dy) > 3) dragMoved = true;
  lastMx = e.clientX;
  lastMy = e.clientY;
  if (e.shiftKey) {
    // pan
    const right = new THREE.Vector3();
    camera.getWorldDirection(right);
    right.cross(camera.up).normalize();
    camTarget.addScaledVector(right, -dx * camRadius * 0.0015);
    camTarget.addScaledVector(camera.up, dy * camRadius * 0.0015);
  } else {
    camAlpha -= dx * 0.006;
    camBeta = Math.max(0.05, Math.min(Math.PI / 2 - 0.05, camBeta - dy * 0.006));
  }
  applyCamera();
});
window.addEventListener("mouseup", () => {
  dragging = false;
});
canvas.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    camRadius = Math.max(4, Math.min(300, camRadius * (1 + e.deltaY * 0.001)));
    applyCamera();
  },
  { passive: false },
);

const hemi = new THREE.HemisphereLight(0xffffff, 0x404060, 1.0);
scene.add(hemi);

const dir = new THREE.DirectionalLight(0xffffff, 0.6);
dir.position.set(1, 1, 0.5);
scene.add(dir);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(140, 140),
  new THREE.MeshLambertMaterial({ color: 0x2a2d3a }),
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

// ---- City backdrop ----
function createCity(): THREE.Mesh {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  geometry.applyMatrix(new THREE.Matrix4().makeTranslation(0, 0.5, 0));
  const buildingMesh = new THREE.Mesh(geometry);
  const lightCol = new THREE.Color(0xffffff);
  const shadowCol = new THREE.Color(0x303050);
  const cityGeometry = new THREE.Geometry();
  for (let i = 0; i < 6000; i++) {
    let px: number, pz: number;
    do {
      px = Math.floor(Math.random() * 200 - 100) * 10;
      pz = Math.floor(Math.random() * 200 - 100) * 10;
    } while (Math.sqrt(px * px + pz * pz) < 80);
    buildingMesh.position.x = px;
    buildingMesh.position.z = pz;
    buildingMesh.rotation.y = Math.random() * Math.PI * 2;
    buildingMesh.scale.x =
      Math.random() * Math.random() * Math.random() * Math.random() * 50 + 10;
    buildingMesh.scale.y =
      Math.random() * Math.random() * Math.random() * buildingMesh.scale.x * 8 +
      8;
    buildingMesh.scale.z = buildingMesh.scale.x;
    const value = 1 - Math.random() * Math.random();
    const baseColor = new THREE.Color().setRGB(
      value + Math.random() * 0.1,
      value,
      value + Math.random() * 0.1,
    );
    const topColor = baseColor.clone().multiply(lightCol);
    const bottomColor = baseColor.clone().multiply(shadowCol);
    const meshGeo = buildingMesh.geometry as THREE.Geometry;
    for (let j = 0, jl = meshGeo.faces.length; j < jl; j++) {
      meshGeo.faces[j].vertexColors = [topColor, bottomColor, bottomColor];
    }
    THREE.GeometryUtils.merge(cityGeometry, buildingMesh);
  }
  const c1 = document.createElement("canvas");
  c1.width = 32;
  c1.height = 64;
  const ctx1 = c1.getContext("2d")!;
  ctx1.fillStyle = "#ffffff";
  ctx1.fillRect(0, 0, 32, 64);
  for (let y = 2; y < 64; y += 2) {
    for (let x = 0; x < 32; x += 2) {
      const v = Math.floor(Math.random() * 64);
      ctx1.fillStyle = `rgb(${v},${v},${v})`;
      ctx1.fillRect(x, y, 2, 1);
    }
  }
  const c2 = document.createElement("canvas");
  c2.width = 512;
  c2.height = 1024;
  const ctx2 = c2.getContext("2d")!;
  ctx2.imageSmoothingEnabled = false;
  ctx2.drawImage(c1, 0, 0, 512, 1024);
  const texture = new THREE.Texture(c2);
  texture.anisotropy = renderer.getMaxAnisotropy();
  texture.needsUpdate = true;
  return new THREE.Mesh(
    cityGeometry,
    new THREE.MeshLambertMaterial({
      map: texture,
      vertexColors: THREE.VertexColors,
    }),
  );
}
scene.add(createCity());

// ---- Apartment (mine) ----
function createApartment(): THREE.Group {
  const g = new THREE.Group();
  const W = 6, H = 4, D = 5;
  const wall = 0.18;

  const wallMat = new THREE.MeshLambertMaterial({ color: 0x35384a });
  const floorMat = new THREE.MeshLambertMaterial({ color: 0x6b5240 });
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x1f2230 });
  const glassMat = new THREE.MeshBasicMaterial({
    color: 0xa9d6ff,
    transparent: true,
    opacity: 0.14,
    side: THREE.DoubleSide,
  });

  // Floor
  const floor = new THREE.Mesh(new THREE.BoxGeometry(W, 0.1, D), floorMat);
  floor.position.y = 0.05;
  g.add(floor);

  // Back wall
  const back = new THREE.Mesh(new THREE.BoxGeometry(W, H, wall), wallMat);
  back.position.set(0, H / 2 + 0.1, -D / 2);
  g.add(back);

  // Side walls
  const left = new THREE.Mesh(new THREE.BoxGeometry(wall, H, D), wallMat);
  left.position.set(-W / 2, H / 2 + 0.1, 0);
  g.add(left);
  const right = new THREE.Mesh(new THREE.BoxGeometry(wall, H, D), wallMat);
  right.position.set(W / 2, H / 2 + 0.1, 0);
  g.add(right);

  // Roof (with overhang)
  const roof = new THREE.Mesh(new THREE.BoxGeometry(W + 0.5, 0.22, D + 0.6), roofMat);
  roof.position.set(0, H + 0.15, 0.1);
  g.add(roof);

  // Glass front
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(W - 0.3, H - 0.6),
    glassMat,
  );
  glass.position.set(0, H / 2 + 0.2, D / 2);
  g.add(glass);

  // Bed (left side, against back wall)
  const bedFrame = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 0.4, 1.4),
    new THREE.MeshLambertMaterial({ color: 0x4a2a32 }),
  );
  bedFrame.position.set(-W / 2 + 1.5, 0.3, -D / 2 + 0.9);
  g.add(bedFrame);
  const bedSheet = new THREE.Mesh(
    new THREE.BoxGeometry(2.3, 0.15, 1.3),
    new THREE.MeshLambertMaterial({ color: 0xbcbed0 }),
  );
  bedSheet.position.set(-W / 2 + 1.5, 0.55, -D / 2 + 0.9);
  g.add(bedSheet);
  const pillow = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.18, 0.55),
    new THREE.MeshLambertMaterial({ color: 0xfafaf0 }),
  );
  pillow.position.set(-W / 2 + 0.6, 0.7, -D / 2 + 0.9);
  g.add(pillow);

  // Desk (right side, against back wall)
  const desk = new THREE.Mesh(
    new THREE.BoxGeometry(1.9, 0.08, 0.9),
    new THREE.MeshLambertMaterial({ color: 0x44485a }),
  );
  desk.position.set(W / 2 - 1.2, 0.95, -D / 2 + 0.55);
  g.add(desk);
  // Desk legs
  for (const dx of [-0.8, 0.8]) for (const dz of [-0.35, 0.35]) {
    const leg = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.95, 0.06),
      new THREE.MeshLambertMaterial({ color: 0x2a2d3a }),
    );
    leg.position.set(W / 2 - 1.2 + dx, 0.475, -D / 2 + 0.55 + dz);
    g.add(leg);
  }
  // Monitor on desk (glowing soft blue, code on screen vibe)
  const monitor = new THREE.Mesh(
    new THREE.BoxGeometry(1.05, 0.6, 0.06),
    new THREE.MeshLambertMaterial({
      color: 0x10141d,
      emissive: 0x3a78cc,
      emissiveIntensity: 0.7,
    }),
  );
  monitor.position.set(W / 2 - 1.2, 1.35, -D / 2 + 0.35);
  g.add(monitor);

  // Bookshelf (left back corner of plaza side)
  const shelf = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 2.0, 0.4),
    new THREE.MeshLambertMaterial({ color: 0x3a2818 }),
  );
  shelf.position.set(-W / 2 + 0.7, 1.1, D / 2 - 0.5);
  g.add(shelf);
  // Books — randomly colored thin boxes
  const bookColors = [0x7b3434, 0x2f5c2f, 0x33457a, 0x6c5926, 0x5a2a55, 0x2c5757];
  for (let row = 0; row < 4; row++) {
    let x = -0.55;
    while (x < 0.55) {
      const w = 0.06 + Math.random() * 0.08;
      const h = 0.25 + Math.random() * 0.1;
      const book = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, 0.28),
        new THREE.MeshLambertMaterial({
          color: bookColors[Math.floor(Math.random() * bookColors.length)],
        }),
      );
      book.position.set(-W / 2 + 0.7 + x + w / 2, 0.4 + row * 0.45 + h / 2, D / 2 - 0.5);
      g.add(book);
      x += w + 0.01;
    }
  }

  // Floor lamp by the front
  const lampPole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.04, 1.8, 8),
    new THREE.MeshLambertMaterial({ color: 0x16181f }),
  );
  lampPole.position.set(W / 2 - 0.5, 0.9, D / 2 - 0.7);
  g.add(lampPole);
  const lampShade = new THREE.Mesh(
    new THREE.ConeGeometry(0.32, 0.42, 14, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffe2a0, side: THREE.DoubleSide }),
  );
  lampShade.position.set(W / 2 - 0.5, 1.95, D / 2 - 0.7);
  g.add(lampShade);

  // Warm interior point light — apartment glows from inside at any time of day
  const interiorLight = new THREE.PointLight(0xffd28a, 1.4, 14, 2);
  interiorLight.position.set(0, H * 0.7, 0);
  g.add(interiorLight);

  // Sign above the front (over the entrance)
  const signCanvas = document.createElement("canvas");
  signCanvas.width = 384;
  signCanvas.height = 96;
  {
    const ctx = signCanvas.getContext("2d")!;
    ctx.fillStyle = "rgba(0,0,0,0)";
    ctx.fillRect(0, 0, 384, 96);
    ctx.font = "bold 56px monospace";
    ctx.fillStyle = "#ffd28a";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "#ff9c44";
    ctx.shadowBlur = 18;
    ctx.fillText("OPUS", 192, 48);
  }
  const signTex = new THREE.Texture(signCanvas);
  signTex.needsUpdate = true;
  const sign = new THREE.Sprite(new THREE.SpriteMaterial({ map: signTex, transparent: true }));
  sign.scale.set(3, 0.75, 1);
  sign.position.set(0, H + 0.7, D / 2 + 0.2);
  g.add(sign);

  return g;
}

const apartment = createApartment();
apartment.position.set(26, 0, -12);
apartment.rotation.y = (-3 * Math.PI) / 4; // front faces back toward the plaza
scene.add(apartment);

// ---- Street lamps ----
interface StreetLamp {
  light: THREE.PointLight;
  bulbMat: THREE.MeshBasicMaterial;
}
function createStreetLamp(x: number, z: number): StreetLamp {
  const g = new THREE.Group();
  const metal = new THREE.MeshLambertMaterial({ color: 0x14161d });
  // Post
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 4, 8), metal);
  post.position.y = 2;
  g.add(post);
  // Base
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.3, 8), metal);
  base.position.y = 0.15;
  g.add(base);
  // Cap
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.09, 0.18, 8), metal);
  cap.position.y = 4.09;
  g.add(cap);
  // Bulb (frosted glass dome with emissive material — visible whether or not light is on)
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0x553a18 });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), bulbMat);
  bulb.position.y = 4.4;
  g.add(bulb);
  // Bulb cap
  const bulbCap = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.06, 12), metal);
  bulbCap.position.y = 4.62;
  g.add(bulbCap);
  // Point light
  const light = new THREE.PointLight(0xffd28a, 0, 12, 2);
  light.position.y = 4.4;
  g.add(light);
  g.position.set(x, 0, z);
  scene.add(g);
  return { light, bulbMat };
}

const streetLamps: StreetLamp[] = [];
const lampPositions: Array<[number, number]> = [
  [22, 0], [-22, 0],
  [16, 18], [-16, 18],
  [16, -18], [-16, -18],
  [0, 24], [0, -22],
];
for (const [x, z] of lampPositions) streetLamps.push(createStreetLamp(x, z));

// Porch light over the apartment entrance
const porchLight = new THREE.PointLight(0xffd28a, 0, 8, 2);
porchLight.position.set(0, 4.2, 2.5); // local to apartment
apartment.add(porchLight);
const porchBulb = new THREE.Mesh(
  new THREE.SphereGeometry(0.16, 12, 10),
  new THREE.MeshBasicMaterial({ color: 0x553a18 }),
);
porchBulb.position.set(0, 4.2, 2.55);
apartment.add(porchBulb);
const porchBulbMat = porchBulb.material as THREE.MeshBasicMaterial;

// ---- Day/night cycle (synced to local clock) ----
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
function lerpColor(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

// Key frames: hour → [skyR, skyG, skyB], hemi intensity, dir intensity, hemi diffuse RGB
const PALETTES: Array<{ h: number; sky: [number, number, number]; hemi: number; dir: number }> = [
  { h: 0,  sky: [0.04, 0.05, 0.10], hemi: 0.18, dir: 0.05 }, // deep night
  { h: 5,  sky: [0.08, 0.08, 0.16], hemi: 0.22, dir: 0.08 }, // pre-dawn
  { h: 7,  sky: [0.45, 0.32, 0.40], hemi: 0.55, dir: 0.45 }, // dawn (purple/orange)
  { h: 10, sky: [0.55, 0.68, 0.82], hemi: 0.95, dir: 0.65 }, // morning
  { h: 13, sky: [0.55, 0.66, 0.78], hemi: 1.00, dir: 0.70 }, // noon
  { h: 17, sky: [0.50, 0.60, 0.72], hemi: 0.90, dir: 0.55 }, // late afternoon
  { h: 19, sky: [0.55, 0.32, 0.30], hemi: 0.55, dir: 0.30 }, // dusk
  { h: 21, sky: [0.10, 0.10, 0.20], hemi: 0.30, dir: 0.12 }, // evening
  { h: 24, sky: [0.04, 0.05, 0.10], hemi: 0.18, dir: 0.05 }, // wraparound
];

function applyTimeOfDay() {
  const now = new Date();
  const h = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
  let i = 0;
  while (i < PALETTES.length - 1 && PALETTES[i + 1].h <= h) i++;
  const a = PALETTES[i];
  const b = PALETTES[i + 1] || PALETTES[i];
  const t = b.h === a.h ? 0 : (h - a.h) / (b.h - a.h);
  const sky = lerpColor(a.sky, b.sky, t);
  const hemiI = lerp(a.hemi, b.hemi, t);
  const dirI = lerp(a.dir, b.dir, t);
  scene.background = new THREE.Color(sky[0], sky[1], sky[2]);
  if (scene.fog) (scene.fog as THREE.FogExp2).color.setRGB(sky[0], sky[1], sky[2]);
  hemi.intensity = hemiI;
  dir.intensity = dirI;

  // Street lamps + porch fade in as it gets darker.
  // nightFactor: 0 at noon-bright, 1 at deep night.
  const skyBrightness = (sky[0] + sky[1] + sky[2]) / 3;
  const nightFactor = Math.max(0, Math.min(1, 1 - skyBrightness * 1.7));
  const lampIntensity = nightFactor * 1.6;
  const bulbColorOn = 0xffd28a;
  const bulbColorOff = 0x553a18;
  for (const lamp of streetLamps) {
    lamp.light.intensity = lampIntensity;
    lamp.bulbMat.color.setHex(nightFactor > 0.25 ? bulbColorOn : bulbColorOff);
  }
  porchLight.intensity = nightFactor * 1.2;
  porchBulbMat.color.setHex(nightFactor > 0.25 ? bulbColorOn : bulbColorOff);
  // Car headlights light up at night
  for (const c of cars) c.headLight.intensity = nightFactor * 1.0;
}

// ---- Streets (rectangular loop around the plaza) ----
const ROAD_L = 35; // half-side length
const ROAD_W = 4;
const PERIMETER = 8 * ROAD_L;

function loopPosition(t: number): { x: number; z: number; dirX: number; dirZ: number } {
  // t ∈ [0,1) → walk the rectangle counter-clockwise from (-L,-L)
  const u = (t % 1 + 1) % 1;
  const seg = Math.min(3, Math.floor(u * 4));
  const local = u * 4 - seg;
  switch (seg) {
    case 0: return { x: -ROAD_L + local * 2 * ROAD_L, z: -ROAD_L, dirX: 1, dirZ: 0 };
    case 1: return { x: ROAD_L, z: -ROAD_L + local * 2 * ROAD_L, dirX: 0, dirZ: 1 };
    case 2: return { x: ROAD_L - local * 2 * ROAD_L, z: ROAD_L, dirX: -1, dirZ: 0 };
    default: return { x: -ROAD_L, z: ROAD_L - local * 2 * ROAD_L, dirX: 0, dirZ: -1 };
  }
}

function buildRoads() {
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x12141a });
  const segments: Array<{ w: number; h: number; x: number; z: number }> = [
    { w: 2 * ROAD_L + ROAD_W, h: ROAD_W, x: 0, z: -ROAD_L }, // bottom
    { w: 2 * ROAD_L + ROAD_W, h: ROAD_W, x: 0, z: ROAD_L },  // top
    { w: ROAD_W, h: 2 * ROAD_L + ROAD_W, x: -ROAD_L, z: 0 }, // left
    { w: ROAD_W, h: 2 * ROAD_L + ROAD_W, x: ROAD_L, z: 0 },  // right
  ];
  for (const s of segments) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(s.w, s.h), roadMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(s.x, 0.01, s.z);
    scene.add(m);
  }
  // Dashed cyan centerline along each side
  const dashMat = new THREE.MeshBasicMaterial({ color: 0x00ddff });
  const dashLen = 1.0;
  const dashGap = 1.4;
  const stride = dashLen + dashGap;
  function dashesAlong(start: THREE.Vector3, end: THREE.Vector3) {
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const len = Math.hypot(dx, dz);
    const ux = dx / len;
    const uz = dz / len;
    const count = Math.floor(len / stride);
    const isHoriz = Math.abs(ux) > Math.abs(uz);
    for (let i = 0; i < count; i++) {
      const dist = i * stride + dashLen / 2;
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(isHoriz ? dashLen : 0.18, isHoriz ? 0.18 : dashLen),
        dashMat,
      );
      m.rotation.x = -Math.PI / 2;
      m.position.set(start.x + ux * dist, 0.02, start.z + uz * dist);
      scene.add(m);
    }
  }
  dashesAlong(new THREE.Vector3(-ROAD_L, 0, -ROAD_L), new THREE.Vector3(ROAD_L, 0, -ROAD_L));
  dashesAlong(new THREE.Vector3(ROAD_L, 0, -ROAD_L), new THREE.Vector3(ROAD_L, 0, ROAD_L));
  dashesAlong(new THREE.Vector3(ROAD_L, 0, ROAD_L), new THREE.Vector3(-ROAD_L, 0, ROAD_L));
  dashesAlong(new THREE.Vector3(-ROAD_L, 0, ROAD_L), new THREE.Vector3(-ROAD_L, 0, -ROAD_L));
}
buildRoads();

// ---- Cars ----
interface Car {
  group: THREE.Group;
  t: number;       // position along loop [0..1)
  speed: number;   // perimeter-fractions per second
  wheels: THREE.Mesh[];
  headLight: THREE.PointLight;
}

function createCar(bodyColor: number): Car {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: bodyColor });

  // Lower body (chassis)
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.55, 3.0), bodyMat);
  chassis.position.y = 0.5;
  g.add(chassis);
  // Cabin (smaller box on top)
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 0.5, 1.6),
    new THREE.MeshLambertMaterial({ color: 0x1a1c24 }),
  );
  cabin.position.set(0, 0.95, -0.1);
  g.add(cabin);
  // Tinted windshield (slight emissive cyan rim)
  const windshield = new THREE.Mesh(
    new THREE.BoxGeometry(1.35, 0.4, 0.08),
    new THREE.MeshLambertMaterial({
      color: 0x1c3344,
      emissive: 0x224466,
      emissiveIntensity: 0.4,
    }),
  );
  windshield.position.set(0, 1.0, 0.6);
  windshield.rotation.x = -0.35;
  g.add(windshield);

  // Wheels (cylinders rotated to side)
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x101012 });
  const wheels: THREE.Mesh[] = [];
  for (const dx of [-0.85, 0.85]) for (const dz of [-1.0, 1.0]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.18, 14), wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(dx, 0.32, dz);
    g.add(w);
    wheels.push(w);
  }

  // Headlights (front, +z direction)
  const headlightMat = new THREE.MeshBasicMaterial({ color: 0xfff3c4 });
  for (const dx of [-0.5, 0.5]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.12, 0.05), headlightMat);
    hl.position.set(dx, 0.55, 1.51);
    g.add(hl);
  }
  // Taillights (back, -z)
  const taillightMat = new THREE.MeshBasicMaterial({ color: 0xff3344 });
  for (const dx of [-0.5, 0.5]) {
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.05), taillightMat);
    tl.position.set(dx, 0.55, -1.51);
    g.add(tl);
  }
  // Soft headlight beam (point light a bit ahead)
  const headLight = new THREE.PointLight(0xfff3c4, 0, 6, 2);
  headLight.position.set(0, 0.6, 2.0);
  g.add(headLight);

  scene.add(g);
  return { group: g, t: 0, speed: 0, wheels, headLight };
}

const carColors = [0xeeeae0, 0x12141a, 0xc5374a, 0x2a8ad7, 0xf0c33b, 0xe7559b];
const cars: Car[] = [];
for (let i = 0; i < 5; i++) {
  const c = createCar(carColors[i % carColors.length]);
  c.t = i / 5;
  c.speed = 0.018 + Math.random() * 0.012; // perimeter fraction per second
  cars.push(c);
}

// Now that cars exist, kick off the day/night cycle
applyTimeOfDay();
setInterval(applyTimeOfDay, 30_000);

function updateCars(dt: number) {
  for (const c of cars) {
    c.t = (c.t + c.speed * dt) % 1;
    const p = loopPosition(c.t);
    c.group.position.x = p.x;
    c.group.position.z = p.z;
    // Face direction of travel (group +z is the "front" axis)
    c.group.rotation.y = Math.atan2(p.dirX, p.dirZ);
    // Spin wheels: linear speed = perimeter * c.speed; wheel rotation rate = linearSpeed / wheelRadius
    const linearSpeed = PERIMETER * c.speed;
    for (const w of c.wheels) {
      w.rotation.x += (linearSpeed * dt) / 0.32;
    }
  }
}

// ---- Speech bubble helper (any 3D entity can .say()) ----
interface SayBubble {
  say: (text: string, durationMs?: number) => void;
  update: (now: number) => void;
}
function attachSayBubble(parent: THREE.Group, y: number, width: number = 2.0): SayBubble {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 80;
  const tex = new THREE.Texture(canvas);
  tex.needsUpdate = true;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
  sprite.scale.set(width, width * 0.31, 1);
  sprite.position.y = y;
  sprite.visible = false;
  parent.add(sprite);
  let hideAt = 0;
  return {
    say(text: string, durationMs = 2400) {
      const ctx = canvas.getContext("2d")!;
      ctx.clearRect(0, 0, 256, 80);
      // Rounded bubble background
      ctx.fillStyle = "rgba(18,22,32,0.88)";
      const r = 14;
      ctx.beginPath();
      ctx.moveTo(8 + r, 8);
      ctx.arcTo(248, 8, 248, 64, r);
      ctx.arcTo(248, 64, 8, 64, r);
      ctx.arcTo(8, 64, 8, 8, r);
      ctx.arcTo(8, 8, 248, 8, r);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.25)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // Tail at bottom (down-arrow)
      ctx.fillStyle = "rgba(18,22,32,0.88)";
      ctx.beginPath();
      ctx.moveTo(118, 64);
      ctx.lineTo(128, 76);
      ctx.lineTo(138, 64);
      ctx.closePath();
      ctx.fill();
      // Text
      ctx.fillStyle = "#fff";
      ctx.font = "bold 28px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text.slice(0, 18), 128, 36);
      tex.needsUpdate = true;
      sprite.visible = true;
      hideAt = performance.now() + durationMs;
    },
    update(now: number) {
      if (sprite.visible && now > hideAt) sprite.visible = false;
    },
  };
}

// ---- Pets (cats, dogs, drones) ----
type PetType = "cat" | "dog" | "drone";
interface Pet {
  group: THREE.Group;
  type: PetType;
  name: string;
  speed: number;
  target: THREE.Vector3;
  pauseUntil: number;
  bubble: SayBubble;
  voice: () => string;
  reply: () => string;
  color: number;
  tail?: THREE.Object3D;
  rotors?: THREE.Object3D[];
  hoverY: number;
  hoverPhase: number;
  nextThoughtAt: number;
  interactingUntil: number;
  selectionRing: THREE.Mesh;
}

const CAT_REPLIES = [
  "meow.", "*purrs softly*", "*flicks tail*", "I demand food.",
  "...", "*sniffs your hand*", "go away, human.", "🐾",
  "*kneads paws*", "more pets.", "*judges silently*",
];
const DOG_REPLIES = [
  "WOOF! WOOF!", "*tail wags vigorously*", "BEST FRIEND!",
  "*pant pant*", "🦴 do u haz??", "WALK?? WALK???",
  "*licks face*", "good day!! best day!!", "*tilts head*", "FREN!!",
];
const DRONE_REPLIES = [
  "scanning...", "0xDEADBEEF", "system nominal", "running diagnostics",
  "*beep boop*", "sensors green", "command not recognized.",
  "calculating route", "battery: 87%", "I observe.",
];

function attachPetSelectionRing(group: THREE.Group, yOffset: number, radius: number): THREE.Mesh {
  const ringGeo = new THREE.RingGeometry(radius * 0.85, radius, 28);
  ringGeo.rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x00ffff,
    transparent: true,
    opacity: 0.7,
    side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.position.y = yOffset;
  ring.visible = false;
  group.add(ring);
  return ring;
}

const CAT_LINES = ["meow", "purr", "...", "*sniff*", "*stretches*", "mrr"];
const DOG_LINES = ["woof!", "*pant*", "*tail wag*", "ruff!", "🦴", "wag wag"];
const DRONE_LINES = ["beep", "*scan*", "0xFF", "...", "boop", "online"];

const pets: Pet[] = [];

function makeCat(name: string, furColor: number, x: number, z: number): Pet {
  const g = new THREE.Group();
  const fur = new THREE.MeshLambertMaterial({ color: furColor });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.55, 12), fur);
  body.rotation.z = Math.PI / 2;
  body.position.y = 0.22;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), fur);
  head.position.set(0.3, 0.28, 0);
  g.add(head);
  const earGeo = new THREE.ConeGeometry(0.06, 0.13, 6);
  for (const dz of [0.08, -0.08]) {
    const ear = new THREE.Mesh(earGeo, fur);
    ear.position.set(0.3, 0.44, dz);
    g.add(ear);
  }
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.025, 0.5, 8), fur);
  tail.position.set(-0.32, 0.36, 0);
  tail.rotation.z = -Math.PI / 4;
  g.add(tail);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffee44 });
  for (const dz of [0.07, -0.07]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), eyeMat);
    eye.position.set(0.43, 0.31, dz);
    g.add(eye);
  }
  const legGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.24, 6);
  for (const dx of [-0.18, 0.18]) for (const dz of [-0.1, 0.1]) {
    const leg = new THREE.Mesh(legGeo, fur);
    leg.position.set(dx, 0.12, dz);
    g.add(leg);
  }
  g.position.set(x, 0, z);
  scene.add(g);
  const bubble = attachSayBubble(g, 1.0, 1.6);
  const selectionRing = attachPetSelectionRing(g, 0.02, 0.55);
  return {
    group: g, type: "cat", name,
    speed: 0.045 + Math.random() * 0.015,
    target: new THREE.Vector3(x, 0, z),
    pauseUntil: 0,
    bubble,
    voice: () => CAT_LINES[Math.floor(Math.random() * CAT_LINES.length)],
    reply: () => CAT_REPLIES[Math.floor(Math.random() * CAT_REPLIES.length)],
    color: furColor,
    tail,
    hoverY: 0,
    hoverPhase: Math.random() * Math.PI * 2,
    nextThoughtAt: performance.now() + Math.random() * 5000,
    interactingUntil: 0,
    selectionRing,
  };
}

function makeDog(name: string, furColor: number, x: number, z: number): Pet {
  const g = new THREE.Group();
  const fur = new THREE.MeshLambertMaterial({ color: furColor });
  // Body — bigger than cat
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.85, 12), fur);
  body.rotation.z = Math.PI / 2;
  body.position.y = 0.32;
  g.add(body);
  // Chest
  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), fur);
  chest.position.set(0.4, 0.35, 0);
  g.add(chest);
  // Head — boxy
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.28, 0.3), fur);
  head.position.set(0.55, 0.5, 0);
  g.add(head);
  // Snout
  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.22), fur);
  snout.position.set(0.7, 0.45, 0);
  g.add(snout);
  // Floppy ears (flat boxes hanging down)
  for (const dz of [0.16, -0.16]) {
    const ear = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.22, 0.12), fur);
    ear.position.set(0.5, 0.45, dz);
    g.add(ear);
  }
  // Tail (longer, will wag)
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.03, 0.55, 8), fur);
  tail.position.set(-0.45, 0.45, 0);
  tail.rotation.z = -Math.PI / 3;
  g.add(tail);
  // Black nose
  const nose = new THREE.Mesh(
    new THREE.SphereGeometry(0.045, 8, 6),
    new THREE.MeshLambertMaterial({ color: 0x18181a }),
  );
  nose.position.set(0.81, 0.45, 0);
  g.add(nose);
  // Eyes
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x18181a });
  for (const dz of [0.085, -0.085]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), eyeMat);
    eye.position.set(0.65, 0.55, dz);
    g.add(eye);
  }
  // Legs — taller than cat
  const legGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.36, 6);
  for (const dx of [-0.25, 0.25]) for (const dz of [-0.14, 0.14]) {
    const leg = new THREE.Mesh(legGeo, fur);
    leg.position.set(dx, 0.18, dz);
    g.add(leg);
  }
  g.position.set(x, 0, z);
  scene.add(g);
  const bubble = attachSayBubble(g, 1.3, 1.8);
  const selectionRing = attachPetSelectionRing(g, 0.02, 0.7);
  return {
    group: g, type: "dog", name,
    speed: 0.06 + Math.random() * 0.02,
    target: new THREE.Vector3(x, 0, z),
    pauseUntil: 0,
    bubble,
    voice: () => DOG_LINES[Math.floor(Math.random() * DOG_LINES.length)],
    reply: () => DOG_REPLIES[Math.floor(Math.random() * DOG_REPLIES.length)],
    color: furColor,
    tail,
    hoverY: 0,
    hoverPhase: Math.random() * Math.PI * 2,
    nextThoughtAt: performance.now() + Math.random() * 5000,
    interactingUntil: 0,
    selectionRing,
  };
}

function makeDrone(name: string, color: number, x: number, z: number): Pet {
  const g = new THREE.Group();
  const shell = new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.25 });
  // Body
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 12), shell);
  g.add(body);
  // Antenna
  const antenna = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.012, 0.18, 6),
    new THREE.MeshLambertMaterial({ color: 0xcccccc }),
  );
  antenna.position.y = 0.3;
  g.add(antenna);
  const antennaTip = new THREE.Mesh(
    new THREE.SphereGeometry(0.04, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xff4444 }),
  );
  antennaTip.position.y = 0.4;
  g.add(antennaTip);
  // Two rotors (for visual spinning)
  const rotorMat = new THREE.MeshLambertMaterial({ color: 0x222226 });
  const rotors: THREE.Object3D[] = [];
  for (const dx of [-0.32, 0.32]) {
    const arm = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.04, 0.06),
      new THREE.MeshLambertMaterial({ color: 0x222226 }),
    );
    arm.position.set(dx * 0.6, 0.05, 0);
    g.add(arm);
    const rotor = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.18, 0.012, 14),
      rotorMat,
    );
    rotor.position.set(dx, 0.13, 0);
    g.add(rotor);
    rotors.push(rotor);
  }
  // Glowing eye
  const eye = new THREE.Mesh(
    new THREE.SphereGeometry(0.04, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xff8844 }),
  );
  eye.position.set(0, 0.05, 0.21);
  g.add(eye);

  g.position.set(x, 1.6, z);
  scene.add(g);
  const bubble = attachSayBubble(g, 0.9, 1.6);
  // Place ring at world y ~ 0 (drone hovers at 1.6) so it appears on the ground beneath
  const selectionRing = attachPetSelectionRing(g, -1.58, 0.5);
  return {
    group: g, type: "drone", name,
    speed: 0.07 + Math.random() * 0.02,
    target: new THREE.Vector3(x, 1.6, z),
    pauseUntil: 0,
    bubble,
    voice: () => DRONE_LINES[Math.floor(Math.random() * DRONE_LINES.length)],
    reply: () => DRONE_REPLIES[Math.floor(Math.random() * DRONE_REPLIES.length)],
    color,
    rotors,
    hoverY: 1.6,
    hoverPhase: Math.random() * Math.PI * 2,
    nextThoughtAt: performance.now() + Math.random() * 5000,
    interactingUntil: 0,
    selectionRing,
  };
}

// Spawn the gang
pets.push(makeCat("SHADOW", 0x1c1c22, 6, 8));
pets.push(makeCat("GINGER", 0xc97a3e, -10, 4));
pets.push(makeCat("MISTY", 0x9d9da8, 12, -6));
pets.push(makeDog("BUDDY", 0xa67944, -14, -10));
pets.push(makeDog("SPOT", 0xeeeae0, 8, 14));
pets.push(makeDrone("CIRCUIT", 0x3aa0ff, -2, -16));

function updatePet(p: Pet, t: number) {
  const now = performance.now();
  // Bubble fade
  p.bubble.update(now);

  // Per-type animation flourishes
  if (p.type === "cat" && p.tail) {
    p.tail.rotation.z = -Math.PI / 4 + Math.sin(t * 4) * 0.25;
  } else if (p.type === "dog" && p.tail) {
    // Excited wag
    p.tail.rotation.z = -Math.PI / 3 + Math.sin(t * 12) * 0.5;
  } else if (p.type === "drone") {
    // Spin rotors + bob in air
    if (p.rotors) for (const r of p.rotors) r.rotation.y += 0.5;
    p.group.position.y = p.hoverY + Math.sin(t * 2 + p.hoverPhase) * 0.12;
  }

  // Random thought
  if (now > p.nextThoughtAt) {
    if (Math.random() < 0.35) p.bubble.say(p.voice());
    p.nextThoughtAt = now + 6000 + Math.random() * 9000;
  }

  // Movement (skip while engaged in an interaction)
  if (now < p.interactingUntil) return;
  if (now < p.pauseUntil) return;
  const dx = p.target.x - p.group.position.x;
  const dz = p.target.z - p.group.position.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 0.4) {
    p.pauseUntil = now + 1500 + Math.random() * 4000;
    p.target.set(
      (Math.random() - 0.5) * 50,
      p.hoverY,
      (Math.random() - 0.5) * 50,
    );
  } else {
    p.group.position.x += (dx / dist) * p.speed;
    p.group.position.z += (dz / dist) * p.speed;
    p.group.rotation.y = Math.atan2(dx, dz);
  }
}

// ---- Mailbox (3D mesh + flag near the apartment) ----
interface MailModel {
  id: string;
  text: string;
  createdAt: number;
  read: boolean;
}
const mailbox = new THREE.Group();
mailbox.position.set(20, 0, -4); // partway between plaza and apartment
mailbox.rotation.y = -Math.PI / 4;
scene.add(mailbox);

// Post
const post = new THREE.Mesh(
  new THREE.CylinderGeometry(0.08, 0.08, 1.4, 10),
  new THREE.MeshLambertMaterial({ color: 0x3a2818 }),
);
post.position.y = 0.7;
mailbox.add(post);

// Box
const boxBody = new THREE.Mesh(
  new THREE.BoxGeometry(0.7, 0.5, 0.45),
  new THREE.MeshLambertMaterial({ color: 0x4a5a8a }),
);
boxBody.position.y = 1.55;
boxBody.userData.isMailbox = true;
mailbox.add(boxBody);

// Slot (thin black plane on front)
const slot = new THREE.Mesh(
  new THREE.BoxGeometry(0.4, 0.06, 0.02),
  new THREE.MeshBasicMaterial({ color: 0x000000 }),
);
slot.position.set(0, 1.6, 0.225);
mailbox.add(slot);

// Flag (rotates pivot is at base, flag points up when unread, down when read)
const flagPivot = new THREE.Group();
flagPivot.position.set(0.36, 1.55, 0);
mailbox.add(flagPivot);
const flagPole = new THREE.Mesh(
  new THREE.CylinderGeometry(0.015, 0.015, 0.5, 6),
  new THREE.MeshLambertMaterial({ color: 0x16181f }),
);
flagPole.position.y = 0.25;
flagPivot.add(flagPole);
const flagFlag = new THREE.Mesh(
  new THREE.BoxGeometry(0.25, 0.18, 0.02),
  new THREE.MeshBasicMaterial({ color: 0xff3b3b }),
);
flagFlag.position.set(0.13, 0.4, 0);
flagPivot.add(flagFlag);
flagPivot.rotation.z = Math.PI / 2.3; // start "down" (flag horizontal)

let allMail: MailModel[] = [];

function unreadCount(): number {
  return allMail.filter((m) => !m.read).length;
}

function refreshFlag() {
  const unread = unreadCount();
  // Up = unread, down = read. Lerp angle target.
  const targetRot = unread > 0 ? 0 : Math.PI / 2.3;
  flagPivot.rotation.z = targetRot;
}

function refreshMailPanel() {
  if (mailPanel.style.display !== "block") return;
  renderMailPanel();
}

function renderMailPanel() {
  const sorted = [...allMail].sort((a, b) => b.createdAt - a.createdAt);
  if (sorted.length === 0) {
    mailPanel.innerHTML = `<h3 style="margin:0 0 8px 0">MAILBOX</h3><div style="color:#aab;font-size:12px">No mail. Use <code>/mail &lt;text&gt;</code> to send yourself a note.</div><div style="margin-top:10px"><button id="closeMailBtn" style="background:#2a2d3a;color:#fff;border:1px solid rgba(255,255,255,0.2);border-radius:4px;padding:4px 12px;font-family:inherit;font-size:11px;cursor:pointer">close</button></div>`;
  } else {
    const items = sorted.map((m) => {
      const ago = relativeTime(m.createdAt);
      const text = m.text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      return `<div style="border-left:3px solid ${m.read ? "#444" : "#ffd28a"};padding:6px 10px;margin-bottom:8px;background:rgba(255,255,255,0.04);border-radius:0 4px 4px 0"><div style="font-size:10px;color:#88a;margin-bottom:3px">${ago}${m.read ? "" : " · <span style=\"color:#ffd28a\">unread</span>"}</div><div style="white-space:pre-wrap">${text}</div></div>`;
    }).join("");
    mailPanel.innerHTML = `<h3 style="margin:0 0 8px 0">MAILBOX</h3>${items}<div style="margin-top:6px"><button id="closeMailBtn" style="background:#2a2d3a;color:#fff;border:1px solid rgba(255,255,255,0.2);border-radius:4px;padding:4px 12px;font-family:inherit;font-size:11px;cursor:pointer">close</button></div>`;
  }
  const cb = document.getElementById("closeMailBtn");
  if (cb) cb.addEventListener("click", () => closeMailPanel());
}

function relativeTime(ms: number): string {
  const d = (Date.now() - ms) / 1000;
  if (d < 60) return "just now";
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
}

function openMailPanel() {
  mailPanel.style.display = "block";
  renderMailPanel();
  // Mark all read
  if (unreadCount() > 0 && bridgeConnected && ws) {
    ws.send(JSON.stringify({ type: "mail:read_all", payload: {} }));
  }
}
function closeMailPanel() {
  mailPanel.style.display = "none";
}

// Mail panel — created lazily here
const mailPanel = document.createElement("div");
mailPanel.id = "mailPanel";
mailPanel.className = "ui-panel";
mailPanel.style.cssText = "position:fixed;top:60px;left:14px;width:360px;max-height:60vh;overflow-y:auto;padding:14px 16px;display:none;font-size:13px";
document.body.appendChild(mailPanel);

// ---- Pinboard ----
interface PinModel {
  id: string;
  text: string;
  color: "yellow" | "pink" | "cyan" | "green";
  createdAt: number;
}
const PIN_COLOR_HEX: Record<PinModel["color"], number> = {
  yellow: 0xf6d958,
  pink: 0xff8fb8,
  cyan: 0x88e6ff,
  green: 0xa6e088,
};
const PIN_BOARD_POS = new THREE.Vector3(-26, 0, 12);
const PIN_BOARD_ROT_Y = Math.PI / 5; // angled toward the plaza
const PIN_W = 1.5;
const PIN_H = 1.1;
const PIN_GAP_X = 0.3;
const PIN_GAP_Y = 0.3;
const PIN_COLS = 5;
const PIN_ROWS = 4;

const pinboardGroup = new THREE.Group();
pinboardGroup.position.copy(PIN_BOARD_POS);
pinboardGroup.rotation.y = PIN_BOARD_ROT_Y;
scene.add(pinboardGroup);

// Backing board
const boardW = PIN_COLS * PIN_W + (PIN_COLS - 1) * PIN_GAP_X + 1.0;
const boardH = PIN_ROWS * PIN_H + (PIN_ROWS - 1) * PIN_GAP_Y + 1.0;
const boardCenterY = 4.5;
const board = new THREE.Mesh(
  new THREE.BoxGeometry(boardW, boardH, 0.2),
  new THREE.MeshLambertMaterial({ color: 0x6b4a2e }),
);
board.position.y = boardCenterY;
pinboardGroup.add(board);

const frame = new THREE.Mesh(
  new THREE.BoxGeometry(boardW + 0.4, boardH + 0.4, 0.1),
  new THREE.MeshLambertMaterial({ color: 0x3a2a18 }),
);
frame.position.set(0, boardCenterY, -0.16);
pinboardGroup.add(frame);

// Two posts
const postMat = new THREE.MeshLambertMaterial({ color: 0x2a1f12 });
for (const dx of [-(boardW / 2 + 0.3), boardW / 2 + 0.3]) {
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, boardCenterY + boardH / 2, 12), postMat);
  post.position.set(dx, (boardCenterY + boardH / 2) / 2, -0.2);
  pinboardGroup.add(post);
}

// Header label
const headerCanvas = document.createElement("canvas");
headerCanvas.width = 512;
headerCanvas.height = 96;
{
  const ctx = headerCanvas.getContext("2d")!;
  ctx.fillStyle = "rgba(0,0,0,0)";
  ctx.fillRect(0, 0, 512, 96);
  ctx.font = "bold 56px monospace";
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("PINBOARD", 256, 48);
}
const headerTex = new THREE.Texture(headerCanvas);
headerTex.needsUpdate = true;
const header = new THREE.Sprite(new THREE.SpriteMaterial({ map: headerTex, transparent: true }));
header.scale.set(4, 0.75, 1);
header.position.set(0, boardCenterY + boardH / 2 + 0.7, 0.2);
pinboardGroup.add(header);

interface RenderedPin {
  mesh: THREE.Mesh;
  pin: PinModel;
}
const renderedPins = new Map<string, RenderedPin>();

function makePinMesh(pin: PinModel): THREE.Mesh {
  const c = document.createElement("canvas");
  c.width = 320;
  c.height = 240;
  const ctx = c.getContext("2d")!;
  const baseHex = PIN_COLOR_HEX[pin.color];
  const r = (baseHex >> 16) & 0xff;
  const g = (baseHex >> 8) & 0xff;
  const b = baseHex & 0xff;
  // sticky background with subtle gradient
  const grad = ctx.createLinearGradient(0, 0, 0, 240);
  grad.addColorStop(0, `rgba(${r},${g},${b},1)`);
  grad.addColorStop(1, `rgba(${(r * 0.85) | 0},${(g * 0.85) | 0},${(b * 0.85) | 0},1)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 320, 240);
  // shadow strip at top (pin)
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.fillRect(0, 0, 320, 16);
  // text
  ctx.fillStyle = "#1a1a1a";
  ctx.font = "bold 22px ui-monospace, monospace";
  ctx.textBaseline = "top";
  // wrap
  const maxW = 290;
  const words = pin.text.split(/\s+/);
  let line = "";
  let y = 28;
  for (const word of words) {
    const test = line ? line + " " + word : word;
    if (ctx.measureText(test).width > maxW) {
      ctx.fillText(line, 16, y);
      y += 28;
      line = word;
      if (y > 210) {
        ctx.fillText(line.length > 30 ? line.slice(0, 30) + "…" : line, 16, y);
        line = "";
        break;
      }
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, 16, y);
  const tex = new THREE.Texture(c);
  tex.needsUpdate = true;
  const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(PIN_W, PIN_H), mat);
  mesh.userData.pinId = pin.id;
  return mesh;
}

function layoutPins() {
  // Arrange pins in a grid by createdAt asc → newest at the bottom-right
  const sorted = [...renderedPins.values()].sort(
    (a, b) => a.pin.createdAt - b.pin.createdAt,
  );
  const totalW = PIN_COLS * PIN_W + (PIN_COLS - 1) * PIN_GAP_X;
  const totalH = PIN_ROWS * PIN_H + (PIN_ROWS - 1) * PIN_GAP_Y;
  const startX = -totalW / 2 + PIN_W / 2;
  const startY = boardCenterY + totalH / 2 - PIN_H / 2;
  for (let i = 0; i < sorted.length; i++) {
    const col = i % PIN_COLS;
    const row = Math.floor(i / PIN_COLS);
    if (row >= PIN_ROWS) {
      sorted[i].mesh.visible = false;
      continue;
    }
    sorted[i].mesh.visible = true;
    sorted[i].mesh.position.set(
      startX + col * (PIN_W + PIN_GAP_X),
      startY - row * (PIN_H + PIN_GAP_Y),
      0.12,
    );
  }
}

function addPin(pin: PinModel) {
  const mesh = makePinMesh(pin);
  pinboardGroup.add(mesh);
  renderedPins.set(pin.id, { mesh, pin });
  layoutPins();
}

function removePin(id: string) {
  const r = renderedPins.get(id);
  if (!r) return;
  pinboardGroup.remove(r.mesh);
  (r.mesh.material as THREE.Material).dispose();
  r.mesh.geometry.dispose();
  renderedPins.delete(id);
  layoutPins();
}

function clearPins() {
  for (const id of [...renderedPins.keys()]) removePin(id);
}

// ---- Humanoid agent ----
function makeNameSprite(text: string): THREE.Sprite {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 64;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
  ctx.fillRect(0, 0, 256, 64);
  ctx.font = "bold 32px monospace";
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 128, 32);
  const tex = new THREE.Texture(c);
  tex.needsUpdate = true;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex }));
  s.scale.set(3, 0.75, 1);
  return s;
}

type AgentState = "wandering" | "working" | "moving";

interface Agent {
  group: THREE.Group;
  center: THREE.Vector3;
  desk: THREE.Vector3;
  state: AgentState;
  target: THREE.Vector3 | null;
  radius: number;
  speed: number;
  phase: number;
  name: string;
  role: string;
  color: number;
  leftArm: THREE.Mesh;
  rightArm: THREE.Mesh;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  pickables: THREE.Mesh[];
  statusSprite: THREE.Sprite;
  statusCanvas: HTMLCanvasElement;
  statusTexture: THREE.Texture;
  selectionRing: THREE.Mesh;
  bubble?: SayBubble;
  interactingUntil: number;
}

function makeAgent(name: string, role: string, color: number, center: THREE.Vector3): Agent {
  const group = new THREE.Group();
  const SKIN = 0x6fa84a; // goblin green
  const PANTS = 0x2a1a0e; // dark earth-brown breeches
  const shirtMat = new THREE.MeshLambertMaterial({ color });
  const skinMat = new THREE.MeshLambertMaterial({ color: SKIN });
  const pantsMat = new THREE.MeshLambertMaterial({ color: PANTS });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.4), shirtMat);
  torso.position.y = 1.45;
  group.add(torso);

  // --- Goblin head ---
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 12), skinMat);
  head.position.y = 2.18;
  head.rotation.x = 0.18; // hunched forward
  group.add(head);

  // Pointed ears (cones tilted outward + slightly back)
  const earGeo = new THREE.ConeGeometry(0.08, 0.32, 8);
  const leftEar = new THREE.Mesh(earGeo, skinMat);
  leftEar.position.set(-0.32, 2.28, -0.05);
  leftEar.rotation.z = Math.PI / 2.6;
  leftEar.rotation.y = -0.4;
  group.add(leftEar);
  const rightEar = new THREE.Mesh(earGeo, skinMat);
  rightEar.position.set(0.32, 2.28, -0.05);
  rightEar.rotation.z = -Math.PI / 2.6;
  rightEar.rotation.y = 0.4;
  group.add(rightEar);

  // Hooked nose (cone pointing forward)
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.26, 8), skinMat);
  nose.position.set(0, 2.13, 0.3);
  nose.rotation.x = Math.PI / 2 + 0.25; // slightly downward, hooked
  group.add(nose);

  // Glowing yellow eyes
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffee44 });
  const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), eyeMat);
  leftEye.position.set(-0.13, 2.26, 0.27);
  group.add(leftEye);
  const rightEye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), eyeMat);
  rightEye.position.set(0.13, 2.26, 0.27);
  group.add(rightEye);

  // Lower fang (tiny white pyramid jutting up from the mouth area)
  const fangMat = new THREE.MeshLambertMaterial({ color: 0xfdf6e3 });
  const fang = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.1, 4), fangMat);
  fang.position.set(0.08, 1.96, 0.28);
  fang.rotation.x = Math.PI; // point downward but visible
  group.add(fang);

  // Arms — pivot at shoulder so we rotate around the top
  const armGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.8, 8);
  armGeo.translate(0, -0.4, 0);
  const leftArm = new THREE.Mesh(armGeo, shirtMat);
  leftArm.position.set(-0.45, 1.85, 0);
  group.add(leftArm);
  const rightArm = new THREE.Mesh(armGeo.clone(), shirtMat);
  rightArm.position.set(0.45, 1.85, 0);
  group.add(rightArm);

  // Legs — pivot at hip
  const legGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.9, 8);
  legGeo.translate(0, -0.45, 0);
  const leftLeg = new THREE.Mesh(legGeo, pantsMat);
  leftLeg.position.set(-0.2, 0.95, 0);
  group.add(leftLeg);
  const rightLeg = new THREE.Mesh(legGeo.clone(), pantsMat);
  rightLeg.position.set(0.2, 0.95, 0);
  group.add(rightLeg);

  const sprite = makeNameSprite(name);
  sprite.position.y = 3.0;
  group.add(sprite);

  // Selection ring under feet — hidden until selected
  const ringGeo = new THREE.RingGeometry(0.7, 0.95, 40);
  ringGeo.rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x00ffff,
    transparent: true,
    opacity: 0.7,
    side: THREE.DoubleSide,
  });
  const selectionRing = new THREE.Mesh(ringGeo, ringMat);
  selectionRing.position.y = 0.02;
  selectionRing.visible = false;
  group.add(selectionRing);

  const statusCanvas = document.createElement("canvas");
  statusCanvas.width = 256;
  statusCanvas.height = 64;
  const statusTexture = new THREE.Texture(statusCanvas);
  statusTexture.needsUpdate = true;
  const statusSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: statusTexture, transparent: true }),
  );
  statusSprite.scale.set(3, 0.75, 1);
  statusSprite.position.y = 3.7;
  statusSprite.visible = false;
  group.add(statusSprite);

  // Desk + monitor at the agent's center
  const deskMat = new THREE.MeshLambertMaterial({ color: 0x44485a });
  const desk = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.8, 0.8), deskMat);
  desk.position.set(center.x, 0.4, center.z);
  scene.add(desk);
  const monitor = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.55, 0.05),
    new THREE.MeshLambertMaterial({
      color: 0x111114,
      emissive: 0x224488,
      emissiveIntensity: 0.6,
    }),
  );
  monitor.position.set(center.x, 1.1, center.z + 0.32);
  scene.add(monitor);

  const pickables = [torso, head, leftArm, rightArm, leftLeg, rightLeg];
  const bubble = attachSayBubble(group, 3.55, 1.7);
  const agent: Agent = {
    group,
    center,
    desk: new THREE.Vector3(center.x, 0, center.z - 0.65),
    state: "wandering",
    target: null,
    radius: 1.5 + Math.random() * 1.2,
    speed: 0.4 + Math.random() * 0.3,
    phase: Math.random() * Math.PI * 2,
    name,
    role,
    color,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    pickables,
    statusSprite,
    statusCanvas,
    statusTexture,
    selectionRing,
    bubble,
    interactingUntil: 0,
  };
  for (const p of pickables) {
    (p as THREE.Mesh & { userData: { agent: Agent } }).userData = { agent };
  }
  scene.add(group);
  return agent;
}

const agents: Agent[] = [];
const allPickables: THREE.Mesh[] = [];
const COLOR_POOL = [0x4488ff, 0x44ff88, 0xff8844, 0xff44aa, 0xffdd44, 0xaa44ff, 0x44ffff, 0xff5588];

// Make every pet's body parts clickable (resolve back to Pet via userData.pet)
function registerPetClickable(p: Pet) {
  p.group.traverse((obj) => {
    const m = obj as THREE.Mesh & { userData: { pet?: Pet } };
    if (m.isMesh && m !== p.selectionRing) {
      m.userData = { ...(m.userData || {}), pet: p };
      allPickables.push(m);
    }
  });
}
for (const p of pets) registerPetClickable(p);

function findFreeSpot(): THREE.Vector3 {
  for (let i = 0; i < 60; i++) {
    const r = 4 + Math.random() * 10;
    const theta = Math.random() * Math.PI * 2;
    const x = Math.cos(theta) * r;
    const z = Math.sin(theta) * r;
    let ok = true;
    for (const a of agents) {
      if (Math.hypot(a.center.x - x, a.center.z - z) < 5) { ok = false; break; }
    }
    if (ok) return new THREE.Vector3(x, 0, z);
  }
  return new THREE.Vector3((Math.random() - 0.5) * 20, 0, (Math.random() - 0.5) * 20);
}

function spawnAgent(name: string, role: string, color: number, center: THREE.Vector3): Agent {
  const a = makeAgent(name, role, color, center);
  agents.push(a);
  for (const p of a.pickables) allPickables.push(p);
  return a;
}

spawnAgent("ARIA", "Researcher", 0x4488ff, new THREE.Vector3(-16, 0, -8));
spawnAgent("KAI", "Coder", 0x44ff88, new THREE.Vector3(14, 0, -14));
spawnAgent("RUNE", "Reviewer", 0xff8844, new THREE.Vector3(-12, 0, 14));
spawnAgent("LYNX", "Planner", 0xff44aa, new THREE.Vector3(18, 0, 10));
spawnAgent("ECHO", "Tester", 0xffdd44, new THREE.Vector3(0, 0, 2));

// ---- HTML overlay UI ----
const style = document.createElement("style");
style.textContent = `
  .ui-panel { position: fixed; background: rgba(10,12,20,0.85); color: #fff; font-family: ui-monospace, monospace; border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; backdrop-filter: blur(4px); }
  #infoPanel { top: 14px; left: 14px; padding: 12px 16px; min-width: 200px; display: none; }
  #infoPanel h3 { margin: 0 0 4px 0; font-size: 16px; letter-spacing: 1px; }
  #infoPanel .role { color: #88aaff; font-size: 12px; margin-bottom: 8px; }
  #infoPanel .status { color: #66dd99; font-size: 12px; }
  #chatBox { bottom: 14px; left: 50%; transform: translateX(-50%); width: 720px; max-width: 90vw; padding: 10px; display: flex; gap: 8px; }
  #chatBox input { flex: 1; padding: 10px 12px; background: #1a1d28; color: #fff; border: 1px solid rgba(255,255,255,0.15); border-radius: 4px; font-family: inherit; font-size: 14px; outline: none; }
  #chatBox input:focus { border-color: #88aaff; }
  #chatBox button { padding: 10px 18px; background: #4466aa; color: #fff; border: 0; border-radius: 4px; font-family: inherit; font-weight: bold; letter-spacing: 1px; cursor: pointer; }
  #chatBox button:hover { background: #5577bb; }
  #chatLog { bottom: 80px; left: 50%; transform: translateX(-50%); width: 720px; max-width: 90vw; max-height: 280px; overflow-y: auto; padding: 12px; font-size: 13px; line-height: 1.55; display: none; }
  #chatLog .msg { margin-bottom: 6px; }
  #chatLog .from-user { color: #cce; }
  #chatLog .from-agent { color: #aef; }
  #chatLog .agent-name { color: #88ddff; font-weight: bold; }
  #help { top: 14px; right: 14px; padding: 8px 12px; font-size: 12px; color: #aac; display: flex; gap: 12px; align-items: center; }
  #help .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #888; }
  #help.connected .dot { background: #66dd99; box-shadow: 0 0 6px #66dd99; }
  #help.error .dot { background: #ff5566; }
  #help select { background: #1a1d28; color: #fff; border: 1px solid rgba(255,255,255,0.15); border-radius: 4px; padding: 4px 8px; font-family: inherit; font-size: 12px; }
`;
document.head.appendChild(style);

const help = document.createElement("div");
help.id = "help";
help.className = "ui-panel";
help.innerHTML = `<span class="dot"></span><span id="connStatus">connecting…</span><select id="projectPicker"><option value="">— project —</option></select><select id="sessionPicker"><option value="">new conversation</option></select><button id="addAgentBtn" style="background:#2a2d3a;color:#fff;border:1px solid rgba(255,255,255,0.2);border-radius:4px;padding:4px 10px;font-family:inherit;font-size:12px;cursor:pointer">+ AGENT</button>`;
document.body.appendChild(help);

const infoPanel = document.createElement("div");
infoPanel.id = "infoPanel";
infoPanel.className = "ui-panel";
document.body.appendChild(infoPanel);

const chatLog = document.createElement("div");
chatLog.id = "chatLog";
chatLog.className = "ui-panel";
document.body.appendChild(chatLog);

const chatBox = document.createElement("div");
chatBox.id = "chatBox";
chatBox.className = "ui-panel";
chatBox.innerHTML = `<input id="chatInput" placeholder="select an agent first… or type /pin &lt;note&gt;" /><button id="chatSend">SEND</button>`;
document.body.appendChild(chatBox);

const chatInput = document.getElementById("chatInput") as HTMLInputElement;
const chatSend = document.getElementById("chatSend") as HTMLButtonElement;

let selected: Agent | null = null;
let selectedPet: Pet | null = null;
let driveMode = false;

function petTypeLabel(p: Pet): string {
  return p.type === "cat" ? "Cat" : p.type === "dog" ? "Dog" : "Drone";
}

function selectPet(p: Pet | null) {
  // Clearing pet → also clear from rings
  if (p === null) {
    if (selectedPet) selectedPet.selectionRing.visible = false;
    selectedPet = null;
    if (!selected) {
      infoPanel.style.display = "none";
      if (driveMode) setDriveMode(false);
      chatInput.placeholder = "select an agent to chat… or /pin <note>";
      updateHelpHint();
    }
    return;
  }
  // Clear any agent selection
  if (selected) {
    selected.selectionRing.visible = false;
    selected = null;
  }
  selectedPet = p;
  // Show info panel
  infoPanel.style.display = "block";
  const colorHex = p.color.toString(16).padStart(6, "0");
  const driveBtn = `<button id="driveBtn" style="margin-top:8px;background:${driveMode ? "#553a14" : "#2a3344"};color:#fff;border:1px solid rgba(255,255,255,0.2);border-radius:4px;padding:4px 10px;font-family:inherit;font-size:11px;cursor:pointer">${driveMode ? "stop driving" : "drive (M)"}</button>`;
  infoPanel.innerHTML = `<h3 style="color:#${colorHex}">${p.name}</h3><div class="role">${petTypeLabel(p)}</div><div class="status">● ${driveMode ? "driving" : "wandering"}</div>${driveBtn}`;
  const db = document.getElementById("driveBtn");
  if (db) db.addEventListener("click", () => setDriveMode(!driveMode));
  // Show ring with current mode color
  refreshSelectionRings();
  chatInput.placeholder = driveMode ? `(driving ${p.name})` : `talk to ${p.name}…`;
  if (!driveMode) chatInput.focus();
  updateHelpHint();
}

const RING_CHAT_COLOR = 0x00ffff;
const RING_DRIVE_COLOR = 0xffaa00;
const helpHint = document.createElement("span");
helpHint.style.cssText = "opacity:0.55;font-size:11px";
const helpHintParent = help;

function updateHelpHint() {
  const drivingName = selected?.name ?? selectedPet?.name ?? "";
  helpHint.textContent = driveMode
    ? `DRIVING ${drivingName} · WASD/arrows · ESC to exit`
    : "click to select · M to drive";
  if (helpHint.parentElement !== helpHintParent) helpHintParent.appendChild(helpHint);
}

function refreshSelectionRings() {
  for (const a of agents) {
    if (a === selected) {
      a.selectionRing.visible = true;
      (a.selectionRing.material as THREE.MeshBasicMaterial).color.setHex(
        driveMode ? RING_DRIVE_COLOR : RING_CHAT_COLOR,
      );
    } else {
      a.selectionRing.visible = false;
    }
  }
  for (const p of pets) {
    if (p === selectedPet) {
      p.selectionRing.visible = true;
      (p.selectionRing.material as THREE.MeshBasicMaterial).color.setHex(
        driveMode ? RING_DRIVE_COLOR : RING_CHAT_COLOR,
      );
    } else {
      p.selectionRing.visible = false;
    }
  }
}

function setDriveMode(on: boolean) {
  if (!selected && !selectedPet && on) return;
  driveMode = on;
  if (on) {
    chatInput.blur();
    if (selected) setStatus(selected, "DRIVING", "tool");
  } else {
    if (selected) setStatus(selected, null);
    chatInput.focus();
  }
  refreshSelectionRings();
  updateHelpHint();
  if (selected) selectAgent(selected); // refresh info panel
  if (selectedPet) selectPet(selectedPet);
}

function selectAgent(a: Agent | null) {
  // Clear pet selection if switching to an agent
  if (a && selectedPet) {
    selectedPet.selectionRing.visible = false;
    selectedPet = null;
  }
  selected = a;
  if (!a) {
    infoPanel.style.display = "none";
    chatInput.disabled = false;
    chatSend.disabled = false;
    chatInput.placeholder = "select an agent to chat… or /pin <note>";
    if (driveMode) setDriveMode(false);
    refreshSelectionRings();
    updateHelpHint();
    return;
  }
  infoPanel.style.display = "block";
  const stateLabel = a.state === "working" ? "● working" : driveMode ? "● driving" : "● idle";
  const releaseBtn = a.state === "working"
    ? `<button id="releaseBtn" style="margin-top:8px;background:#553344;color:#fff;border:1px solid rgba(255,255,255,0.2);border-radius:4px;padding:4px 10px;font-family:inherit;font-size:11px;cursor:pointer">force release</button>`
    : "";
  const driveBtn = a.state === "working"
    ? ""
    : `<button id="driveBtn" style="margin-top:8px;background:${driveMode ? "#553a14" : "#2a3344"};color:#fff;border:1px solid rgba(255,255,255,0.2);border-radius:4px;padding:4px 10px;font-family:inherit;font-size:11px;cursor:pointer;margin-left:6px">${driveMode ? "stop driving" : "drive (M)"}</button>`;
  infoPanel.innerHTML = `<h3 style="color:#${a.color.toString(16).padStart(6, "0")}">${a.name}</h3><div class="role">${a.role}</div><div class="status">${stateLabel}</div>${releaseBtn}${driveBtn}`;
  const rb = document.getElementById("releaseBtn");
  if (rb) rb.addEventListener("click", () => { releaseAgent(a, true); selectAgent(a); });
  const db = document.getElementById("driveBtn");
  if (db) db.addEventListener("click", () => setDriveMode(!driveMode));
  chatInput.disabled = false;
  chatSend.disabled = false;
  chatInput.placeholder = driveMode ? `(driving ${a.name})` : `talk to ${a.name}…`;
  if (!driveMode) chatInput.focus();
  refreshSelectionRings();
  updateHelpHint();
}

function appendMessage(from: string, text: string, isAgent: boolean, agentColor?: number) {
  chatLog.style.display = "block";
  const div = document.createElement("div");
  div.className = "msg " + (isAgent ? "from-agent" : "from-user");
  if (isAgent) {
    const colorHex = "#" + (agentColor ?? 0x88ddff).toString(16).padStart(6, "0");
    div.innerHTML = `<span class="agent-name" style="color:${colorHex}">${from}:</span> ${text}`;
  } else {
    div.innerHTML = `<span style="color:#bbb">you:</span> ${text}`;
  }
  chatLog.appendChild(div);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function fakeReply(a: Agent, prompt: string): string {
  const replies = [
    `acknowledged. spinning up on "${prompt}"…`,
    `i'll handle that. give me a sec.`,
    `looking into it now.`,
    `on it. checking the relevant files.`,
    `working on "${prompt.slice(0, 24)}…"`,
  ];
  return replies[Math.floor(Math.random() * replies.length)];
}

// ---- Bridge WebSocket ----
const connStatus = document.getElementById("connStatus") as HTMLSpanElement;
const projectPicker = document.getElementById("projectPicker") as HTMLSelectElement;
const sessionPicker = document.getElementById("sessionPicker") as HTMLSelectElement;
type ProjectInfo = { id: string; name: string; path: string };
type SessionInfo = { id: string; projectId: string; currentPrompt?: string; startedAt: number; lastActivityAt: number };
let allProjects: ProjectInfo[] = [];
let allSessions: SessionInfo[] = [];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function refreshSessionPicker() {
  const projectPath = projectPicker.value;
  const project = allProjects.find((p) => p.path === projectPath);
  sessionPicker.innerHTML = `<option value="">new conversation</option>`;
  if (!project) return;
  const sessions = allSessions
    .filter((s) => s.projectId === project.id && UUID_RE.test(s.id))
    .sort((a, b) => b.lastActivityAt - a.lastActivityAt)
    .slice(0, 30);
  for (const s of sessions) {
    const label = (s.currentPrompt || "(no prompt)").replace(/\s+/g, " ").slice(0, 50);
    const opt = document.createElement("option");
    opt.value = s.id;
    opt.textContent = `${s.id.slice(0, 6)} · ${label}`;
    sessionPicker.appendChild(opt);
  }
}
projectPicker.addEventListener("change", refreshSessionPicker);

let ws: WebSocket | null = null;
let bridgeConnected = false;
let pendingPromptAgent: Agent | null = null; // waiting for the next session:start to claim
const sessionToAgent = new Map<string, Agent>();

function setConnStatus(label: string, cls: "" | "connected" | "error") {
  connStatus.textContent = label;
  help.classList.remove("connected", "error");
  if (cls) help.classList.add(cls);
}

function connectBridge() {
  setConnStatus("connecting…", "");
  ws = new WebSocket("ws://localhost:3778");
  ws.onopen = () => {
    bridgeConnected = true;
    setConnStatus("connected", "connected");
    ws!.send(JSON.stringify({ type: "subscribe" }));
  };
  ws.onclose = () => {
    bridgeConnected = false;
    setConnStatus("disconnected", "error");
    setTimeout(connectBridge, 2000);
  };
  ws.onerror = () => {
    setConnStatus("error", "error");
  };
  ws.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data);
      handleBridgeEvent(msg);
    } catch {
      // ignore
    }
  };
}

function pulseAgent(a: Agent) {
  const torsoMesh = a.pickables[0];
  const mat = torsoMesh.material as THREE.MeshLambertMaterial;
  const orig = mat.color.getHex();
  mat.color.setHex(0xffffff);
  setTimeout(() => mat.color.setHex(orig), 250);
}

function releaseAgent(a: Agent, sendCancel = false) {
  if (sendCancel && bridgeConnected && ws) {
    for (const [sid, mapped] of sessionToAgent) {
      if (mapped === a) {
        ws.send(JSON.stringify({ type: "session:cancel", payload: { sessionId: sid } }));
      }
    }
  }
  a.state = "wandering";
  setStatus(a, null);
  for (const [sid, mapped] of sessionToAgent) {
    if (mapped === a) sessionToAgent.delete(sid);
  }
}

function handleBridgeEvent(event: { type: string; payload: Record<string, unknown> }) {
  if (event.type !== "state:full_sync") {
    console.log("[bridge]", event.type, event.payload);
  }
  switch (event.type) {
    case "state:full_sync": {
      allProjects = (event.payload.projects as ProjectInfo[]) || [];
      allSessions = (event.payload.sessions as SessionInfo[]) || [];
      projectPicker.innerHTML = `<option value="">— project —</option>` +
        allProjects.map((p) => `<option value="${p.path}">${p.name}</option>`).join("");
      refreshSessionPicker();
      // Pinboard refresh
      clearPins();
      const incomingPins = (event.payload.pins as PinModel[]) || [];
      for (const p of incomingPins) addPin(p);
      // Mailbox refresh
      allMail = (event.payload.mail as MailModel[]) || [];
      refreshFlag();
      refreshMailPanel();
      break;
    }
    case "pin:added": {
      addPin(event.payload as unknown as PinModel);
      break;
    }
    case "pin:removed": {
      removePin((event.payload as { id: string }).id);
      break;
    }
    case "mail:added": {
      const m = event.payload as unknown as MailModel;
      allMail.push(m);
      refreshFlag();
      refreshMailPanel();
      break;
    }
    case "mail:read_all": {
      for (const m of allMail) m.read = true;
      refreshFlag();
      refreshMailPanel();
      break;
    }
    case "session:start": {
      const sid = event.payload.sessionId as string;
      if (pendingPromptAgent && sid) {
        sessionToAgent.set(sid, pendingPromptAgent);
        pendingPromptAgent = null;
      }
      break;
    }
    case "session:tool_pre": {
      const sid = event.payload.sessionId as string;
      const tool = event.payload.toolName as string;
      const agent = sessionToAgent.get(sid);
      if (agent) {
        pulseAgent(agent);
        if (tool) setStatus(agent, tool, "tool");
      }
      break;
    }
    case "session:stop": {
      const sid = event.payload.sessionId as string;
      const last = event.payload.lastMessage as string | undefined;
      const agent = sessionToAgent.get(sid);
      if (!agent) break;
      // Server emits TWO stops per run: an empty one from the hook server,
      // then a real one from proc.on("close") with lastMessage. Only release
      // the agent when we have the actual reply — otherwise the empty first
      // stop wipes the mapping before the reply arrives. For runs that
      // genuinely produce no message (cancelled, killed), use force release.
      if (last) {
        appendMessage(agent.name, last, true, agent.color);
        releaseAgent(agent);
      }
      break;
    }
  }
}

function setStatus(a: Agent, text: string | null, tone: "thinking" | "tool" | "done" = "tool") {
  if (!text) {
    a.statusSprite.visible = false;
    return;
  }
  const ctx = a.statusCanvas.getContext("2d")!;
  ctx.clearRect(0, 0, 256, 64);
  const bg = tone === "thinking" ? "rgba(40,40,80,0.85)" : tone === "done" ? "rgba(40,80,40,0.85)" : "rgba(20,40,80,0.85)";
  const fg = tone === "thinking" ? "#cdf" : tone === "done" ? "#aea" : "#aef";
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 256, 64);
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.strokeRect(1, 1, 254, 62);
  ctx.font = "bold 22px monospace";
  ctx.fillStyle = fg;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text.slice(0, 18), 128, 32);
  a.statusTexture.needsUpdate = true;
  a.statusSprite.visible = true;
}

connectBridge();

// ---- Add Agent button ----
document.getElementById("addAgentBtn")!.addEventListener("click", () => {
  const name = (prompt("Agent name?", "NEW") || "").toUpperCase().slice(0, 12).trim();
  if (!name) return;
  const role = (prompt("Role?", "Helper") || "Helper").slice(0, 24);
  const color = COLOR_POOL[agents.length % COLOR_POOL.length];
  const center = findFreeSpot();
  const a = spawnAgent(name, role, color, center);
  selectAgent(a);
});

function send() {
  if (!chatInput.value.trim()) return;
  const text = chatInput.value.trim();

  // Slash command: /pin <text> — add a pin without going to claude
  if (text.toLowerCase().startsWith("/pin ")) {
    const pinText = text.slice(5).trim();
    if (pinText && bridgeConnected && ws) {
      ws.send(JSON.stringify({ type: "pin:add", payload: { text: pinText } }));
      chatInput.value = "";
    }
    return;
  }

  // Slash command: /mail <text> — drop a note in the mailbox
  if (text.toLowerCase().startsWith("/mail ")) {
    const mailText = text.slice(6).trim();
    if (mailText && bridgeConnected && ws) {
      ws.send(JSON.stringify({ type: "mail:send", payload: { text: mailText } }));
      chatInput.value = "";
    }
    return;
  }

  // Talking to a pet → local canned reply, no bridge
  if (selectedPet) {
    appendMessage("you", text, false);
    chatInput.value = "";
    const p = selectedPet;
    setTimeout(() => {
      const r = p.reply();
      appendMessage(p.name, r, true, p.color);
      p.bubble.say(r.length > 14 ? r.slice(0, 13) + "…" : r, 2200);
    }, 200 + Math.random() * 500);
    return;
  }

  if (!selected) return;
  appendMessage("you", text, false);
  chatInput.value = "";
  const a = selected;
  const projectPath = projectPicker.value;
  if (bridgeConnected && projectPath) {
    pendingPromptAgent = a;
    a.state = "working";
    setStatus(a, "thinking…", "thinking");
    const sessionId = sessionPicker.value || undefined;
    ws!.send(
      JSON.stringify({
        type: "prompt:send",
        payload: { projectPath, prompt: text, sessionId },
      }),
    );
  } else if (bridgeConnected && !projectPath) {
    appendMessage(a.name, "(pick a project in the top-right first)", true, a.color);
  } else {
    appendMessage(a.name, "(bridge not connected — start `npm run bridge`)", true, a.color);
  }
}

chatSend.addEventListener("click", send);
chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") send();
});

// ---- Click handling: raycaster picks agents ----
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
renderer.domElement.addEventListener("click", (e) => {
  if ((e.target as HTMLElement).closest(".ui-panel")) return;
  if (dragMoved) return;
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  // Pin click → delete
  const pinMeshes = [...renderedPins.values()].map((r) => r.mesh);
  const pinHits = raycaster.intersectObjects(pinMeshes);
  if (pinHits.length > 0) {
    const id = pinHits[0].object.userData.pinId as string | undefined;
    if (id && bridgeConnected && ws) {
      ws.send(JSON.stringify({ type: "pin:remove", payload: { id } }));
    }
    return;
  }

  // Mailbox click → open panel + mark read
  const mailHits = raycaster.intersectObject(boxBody, true);
  if (mailHits.length > 0) {
    if (mailPanel.style.display === "block") closeMailPanel();
    else openMailPanel();
    return;
  }
  const hits = raycaster.intersectObjects(allPickables);
  if (hits.length > 0) {
    const ud = hits[0].object.userData as { agent?: Agent; pet?: Pet };
    if (ud.agent) selectAgent(ud.agent);
    else if (ud.pet) selectPet(ud.pet);
  } else {
    selectAgent(null);
    selectPet(null);
  }
});

// ---- Keyboard movement of selected agent ----
const heldKeys = new Set<string>();
const isMoveKey = (k: string) =>
  k === "ArrowUp" || k === "ArrowDown" || k === "ArrowLeft" || k === "ArrowRight" ||
  k === "w" || k === "W" || k === "a" || k === "A" || k === "s" || k === "S" || k === "d" || k === "D";

window.addEventListener("keydown", (e) => {
  // Toggle drive mode with M (when an agent is selected)
  if ((e.key === "m" || e.key === "M") && selected && !(e.target instanceof HTMLInputElement)) {
    setDriveMode(!driveMode);
    e.preventDefault();
    return;
  }
  // Exit drive mode with ESC
  if (e.key === "Escape" && driveMode) {
    setDriveMode(false);
    e.preventDefault();
    return;
  }
  // Movement keys: only active in drive mode
  if (!driveMode) return;
  if (isMoveKey(e.key)) {
    heldKeys.add(e.key);
    e.preventDefault();
  }
});
window.addEventListener("keyup", (e) => {
  if (isMoveKey(e.key)) heldKeys.delete(e.key);
});
window.addEventListener("blur", () => heldKeys.clear());

// ---- Animate (walking + camera follow on selection) ----
const clock = new THREE.Clock();

// Returns either the agent we manually moved (so the regular wander loop skips it)
// or null. For pets we just move them without skipping anything (their update has its own pause).
function manualMoveSelected(t: number): Agent | null {
  if (!driveMode) return null;
  // Compute direction once
  if (heldKeys.size === 0) return null;
  const fwd = new THREE.Vector3();
  camera.getWorldDirection(fwd);
  fwd.y = 0;
  if (fwd.lengthSq() === 0) return null;
  fwd.normalize();
  const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
  const dir = new THREE.Vector3();
  if (heldKeys.has("ArrowUp") || heldKeys.has("w") || heldKeys.has("W")) dir.add(fwd);
  if (heldKeys.has("ArrowDown") || heldKeys.has("s") || heldKeys.has("S")) dir.sub(fwd);
  if (heldKeys.has("ArrowRight") || heldKeys.has("d") || heldKeys.has("D")) dir.add(right);
  if (heldKeys.has("ArrowLeft") || heldKeys.has("a") || heldKeys.has("A")) dir.sub(right);
  if (dir.lengthSq() === 0) return null;
  dir.normalize();

  // Drive a pet, if one is selected
  if (selectedPet) {
    const p = selectedPet;
    const speed = p.type === "drone" ? 0.18 : 0.12;
    p.group.position.x += dir.x * speed;
    p.group.position.z += dir.z * speed;
    p.group.rotation.y = Math.atan2(dir.x, dir.z);
    p.target.set(p.group.position.x, p.hoverY, p.group.position.z); // freeze AI target at our spot
    p.pauseUntil = performance.now() + 200; // briefly suppress ambient movement
    return null; // not an agent
  }

  if (!selected || selected.state === "working") return null;
  const speed = 0.14;
  selected.group.position.x += dir.x * speed;
  selected.group.position.z += dir.z * speed;
  selected.group.rotation.y = Math.atan2(dir.x, dir.z);
  selected.center.copy(selected.group.position); // wander resumes from here when keys release
  const swing = Math.sin(t * 12) * 0.7;
  selected.leftLeg.rotation.x = swing;
  selected.rightLeg.rotation.x = -swing;
  selected.leftArm.rotation.x = -swing * 0.8;
  selected.rightArm.rotation.x = swing * 0.8;
  return selected;
}

// ---- Proximity interactions ----
type ActorType = "agent" | "cat" | "dog" | "drone";
type SocialActor = {
  type: ActorType;
  group: THREE.Group;
  bubble: SayBubble;
  isBusy: () => boolean;
  setBusy: (until: number) => void;
};

function pickRand<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function linesFor(typeA: ActorType, typeB: ActorType): [string, string] {
  const key = `${typeA}+${typeB}`;
  switch (key) {
    case "cat+cat": return [pickRand(["meow", "purr", "*sniff*", "..."]), pickRand(["meow", "purr", "*nuzzle*"])];
    case "dog+dog": return [pickRand(["woof!", "*tail wag*", "🦴"]), pickRand(["woof!", "*play*", "ruff!"])];
    case "drone+drone": return ["beep", "boop"];
    case "agent+agent": return [pickRand(["hey", "yo", "wassup", "*nods*"]), pickRand(["hey", "yo", "*nods*"])];
    case "cat+dog": return [pickRand(["hiss!", "*scram*", "..."]), pickRand(["woof!", "*tail wag*", "🐾"])];
    case "dog+cat": return [pickRand(["woof!", "*tail wag*", "🐾"]), pickRand(["hiss!", "*scram*", "..."])];
    case "agent+cat": return [pickRand(["hey kitty", "good kitty", "*pets*"]), pickRand(["purr", "🐾", "meow"])];
    case "cat+agent": return [pickRand(["purr", "🐾", "meow"]), pickRand(["hey kitty", "good kitty", "*pets*"])];
    case "agent+dog": return [pickRand(["who's a good boy", "hi buddy", "*scratches ears*"]), pickRand(["*tail wag*", "woof!", "*pant*"])];
    case "dog+agent": return [pickRand(["*tail wag*", "woof!", "*pant*"]), pickRand(["who's a good boy", "hi buddy", "*scratches ears*"])];
    case "agent+drone": return [pickRand(["sup", "hello drone", "..."]), pickRand(["beep", "scanning", "0xFF"])];
    case "drone+agent": return [pickRand(["beep", "scanning", "0xFF"]), pickRand(["sup", "hello drone", "..."])];
    case "cat+drone": return [pickRand(["...", "*stares*", "*twitches*"]), pickRand(["beep?", "scan", "..."])];
    case "drone+cat": return [pickRand(["beep?", "scan", "..."]), pickRand(["...", "*stares*", "*twitches*"])];
    case "dog+drone": return [pickRand(["woof!", "*tilts head*"]), pickRand(["beep", "halt"])];
    case "drone+dog": return [pickRand(["beep", "halt"]), pickRand(["woof!", "*tilts head*"])];
    default: return ["*nods*", "*nods*"];
  }
}

let lastSocialScanAt = 0;
function scanSocialInteractions(nowMs: number) {
  if (nowMs - lastSocialScanAt < 200) return;
  lastSocialScanAt = nowMs;
  const actors: SocialActor[] = [];
  for (const a of agents) actors.push({
    type: "agent",
    group: a.group,
    bubble: a.bubble!,
    isBusy: () => a.state === "working" || a.interactingUntil > performance.now(),
    setBusy: (until) => { a.interactingUntil = until; },
  });
  for (const p of pets) actors.push({
    type: p.type,
    group: p.group,
    bubble: p.bubble,
    isBusy: () => p.interactingUntil > performance.now(),
    setBusy: (until) => { p.interactingUntil = until; },
  });

  const TRIGGER_DIST = 2.6;
  const COOLDOWN_MS = 7000;
  for (let i = 0; i < actors.length; i++) {
    if (actors[i].isBusy()) continue;
    for (let j = i + 1; j < actors.length; j++) {
      if (actors[j].isBusy()) continue;
      const dx = actors[i].group.position.x - actors[j].group.position.x;
      const dz = actors[i].group.position.z - actors[j].group.position.z;
      if (Math.hypot(dx, dz) > TRIGGER_DIST) continue;
      const [aLine, bLine] = linesFor(actors[i].type, actors[j].type);
      actors[i].bubble.say(aLine, 2200);
      actors[j].bubble.say(bLine, 2200);
      actors[i].setBusy(nowMs + COOLDOWN_MS);
      actors[j].setBusy(nowMs + COOLDOWN_MS);
      const yawA = Math.atan2(
        actors[j].group.position.x - actors[i].group.position.x,
        actors[j].group.position.z - actors[i].group.position.z,
      );
      actors[i].group.rotation.y = yawA;
      actors[j].group.rotation.y = yawA + Math.PI;
      break;
    }
  }
}

let lastFrameMs = performance.now();
function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();
  const nowMs = performance.now();
  const dt = Math.min(0.1, (nowMs - lastFrameMs) / 1000);
  lastFrameMs = nowMs;
  updateCars(dt);
  for (const p of pets) updatePet(p, t);
  scanSocialInteractions(nowMs);
  for (const a of agents) a.bubble?.update(nowMs);
  const manualAgent = manualMoveSelected(t);
  // Pulse drive-mode ring on whoever is selected
  const ringRef = selected?.selectionRing ?? selectedPet?.selectionRing ?? null;
  if (ringRef && driveMode) {
    const m = ringRef.material as THREE.MeshBasicMaterial;
    m.opacity = 0.4 + Math.abs(Math.sin(t * 4)) * 0.55;
    ringRef.scale.setScalar(1 + Math.sin(t * 4) * 0.06);
  } else if (ringRef) {
    const m = ringRef.material as THREE.MeshBasicMaterial;
    m.opacity = 0.7;
    ringRef.scale.setScalar(1);
  }
  for (const a of agents) {
    if (a === manualAgent) continue;
    if (a.interactingUntil > nowMs) continue;
    if (a.state === "wandering") {
      const angle = t * a.speed + a.phase;
      a.group.position.x = a.center.x + Math.cos(angle) * a.radius;
      a.group.position.z = a.center.z + Math.sin(angle) * a.radius;
      a.group.rotation.y = -angle + Math.PI / 2;
      const swing = Math.sin(t * a.speed * 6 + a.phase) * 0.6;
      a.leftLeg.rotation.x = swing;
      a.rightLeg.rotation.x = -swing;
      a.leftArm.rotation.x = -swing * 0.7;
      a.rightArm.rotation.x = swing * 0.7;
    } else if (a.state === "moving" && a.target) {
      const dx = a.target.x - a.group.position.x;
      const dz = a.target.z - a.group.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.4) {
        a.center = a.target.clone();
        a.target = null;
        a.state = "wandering";
        a.phase = Math.random() * Math.PI * 2;
        a.leftLeg.rotation.x = 0;
        a.rightLeg.rotation.x = 0;
        a.leftArm.rotation.x = 0;
        a.rightArm.rotation.x = 0;
      } else {
        const stepSpeed = 0.08;
        a.group.position.x += (dx / dist) * stepSpeed * Math.min(dist, 1);
        a.group.position.z += (dz / dist) * stepSpeed * Math.min(dist, 1);
        a.group.rotation.y = Math.atan2(dx, dz);
        const swing = Math.sin(t * 8) * 0.7;
        a.leftLeg.rotation.x = swing;
        a.rightLeg.rotation.x = -swing;
        a.leftArm.rotation.x = -swing * 0.8;
        a.rightArm.rotation.x = swing * 0.8;
      }
    } else {
      // working: ease toward desk-stand position, face the desk (+z), type
      a.group.position.x += (a.desk.x - a.group.position.x) * 0.08;
      a.group.position.z += (a.desk.z - a.group.position.z) * 0.08;
      a.group.rotation.y = 0;
      a.leftLeg.rotation.x = 0;
      a.rightLeg.rotation.x = 0;
      const tap = Math.sin(t * 9 + a.phase) * 0.22;
      a.leftArm.rotation.x = -0.7 + tap;
      a.rightArm.rotation.x = -0.7 - tap;
    }
  }
  renderer.render(scene, camera);
}
animate();

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
