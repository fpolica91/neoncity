// WebSocket protocol: Bridge <-> Client messages

export type ProjectHealth = "healthy" | "warning" | "error" | "idle";
export type SessionStatus = "active" | "idle" | "stopped";
export type TaskStatus = "pending" | "in_progress" | "completed" | "failed";
export type AgentState = "idle" | "thinking" | "executing" | "error";

// --- Models ---

export interface ProjectModel {
  id: string;
  name: string;
  path: string;
  health: ProjectHealth;
  position: { x: number; z: number };
  district?: DistrictTheme;
}

export interface SessionModel {
  id: string;
  projectId: string;
  status: SessionStatus;
  currentPrompt?: string;
  toolCallCount: number;
  errorCount: number;
  startedAt: number;
  lastActivityAt: number;
  cwd: string;
}

export interface TaskModel {
  id: string;
  projectId: string;
  sessionId: string;
  subject: string;
  description?: string;
  status: TaskStatus;
  floorIndex: number;
  createdAt: number;
  completedAt?: number;
  assignedAgents?: string[];
}

export interface AgentModel {
  id: string;
  sessionId: string;
  projectId?: string;
  type: string;
  state: AgentState;
  currentTool?: string;
  assignedTaskId?: string;
}

// --- District themes ---

export type DistrictTheme =
  | "residential"   // Default projects, calm
  | "industrial"    // Infra, devops, heavy tooling
  | "commercial"    // Web apps, APIs, user-facing
  | "research"      // AI/ML, exploration, experimental
  | "military";     // Security, auth, hardening

export const DISTRICT_THEMES: Record<DistrictTheme, {
  label: string;
  primaryColor: { r: number; g: number; b: number };
  accentColor: { r: number; g: number; b: number };
  signStyle: "clean" | "harsh" | "fancy" | "glitch" | "rigid";
}> = {
  residential: {
    label: "RESIDENTIAL",
    primaryColor: { r: 0, g: 1, b: 0.8 },
    accentColor: { r: 0, g: 0.6, b: 0.5 },
    signStyle: "clean",
  },
  industrial: {
    label: "INDUSTRIAL",
    primaryColor: { r: 1, g: 0.5, b: 0.1 },
    accentColor: { r: 0.8, g: 0.4, b: 0.05 },
    signStyle: "harsh",
  },
  commercial: {
    label: "COMMERCIAL",
    primaryColor: { r: 1, g: 0.05, b: 0.5 },
    accentColor: { r: 0.7, g: 0.1, b: 0.4 },
    signStyle: "fancy",
  },
  research: {
    label: "RESEARCH",
    primaryColor: { r: 0.7, g: 0.2, b: 1 },
    accentColor: { r: 0.5, g: 0.1, b: 0.8 },
    signStyle: "glitch",
  },
  military: {
    label: "MILITARY",
    primaryColor: { r: 1, g: 0.15, b: 0.15 },
    accentColor: { r: 0.7, g: 0.1, b: 0.1 },
    signStyle: "rigid",
  },
};

// --- Bridge -> Client events ---

export type BridgeEvent =
  | { type: "session:start"; payload: { sessionId: string; cwd: string; projectId: string } }
  | { type: "session:end"; payload: { sessionId: string; projectId: string } }
  | { type: "session:prompt"; payload: { sessionId: string; prompt: string } }
  | { type: "session:tool_pre"; payload: { sessionId: string; toolName: string; toolInput: Record<string, unknown>; toolUseId: string; projectId: string } }
  | { type: "session:tool_post"; payload: { sessionId: string; toolName: string; toolResponse?: string; durationMs: number } }
  | { type: "session:tool_fail"; payload: { sessionId: string; toolName: string; error: string } }
  | { type: "session:stop"; payload: { sessionId: string; lastMessage?: string } }
  | { type: "agent:start"; payload: { sessionId: string; agentId: string; agentType: string; projectId: string } }
  | { type: "agent:stop"; payload: { sessionId: string; agentId: string; projectId: string } }
  | { type: "agent:state_change"; payload: { agentId: string; state: AgentState; currentTool?: string } }
  | { type: "task:created"; payload: { taskId: string; sessionId: string; projectId: string; subject: string; description?: string } }
  | { type: "task:completed"; payload: { taskId: string; subject: string; projectId: string } }
  | { type: "task:failed"; payload: { taskId: string; subject: string; projectId: string } }
  | { type: "project:discovered"; payload: ProjectModel }
  | { type: "state:full_sync"; payload: FullSyncPayload };

export interface FullSyncPayload {
  projects: ProjectModel[];
  sessions: SessionModel[];
  tasks: TaskModel[];
  agents: AgentModel[];
}

// --- Client -> Bridge commands ---

export type ClientCommand =
  | { type: "prompt:send"; payload: { sessionId?: string; projectPath: string; prompt: string } }
  | { type: "session:create"; payload: { projectPath: string; prompt: string } }
  | { type: "session:cancel"; payload: { sessionId: string } }
  | { type: "subscribe" };

// --- Hook event from Claude Code ---

export interface HookEvent {
  session_id: string;
  transcript_path: string;
  cwd: string;
  permission_mode?: string;
  hook_event_name: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_use_id?: string;
  tool_response?: unknown;
  tool_result?: unknown;
  duration_ms?: number;
  stop_reason?: string;
  message?: string;
}

// --- District classification helper ---

export function classifyDistrict(projectPath: string): DistrictTheme {
  const lower = projectPath.toLowerCase();
  if (lower.includes("infra") || lower.includes("devops") || lower.includes("deploy") || lower.includes("k8s") || lower.includes("docker") || lower.includes("terraform")) return "industrial";
  if (lower.includes("auth") || lower.includes("security") || lower.includes("hardened") || lower.includes("vault") || lower.includes("firewall")) return "military";
  if (lower.includes("ai") || lower.includes("ml") || lower.includes("research") || lower.includes("experiment") || lower.includes("lab")) return "research";
  if (lower.includes("web") || lower.includes("app") || lower.includes("api") || lower.includes("frontend") || lower.includes("backend") || lower.includes("payments") || lower.includes("shop")) return "commercial";
  return "residential";
}
