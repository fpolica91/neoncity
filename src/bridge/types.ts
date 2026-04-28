import type { ProjectModel, SessionModel, TaskModel, AgentModel, ProjectHealth, SessionStatus, TaskStatus, AgentState } from "../shared/protocol";

export type { ProjectModel, SessionModel, TaskModel, AgentModel, ProjectHealth, SessionStatus, TaskStatus, AgentState };

export interface InternalSession extends SessionModel {
  transcriptPath: string;
}

export interface InternalProject extends ProjectModel {
  sessions: Map<string, InternalSession>;
  tasks: Map<string, TaskModel>;
  agents: Map<string, AgentModel>;
}
