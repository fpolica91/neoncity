// NeonCity color palette
export const COLORS = {
  background: { r: 0.02, g: 0.02, b: 0.05 },
  fog: { r: 0.05, g: 0.02, b: 0.1 },

  neon: {
    cyan: { r: 0, g: 1, b: 0.8 },
    pink: { r: 1, g: 0.05, b: 0.5 },
    blue: { r: 0.2, g: 0.5, b: 1 },
    yellow: { r: 1, g: 0.9, b: 0.2 },
    orange: { r: 1, g: 0.5, b: 0.1 },
    purple: { r: 0.7, g: 0.2, b: 1 },
    green: { r: 0.2, g: 1, b: 0.4 },
    red: { r: 1, g: 0.15, b: 0.15 },
  },

  building: {
    base: { r: 0.08, g: 0.08, b: 0.12 },
    window: { r: 0.15, g: 0.2, b: 0.35 },
    windowLit: { r: 0.4, g: 0.8, b: 1 },
    construction: { r: 0, g: 0.8, b: 0.6 },
    completed: { r: 0.12, g: 0.12, b: 0.18 },
  },

  ground: { r: 0.04, g: 0.04, b: 0.06 },
  streetLine: { r: 0, g: 0.4, b: 0.35 },
} as const;

// City grid configuration
export const GRID = {
  blockSize: 8,
  streetWidth: 3,
  buildingFootprint: 6,
  maxPerRow: 6,
} as const;

// Animation durations (ms)
export const ANIM = {
  floorBuild: 1500,
  floorLockIn: 600,
  buildingPulse: 800,
  cameraFocus: 800,
  avatarSpawn: 400,
  avatarMove: 1200,
  avatarDissolve: 500,
} as const;

// Placeholder projects for Phase 1
export const DEMO_PROJECTS = [
  { name: "chidori", tasks: 7, health: "healthy" as const },
  { name: "onyx", tasks: 4, health: "healthy" as const },
  { name: "linkforge", tasks: 12, health: "warning" as const },
  { name: "fieldhub", tasks: 3, health: "healthy" as const },
  { name: "neoncity", tasks: 6, health: "healthy" as const },
  { name: "payments", tasks: 2, health: "error" as const },
  { name: "auth-svc", tasks: 5, health: "idle" as const },
  { name: "infra", tasks: 8, health: "healthy" as const },
] as const;

// Ports
export const BRIDGE_HTTP_PORT = 3777;
export const BRIDGE_WS_PORT = 3778;
