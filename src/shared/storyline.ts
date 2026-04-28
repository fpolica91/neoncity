/**
 * NeonCity storyline engine.
 * Frames coding tasks as cyberpunk missions with progression arcs,
 * mission chains, factions, and escalating narrative.
 */

export interface Mission {
  id: string;
  title: string;
  briefing: string;
  objectives: MissionObjective[];
  reward: string;
  difficulty: "routine" | "complex" | "critical";
  status: "available" | "active" | "completed" | "failed";
  assignedTo?: string;
  chainId?: string;
  chainPosition?: number;
  faction?: FactionId;
  intel?: string;
}

export interface MissionObjective {
  id: string;
  description: string;
  completed: boolean;
}

// --- Factions ---

export type FactionId = "netrunners" | "constructors" | "overseers" | "phantoms";

export interface Faction {
  id: FactionId;
  name: string;
  tag: string;
  color: string;
  description: string;
}

export const FACTIONS: Record<FactionId, Faction> = {
  netrunners: {
    id: "netrunners",
    name: "NETRUNNERS",
    tag: "NR",
    color: "#00ffc8",
    description: "Digital infiltrators who specialize in debugging and tracing code anomalies.",
  },
  constructors: {
    id: "constructors",
    name: "CONSTRUCTORS",
    tag: "CN",
    color: "#ffcc00",
    description: "Master builders who expand the city grid with new features and modules.",
  },
  overseers: {
    id: "overseers",
    name: "OVERSEERS",
    tag: "OV",
    color: "#ff4466",
    description: "System architects who restructure and optimize the city's foundations.",
  },
  phantoms: {
    id: "phantoms",
    name: "PHANTOMS",
    tag: "PH",
    color: "#aa44ff",
    description: "Shadow operatives who explore unknown sectors and gather intelligence.",
  },
};

// --- Mission templates by category ---

const MISSION_TEMPLATES: Record<string, { titles: string[]; briefings: string[] }> = {
  bug: {
    titles: ["TRACE THE GLITCH", "DEBUG PROTOCOL", "PATCH THE BREACH", "HUNT THE GHOST", "NEUTRALIZE ANOMALY"],
    briefings: [
      "A malfunctioning subroutine was detected in the city grid. Trace it to its source and neutralize it before it spreads to connected systems.",
      "System integrity scan revealed an anomaly in the code matrix. Infiltrate the affected module and restore normal operations.",
      "Residents are reporting errors in the district's service layer. Identify the defect and deploy a fix before confidence drops further.",
      "An unstable process is corrupting data streams in the sector. Isolate the fault and terminate it with extreme prejudice.",
      "The grid is bleeding. A critical bug is cascading through subsystems. Patch it before total district failure.",
    ],
  },
  feature: {
    titles: ["DEPLOY NEW MODULE", "EXPAND THE GRID", "CONSTRUCT ADDON", "BLUEPRINT ALPHA", "FORGE NEW PATH"],
    briefings: [
      "City command has authorized a new subsystem to improve district operations. Design and deploy it according to spec.",
      "The infrastructure needs an upgrade. Build a new component that integrates with the existing city framework.",
      "A new capability has been requested by district operators. Implement it and bring the system online.",
      "Intelligence suggests a new module would give us tactical advantage. Build it clean, build it fast.",
      "The city grows restless for expansion. Lay down new code foundations and bring the district into the next era.",
    ],
  },
  refactor: {
    titles: ["RESTRUCTURE SECTOR", "REWRITE PROTOCOL", "OPTIMIZE FLOW", "ARCHITECT UPGRADE", "PURGE LEGACY"],
    briefings: [
      "Legacy code in this sector is causing performance degradation. Rebuild it with modern patterns to restore efficiency.",
      "The old subsystem is unstable and hard to maintain. Rewrite it to current standards without breaking existing connections.",
      "Data flow analysis shows bottlenecks in the code pipeline. Restructure the architecture for optimal throughput.",
      "The foundations are rotting. Demolish the old code and rebuild from scratch — this time, done right.",
      "Technical debt has reached critical mass. Restructure the entire module before it collapses under its own weight.",
    ],
  },
  explore: {
    titles: ["SCAN THE UNKNOWN", "INTEL GATHER", "SURVEY SECTOR", "DEEP DIVE", "RECON MISSION"],
    briefings: [
      "We need reconnaissance on an unfamiliar code sector. Deploy agents to map the territory and report findings.",
      "An unexplored module was detected in the city grid. Investigate its purpose and assess whether it poses a threat.",
      "District intelligence requires a full audit of the target area. Send a scout and compile a comprehensive report.",
      "Unknown signals emanating from an undocumented code region. Penetrate the sector and extract all useful intel.",
      "Rumors of hidden functionality in the codebase. Investigate, document, and report back to command.",
    ],
  },
  test: {
    titles: ["VERIFY INTEGRITY", "RUN DIAGNOSTICS", "STRESS TEST", "VALIDATION SWEEP", "QA PROTOCOL"],
    briefings: [
      "Before the next city-wide deployment, all subsystems must be verified. Run comprehensive diagnostics on the target module.",
      "The safety board requires proof of reliability. Execute test protocols and document the results.",
      "A recent change may have introduced regressions. Run the test suite and ensure all checkpoints pass.",
      "Quality assurance demands a full validation sweep. No module deploys without passing the gauntlet.",
      "Stress test the new code under maximum load. If it breaks, we need to know before the city does.",
    ],
  },
};

