import type { InternalProject, InternalSession, TaskModel, AgentModel } from "./types.js";
import type { BridgeEvent, FullSyncPayload, ProjectModel } from "../shared/protocol.js";
import { classifyDistrict } from "../shared/protocol.js";
import { scanProjects } from "./project-scanner.js";
import { layoutSlots } from "../shared/city-layout.js";

type EventHandler = (event: BridgeEvent) => void;

export class SessionStore {
  private projects = new Map<string, InternalProject>();
  private sessions = new Map<string, InternalSession>();
  private taskCounter = 0;
  private handlers: EventHandler[] = [];

  async initialize(): Promise<void> {
    this.projects = await scanProjects();
    this.assignLayout();
    console.log(`Discovered ${this.projects.size} projects`);

    for (const [id, project] of this.projects) {
      this.emit({
        type: "project:discovered",
        payload: this.toProjectModel(project),
      });
    }
  }

  /** Assign city grid positions to all projects */
  private assignLayout(): void {
    const sorted = [...this.projects.values()].sort((a, b) =>
      a.name.localeCompare(b.name)
    );
    const slots = layoutSlots(sorted.length);

    sorted.forEach((project, i) => {
      project.position = { x: slots[i].x, z: slots[i].z };
    });
  }

  /** Register event handler */
  onEvent(handler: EventHandler): void {
    this.handlers.push(handler);
  }

  private emit(event: BridgeEvent): void {
    if (event.type === "session:start" || event.type === "session:stop") {
      const sid = (event.payload as { sessionId?: string }).sessionId;
      console.log(`[store.emit] ${event.type} sid=${sid?.slice(0, 8)} handlers=${this.handlers.length}`);
    }
    for (const handler of this.handlers) {
      handler(event);
    }
  }

