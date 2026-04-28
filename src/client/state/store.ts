import type { BridgeEvent, ProjectModel, SessionModel, TaskModel, AgentModel } from "../../shared/protocol";

type Listener = () => void;

/**
 * Lightweight reactive store that mirrors bridge state.
 * The 3D scene reads from this to update buildings/floors/agents.
 */
class Store {
  projects = new Map<string, ProjectModel>();
  sessions = new Map<string, SessionModel>();
  tasks = new Map<string, TaskModel>();
  agents = new Map<string, AgentModel>();

  private listeners = new Set<Listener>();

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  /** Process an incoming bridge event */
  handleEvent(event: BridgeEvent): void {
    switch (event.type) {
      case "state:full_sync": {
        this.projects.clear();
        this.sessions.clear();
        this.tasks.clear();
        this.agents.clear();

        for (const p of event.payload.projects) {
          this.projects.set(p.id, p);
        }
        for (const s of event.payload.sessions) {
          this.sessions.set(s.id, s);
        }
        for (const t of event.payload.tasks) {
          this.tasks.set(t.id, t);
        }
        for (const a of event.payload.agents) {
          this.agents.set(a.id, a);
        }
        break;
      }

      case "project:discovered": {
        this.projects.set(event.payload.id, event.payload);
        break;
      }

      case "session:start": {
        const { sessionId, cwd, projectId } = event.payload;
        this.sessions.set(sessionId, {
          id: sessionId,
          projectId,
          status: "active",
          toolCallCount: 0,
          errorCount: 0,
          startedAt: Date.now(),
          lastActivityAt: Date.now(),
          cwd,
        });
        const project = this.projects.get(projectId);
        if (project) project.health = "healthy";
        break;
      }

      case "session:end": {
        const session = this.sessions.get(event.payload.sessionId);
        if (session) {
          session.status = "stopped";
          const project = this.projects.get(session.projectId);
          if (project) project.health = "idle";
        }
        break;
      }

      case "session:prompt": {
        const session = this.sessions.get(event.payload.sessionId);
        if (session) {
          session.currentPrompt = event.payload.prompt;
          session.status = "active";
          session.lastActivityAt = Date.now();
        }
        break;
      }

      case "session:tool_pre": {
        const session = this.sessions.get(event.payload.sessionId);
        if (session) {
          session.toolCallCount++;
          session.lastActivityAt = Date.now();
        }
        break;
      }

      case "session:tool_post": {
        const session = this.sessions.get(event.payload.sessionId);
        if (session) session.lastActivityAt = Date.now();
        break;
      }

      case "session:tool_fail": {
        const session = this.sessions.get(event.payload.sessionId);
        if (session) {
          session.errorCount++;
          session.lastActivityAt = Date.now();
        }
        break;
      }

      case "session:stop": {
        const session = this.sessions.get(event.payload.sessionId);
        if (session) session.status = "idle";
        break;
      }

      case "task:created": {
        const { taskId, sessionId, projectId, subject, description } = event.payload;
        this.tasks.set(taskId, {
          id: taskId,
          projectId,
          sessionId,
          subject,
          description,
          status: "in_progress",
          floorIndex: this.tasks.size,
          createdAt: Date.now(),
        });
        break;
      }

      case "task:completed": {
        const task = this.tasks.get(event.payload.taskId);
        if (task) {
          task.status = "completed";
          task.completedAt = Date.now();
        }
        break;
      }

      case "task:failed": {
        const task = this.tasks.get(event.payload.taskId);
        if (task) {
          task.status = "failed";
        }
        break;
      }

      case "agent:start": {
        const { sessionId, agentId, agentType, projectId } = event.payload;
        this.agents.set(agentId, {
          id: agentId,
          sessionId,
          projectId,
          type: agentType,
          state: "idle",
        });
        break;
      }

      case "agent:stop": {
        this.agents.delete(event.payload.agentId);
        break;
      }

      case "agent:state_change": {
        const agent = this.agents.get(event.payload.agentId);
        if (agent) {
          agent.state = event.payload.state;
          if (event.payload.currentTool) {
            agent.currentTool = event.payload.currentTool;
          }
        }
        break;
      }
    }

    this.notify();
  }
}

export const store = new Store();