// --- Mission chains ---

export interface MissionChain {
  id: string;
  name: string;
  description: string;
  faction: FactionId;
  missions: string[]; // category sequence: ["explore", "feature", "test"]
}

const MISSION_CHAINS: MissionChain[] = [
  {
    id: "grid-expansion",
    name: "GRID EXPANSION INITIATIVE",
    description: "A multi-phase operation to expand city infrastructure.",
    faction: "constructors",
    missions: ["explore", "feature", "test"],
  },
  {
    id: "ghost-protocol",
    name: "GHOST PROTOCOL",
    description: "Investigate and neutralize a system-wide anomaly.",
    faction: "netrunners",
    missions: ["explore", "bug", "bug", "test"],
  },
  {
    id: "foundation-purge",
    name: "FOUNDATION PURGE",
    description: "Complete restructuring of a critical district module.",
    faction: "overseers",
    missions: ["explore", "refactor", "refactor", "test"],
  },
  {
    id: "shadow-recon",
    name: "SHADOW RECONNAISSANCE",
    description: "Deep intel gathering on an unknown sector.",
    faction: "phantoms",
    missions: ["explore", "explore", "feature", "test"],
  },
];

// --- Progression tracking ---

export interface ProgressionState {
  totalMissions: number;
  completedMissions: number;
  failedMissions: number;
  credits: number;
  reputation: number;
  level: number;
  factionReputation: Record<FactionId, number>;
  activeChainId: string | null;
  activeChainProgress: number;
  chainHistory: string[];
}

export function createProgression(): ProgressionState {
  return {
    totalMissions: 0,
    completedMissions: 0,
    failedMissions: 0,
    credits: 0,
    reputation: 0,
    level: 1,
    factionReputation: {
      netrunners: 0,
      constructors: 0,
      overseers: 0,
      phantoms: 0,
    },
    activeChainId: null,
    activeChainProgress: 0,
    chainHistory: [],
  };
}

export function getLevel(reputation: number): number {
  if (reputation >= 500) return 5;
  if (reputation >= 300) return 4;
  if (reputation >= 150) return 3;
  if (reputation >= 50) return 2;
  return 1;
}

export function getLevelTitle(level: number): string {
  const titles = ["ROOKIE", "OPERATIVE", "SPECIALIST", "COMMANDER", "LEGEND"];
  return titles[Math.min(level, 5) - 1] || "ROOKIE";
}

// --- Mission generation ---