  /** Get project ID from a filesystem path */
  getProjectId(cwd: string): string {
    // /home/fabricio/some-project -> -home-fabricio-some-project
    return "-" + cwd.slice(1).replace(/\//g, "-");
  }

  /** Ensure project exists in store, creating if needed */
  ensureProject(projectId: string, cwd: string): InternalProject {
    if (this.projects.has(projectId)) {
      return this.projects.get(projectId)!;
    }

    const name = cwd.split("/").pop() || projectId;
    const project: InternalProject = {
      id: projectId,
      name,
      path: cwd,
      health: "idle",
      position: { x: 0, z: 0 },
      sessions: new Map(),
      tasks: new Map(),
      agents: new Map(),
    };

    this.projects.set(projectId, project);
    this.assignLayout();

    this.emit({
      type: "project:discovered",
      payload: this.toProjectModel(project),
    });

    return project;
  }

  // --- Session lifecycle ---

  /**
   * Insert a session entry recovered from disk (no events emitted).
   * Used by transcript watcher at startup to populate the session list.
   */
  recoverSession(
    sessionId: string,
    cwd: string,
    opts: { prompt?: string; startedAt?: number; lastActivityAt?: number } = {},
  ): void {
    if (this.sessions.has(sessionId)) return;
    const projectId = this.getProjectId(cwd);
    const project = this.ensureProject(projectId, cwd);
    const session: InternalSession = {
      id: sessionId,
      projectId,
      status: "idle",
      currentPrompt: opts.prompt,
      toolCallCount: 0,
      errorCount: 0,
      startedAt: opts.startedAt ?? Date.now(),
      lastActivityAt: opts.lastActivityAt ?? Date.now(),
      cwd,
      transcriptPath: "",
    };
    this.sessions.set(sessionId, session);
    project.sessions.set(sessionId, session);
  }

  sessionStart(sessionId: string, cwd: string): void {
    const projectId = this.getProjectId(cwd);
    const project = this.ensureProject(projectId, cwd);

    // End any previous active session for this project
    for (const [id, session] of this.sessions) {
      if (session.projectId === projectId && session.status === "active") {
        session.status = "stopped";
      }
    }

    const session: InternalSession = {
      id: sessionId,
      projectId,
      status: "active",
      toolCallCount: 0,
      errorCount: 0,
      startedAt: Date.now(),
      lastActivityAt: Date.now(),
      cwd,
      transcriptPath: "",
    };

    this.sessions.set(sessionId, session);
    project.sessions.set(sessionId, session);
    project.health = "healthy";

    this.emit({
      type: "session:start",
      payload: { sessionId, cwd, projectId },
    });
  }

  /** Get project ID for a session */
  getProjectIdForSession(sessionId: string): string | undefined {
    return this.sessions.get(sessionId)?.projectId;
  }

  sessionPrompt(sessionId: string, prompt: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.currentPrompt = prompt;
    session.lastActivityAt = Date.now();
    session.status = "active";

    this.emit({
      type: "session:prompt",
      payload: { sessionId, prompt },
    });
  }

  sessionToolPre(
    sessionId: string,
    toolName: string,
    toolInput: Record<string, unknown>,
    toolUseId: string
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.toolCallCount++;
    session.lastActivityAt = Date.now();
    const projectId = session.projectId;

    this.emit({
      type: "session:tool_pre",
      payload: { sessionId, toolName, toolInput, toolUseId, projectId },
    });

    // Update agent state if this session has active agents
    // PreToolUse means an agent is executing
    const project = this.projects.get(projectId);
    if (project) {
      for (const [agentId, agent] of project.agents) {
        if (agent.sessionId === sessionId && agent.state !== "executing") {
          this.agentStateChange(agentId, "executing", toolName);
        }
      }
    }
  }

  sessionToolPost(
    sessionId: string,
    toolName: string,
    toolResponse: string | undefined,
    durationMs: number
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.lastActivityAt = Date.now();

    this.emit({
      type: "session:tool_post",
      payload: { sessionId, toolName, toolResponse, durationMs },
    });

    // Agent goes back to thinking (waiting for next tool)
    const project = this.projects.get(session.projectId);
    if (project) {
      for (const [agentId, agent] of project.agents) {
        if (agent.sessionId === sessionId) {
          this.agentStateChange(agentId, "thinking");
        }
      }
    }
  }

  sessionToolFail(sessionId: string, toolName: string, error: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.errorCount++;
    session.lastActivityAt = Date.now();

    const project = this.projects.get(session.projectId);
    if (project && session.errorCount > 3) {
      project.health = "warning";
    }

    this.emit({
      type: "session:tool_fail",
      payload: { sessionId, toolName, error },
    });
  }

  sessionStop(sessionId: string, lastMessage?: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    // Idempotent: first stop wins for state transition. Hook server's "Stop"
    // races proc-close, and without this guard a duplicate empty stop clears
    // the client mapping before the real reply arrives. We DO still emit a
    // follow-up stop if it brings a lastMessage the first one lacked.
    if (session.status === "idle") {
      if (lastMessage) {
        this.emit({ type: "session:stop", payload: { sessionId, lastMessage } });
      }
      return;
    }
    session.status = "idle";
    session.lastActivityAt = Date.now();
    this.emit({
      type: "session:stop",
      payload: { sessionId, lastMessage },
    });
  }

  sessionEnd(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.status = "stopped";
    const projectId = session.projectId;

    const project = this.projects.get(projectId);
    if (project) {
      project.health = "idle";
    }

    this.emit({
      type: "session:end",
      payload: { sessionId, projectId },
    });
  }

  // --- Agent lifecycle ---

  agentStart(sessionId: string, agentId: string, agentType: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const projectId = session.projectId;
    const agent: AgentModel = {
      id: agentId,
      sessionId,
      projectId,
      type: agentType,
      state: "idle",
    };

    const project = this.projects.get(projectId);
    if (project) {
      project.agents.set(agentId, agent);
    }

    this.emit({
      type: "agent:start",
      payload: { sessionId, agentId, agentType, projectId },
    });
  }

  agentStop(sessionId: string, agentId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const projectId = session.projectId;
    const project = this.projects.get(projectId);
    if (project) {
      project.agents.delete(agentId);
    }

    this.emit({
      type: "agent:stop",
      payload: { sessionId, agentId, projectId },
    });
  }

  agentStateChange(agentId: string, state: "idle" | "thinking" | "executing" | "error", currentTool?: string): void {
    // Find the agent across all projects
    for (const project of this.projects.values()) {
      const agent = project.agents.get(agentId);
      if (agent) {
        agent.state = state;
        agent.currentTool = currentTool;

        this.emit({
          type: "agent:state_change",
          payload: { agentId, state, currentTool },
        });
        return;
      }
    }
  }

  // --- Task lifecycle ---

  taskCreated(sessionId: string, subject: string, description?: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const taskId = `task-${++this.taskCounter}`;
    const projectId = session.projectId;
    const project = this.projects.get(projectId);

    const task: TaskModel = {
      id: taskId,
      projectId,
      sessionId,
      subject,
      description,
      status: "in_progress",
      floorIndex: project ? project.tasks.size : 0,
      createdAt: Date.now(),
    };

    if (project) {
      project.tasks.set(taskId, task);
    }

    this.emit({
      type: "task:created",
      payload: { taskId, sessionId, projectId, subject, description },
    });
  }

  taskCompleted(taskId: string, subject: string): void {
    // Find task across all projects
    for (const project of this.projects.values()) {
      const task = project.tasks.get(taskId);
      if (task) {
        task.status = "completed";
        task.completedAt = Date.now();

        this.emit({
          type: "task:completed",
          payload: { taskId, subject, projectId: project.id, },
        });
        return;
      }
    }

    // Task not found by ID — emit anyway for subjects matched tasks
    this.emit({
      type: "task:completed",
      payload: { taskId: taskId, projectId: "", subject },
    });
  }

  // --- Full sync for new clients ---

  getFullSync(): FullSyncPayload {
    const allSessions: InternalSession[] = [];
    const allTasks: TaskModel[] = [];
    const allAgents: AgentModel[] = [];
    const projectModels: ProjectModel[] = [];

    for (const project of this.projects.values()) {
      projectModels.push(this.toProjectModel(project));
      for (const session of project.sessions.values()) {
        allSessions.push(session);
      }
      for (const task of project.tasks.values()) {
        allTasks.push(task);
      }
      for (const agent of project.agents.values()) {
        allAgents.push(agent);
      }
    }

    return {
      projects: projectModels,
      sessions: allSessions,
      tasks: allTasks,
      agents: allAgents,
      pins: [], // populated by index.ts before broadcasting
      mail: [], // populated by index.ts before broadcasting
    };
  }

  private toProjectModel(project: InternalProject): ProjectModel {
    return {
      id: project.id,
      name: project.name,
      path: project.path,
      health: project.health,
      position: project.position,
      district: project.district ?? classifyDistrict(project.path),
    };
  }
}

