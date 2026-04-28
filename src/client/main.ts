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
let camRadius = 28;
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
  new THREE.PlaneGeometry(80, 80),
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

spawnAgent("ARIA", "Researcher", 0x4488ff, new THREE.Vector3(-8, 0, -4));
spawnAgent("KAI", "Coder", 0x44ff88, new THREE.Vector3(6, 0, -6));
spawnAgent("RUNE", "Reviewer", 0xff8844, new THREE.Vector3(-4, 0, 6));
spawnAgent("LYNX", "Planner", 0xff44aa, new THREE.Vector3(8, 0, 4));
spawnAgent("ECHO", "Tester", 0xffdd44, new THREE.Vector3(0, 0, 0));

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
chatBox.innerHTML = `<input id="chatInput" placeholder="select an agent first…" disabled /><button id="chatSend" disabled>SEND</button>`;
document.body.appendChild(chatBox);

const chatInput = document.getElementById("chatInput") as HTMLInputElement;
const chatSend = document.getElementById("chatSend") as HTMLButtonElement;

let selected: Agent | null = null;
let driveMode = false;

const RING_CHAT_COLOR = 0x00ffff;
const RING_DRIVE_COLOR = 0xffaa00;
const helpHint = document.createElement("span");
helpHint.style.cssText = "opacity:0.55;font-size:11px";
const helpHintParent = help;

function updateHelpHint() {
  helpHint.textContent = driveMode
    ? `DRIVING ${selected?.name ?? ""} · WASD/arrows · ESC to exit`
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
}

function setDriveMode(on: boolean) {
  if (!selected && on) return;
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
}

function selectAgent(a: Agent | null) {
  selected = a;
  if (!a) {
    infoPanel.style.display = "none";
    chatInput.disabled = true;
    chatSend.disabled = true;
    chatInput.placeholder = "select an agent first…";
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
  if (!selected || !chatInput.value.trim()) return;
  const text = chatInput.value.trim();
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
  const hits = raycaster.intersectObjects(allPickables);
  if (hits.length > 0) {
    selectAgent(hits[0].object.userData.agent);
  } else {
    selectAgent(null);
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

function manualMoveSelected(t: number): Agent | null {
  if (!selected || !driveMode || selected.state === "working") return null;
  if (heldKeys.size === 0) return null;
  // Camera-relative directions, projected to ground plane
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

function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();
  const manualAgent = manualMoveSelected(t);
  // Pulse drive-mode ring on the selected agent
  if (selected && driveMode) {
    const m = selected.selectionRing.material as THREE.MeshBasicMaterial;
    m.opacity = 0.4 + Math.abs(Math.sin(t * 4)) * 0.55;
    selected.selectionRing.scale.setScalar(1 + Math.sin(t * 4) * 0.06);
  } else if (selected) {
    const m = selected.selectionRing.material as THREE.MeshBasicMaterial;
    m.opacity = 0.7;
    selected.selectionRing.scale.setScalar(1);
  }
  for (const a of agents) {
    if (a === manualAgent) continue;
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