export function generateMission(
  taskId: string,
  taskSubject: string,
  taskDescription?: string,
  progression?: ProgressionState
): Mission {
  const subjectLower = taskSubject.toLowerCase();

  let category = "feature";
  if (subjectLower.includes("bug") || subjectLower.includes("fix") || subjectLower.includes("error") || subjectLower.includes("crash")) {
    category = "bug";
  } else if (subjectLower.includes("refactor") || subjectLower.includes("rewrite") || subjectLower.includes("clean") || subjectLower.includes("restructure")) {
    category = "refactor";
  } else if (subjectLower.includes("explore") || subjectLower.includes("investigate") || subjectLower.includes("search") || subjectLower.includes("find")) {
    category = "explore";
  } else if (subjectLower.includes("test") || subjectLower.includes("verify") || subjectLower.includes("check") || subjectLower.includes("validate")) {
    category = "test";
  }

  // Check if this continues an active chain
  let chainId: string | undefined;
  let chainPosition: number | undefined;
  let faction: FactionId | undefined;

  if (progression?.activeChainId) {
    const chain = MISSION_CHAINS.find(c => c.id === progression.activeChainId);
    if (chain && progression.activeChainProgress < chain.missions.length) {
      // Override category to match chain
      category = chain.missions[progression.activeChainProgress];
      chainId = chain.id;
      chainPosition = progression.activeChainProgress;
      faction = chain.faction;
    }
  } else if (progression && Math.random() < 0.3) {
    // 30% chance to start a new chain (if not already in one)
    const eligible = MISSION_CHAINS.filter(c => !progression.chainHistory.includes(c.id));
    if (eligible.length > 0) {
      const chain = eligible[Math.floor(Math.random() * eligible.length)];
      category = chain.missions[0];
      chainId = chain.id;
      chainPosition = 0;
      faction = chain.faction;
    }
  }

  // Assign faction based on category if not from a chain
  if (!faction) {
    faction = category === "bug" ? "netrunners"
            : category === "feature" ? "constructors"
            : category === "refactor" ? "overseers"
            : "phantoms";
  }

  const template = MISSION_TEMPLATES[category];
  const title = template.titles[Math.floor(Math.random() * template.titles.length)];
  const briefing = template.briefings[Math.floor(Math.random() * template.briefings.length)];

  // Scale difficulty with level
  const baseDifficulty: Mission["difficulty"] =
    category === "bug" ? "critical" :
    category === "refactor" ? "complex" :
    "routine";

  const difficulty = progression && progression.level >= 3 && category !== "critical"
    ? (Math.random() < 0.3 ? "complex" : baseDifficulty)
    : baseDifficulty;

  const intel = generateIntel(category, faction);

  return {
    id: `mission-${taskId}`,
    title,
    briefing,
    objectives: generateObjectives(taskId, taskSubject, taskDescription, category),
    reward: getReward(difficulty),
    difficulty,
    status: "active",
    chainId,
    chainPosition,
    faction,
    intel,
  };
}

function generateObjectives(taskId: string, subject: string, description: string | undefined, category: string): MissionObjective[] {
  const objectives: MissionObjective[] = [
    { id: `${taskId}-obj-1`, description: subject, completed: false },
  ];

  if (description) {
    objectives.push({ id: `${taskId}-obj-2`, description, completed: false });
  }

  // Add category-specific bonus objectives
  switch (category) {
    case "bug":
      objectives.push({ id: `${taskId}-obj-bonus`, description: "Verify no regressions in adjacent modules", completed: false });
      break;
    case "feature":
      objectives.push({ id: `${taskId}-obj-bonus`, description: "Ensure integration with existing city grid", completed: false });
      break;
    case "refactor":
      objectives.push({ id: `${taskId}-obj-bonus`, description: "Maintain backward compatibility", completed: false });
      break;
    case "explore":
      objectives.push({ id: `${taskId}-obj-bonus`, description: "Document findings in city archives", completed: false });
      break;
    case "test":
      objectives.push({ id: `${taskId}-obj-bonus`, description: "Achieve full coverage on target module", completed: false });
      break;
  }

  return objectives;
}

function generateIntel(category: string, faction: FactionId): string {
  const intelLines: Record<string, string[]> = {
    bug: [
      "INTEL: Source traceback points to a recent deployment in the affected sector.",
      "INTEL: Error rate has been climbing 15% per cycle since the anomaly was first detected.",
      "INTEL: Similar glitch pattern observed in 3 other districts last quarter.",
    ],
    feature: [
      "INTEL: District operators have been requesting this capability for 2 cycles.",
      "INTEL: Adjacent sectors have already implemented similar modules successfully.",
      "INTEL: Material costs for this module are within budget. Green light to proceed.",
    ],
    refactor: [
      "INTEL: Current architecture was deployed 18 months ago. Multiple patches applied since.",
      "INTEL: Performance benchmarks show 40% degradation since last audit.",
      "INTEL: Overseers have flagged this sector for priority restructuring.",
    ],
    explore: [
      "INTEL: Sector has been dormant since the last major city restructuring.",
      "INTEL: Scanners detect activity but cannot classify the code type.",
      "INTEL: Previous recon team reported anomalous signals. Proceed with caution.",
    ],
    test: [
      "INTEL: Last validation sweep was 6 cycles ago. Multiple changes since.",
      "INTEL: QA board has mandated verification before next deployment window.",
      "INTEL: Recent patches may have introduced edge case failures.",
    ],
  };

  const factionPrefix: Record<FactionId, string> = {
    netrunners: "[NR-SEC] ",
    constructors: "[CN-OPS] ",
    overseers: "[OV-CMD] ",
    phantoms: "[PH-INT] ",
  };

  const lines = intelLines[category] || intelLines.feature;
  return factionPrefix[faction] + lines[Math.floor(Math.random() * lines.length)];
}

function getReward(difficulty: Mission["difficulty"]): string {
  switch (difficulty) {
    case "critical": return "+500 city credits, +50 reputation";
    case "complex": return "+250 city credits, +25 reputation";
    case "routine": return "+100 city credits, +10 reputation";
  }
}

export function updateProgression(
  progression: ProgressionState,
  mission: Mission,
  status: "completed" | "failed"
): ProgressionState {
  const p = { ...progression, factionReputation: { ...progression.factionReputation } };
  p.totalMissions++;

  if (status === "completed") {
    p.completedMissions++;
    const creditMatch = mission.reward.match(/\+(\d+)\s+city\s+credits/);
    const repMatch = mission.reward.match(/\+(\d+)\s+reputation/);
    if (creditMatch) p.credits += parseInt(creditMatch[1]);
    if (repMatch) {
      p.reputation += parseInt(repMatch[1]);
      if (mission.faction) {
        p.factionReputation[mission.faction] += parseInt(repMatch[1]);
      }
    }

    // Chain progress
    if (p.activeChainId === mission.chainId && mission.chainPosition !== undefined) {
      const chain = MISSION_CHAINS.find(c => c.id === p.activeChainId);
      if (chain) {
        p.activeChainProgress++;
        if (p.activeChainProgress >= chain.missions.length) {
          // Chain complete — bonus
          p.credits += 1000;
          p.reputation += 100;
          p.chainHistory.push(p.activeChainId);
          p.activeChainId = null;
          p.activeChainProgress = 0;
        }
      }
    }
  } else {
    p.failedMissions++;
    // Chain broken on failure
    if (p.activeChainId === mission.chainId) {
      p.activeChainId = null;
      p.activeChainProgress = 0;
    }
  }

  p.level = getLevel(p.reputation);
  return p;
}

export function startChain(progression: ProgressionState, chainId: string): ProgressionState {
  return {
    ...progression,
    activeChainId: chainId,
    activeChainProgress: 0,
  };
}

/**
 * Format a mission briefing for display in the GUI.
 */
export function formatBriefing(mission: Mission): string {
  const factionTag = mission.faction ? FACTIONS[mission.faction].tag : "??";

  return [
    `━━━ MISSION BRIEFING [${factionTag}] ━━━`,
    ``,
    `${mission.title}`,
    `DIFFICULTY: ${mission.difficulty.toUpperCase()}`,
    ``,
    `${mission.briefing}`,
    ``,
    `OBJECTIVES:`,
    ...mission.objectives.map((o) =>
      `  ${o.completed ? "✓" : "○"} ${o.description}`
    ),
    ``,
    `REWARD: ${mission.reward}`,
    ...(mission.intel ? [``, mission.intel] : []),
  ].join("\n");
}
