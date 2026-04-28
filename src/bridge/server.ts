import Fastify from "fastify";
import type { HookEvent } from "../shared/protocol.js";
import type { SessionStore } from "./session-store.js";
import type { WsBus } from "./ws-bus.js";
import { BRIDGE_HTTP_PORT } from "../shared/constants.js";

export async function createServer(store: SessionStore, bus: WsBus): Promise<void> {
  const app = Fastify({ logger: false });

  // Health check
  app.get("/health", async () => ({ status: "ok" }));

  // Hook ingestion endpoint — Claude Code POSTs here for every event
  app.post<{ Params: { eventName: string } }>(
    "/hooks/:eventName",
    async (request, reply) => {
      const eventName = request.params.eventName;
      const body = request.body as HookEvent;

      if (!body?.session_id) {
        reply.code(400).send({ error: "missing session_id" });
        return;
      }

      try {
        routeEvent(eventName, body, store, bus);
      } catch (err) {
        console.error(`Error handling ${eventName}:`, err);
      }

      reply.send({ ok: true });
    }
  );

  // Full state sync endpoint (for debugging)
  app.get("/state", async () => store.getFullSync());

  await app.listen({ port: BRIDGE_HTTP_PORT, host: "0.0.0.0" });
  console.log(`HTTP hook server on port ${BRIDGE_HTTP_PORT}`);
}

function routeEvent(
  eventName: string,
  body: HookEvent,
  store: SessionStore,
  bus: WsBus
): void {
  const sessionId = body.session_id;
  const cwd = body.cwd;

  switch (eventName) {
    case "SessionStart":
      store.sessionStart(sessionId, cwd);
      break;

    case "UserPromptSubmit":
      // Extract prompt text from message field
      store.sessionPrompt(sessionId, body.message || "");
      break;

    case "PreToolUse":
      store.sessionToolPre(
        sessionId,
        body.tool_name || "unknown",
        body.tool_input || {},
        body.tool_use_id || ""
      );
      break;

    case "PostToolUse":
      store.sessionToolPost(
        sessionId,
        body.tool_name || "unknown",
        typeof body.tool_response === "string"
          ? body.tool_response
          : JSON.stringify(body.tool_response),
        body.duration_ms || 0
      );
      break;

    case "PostToolUseFailure":
      store.sessionToolFail(
        sessionId,
        body.tool_name || "unknown",
        typeof body.tool_response === "string"
          ? body.tool_response
          : "tool failed"
      );
      break;

    case "Stop":
      store.sessionStop(sessionId);
      break;

    case "SubagentStart":
      store.agentStart(
        sessionId,
        body.tool_use_id || `agent-${Date.now()}`,
        body.tool_name || "generic"
      );
      break;

    case "SubagentStop":
      store.agentStop(
        sessionId,
        body.tool_use_id || "unknown"
      );
      break;

    case "TaskCreated":
      store.taskCreated(
        sessionId,
        body.message || "Untitled task"
      );
      break;

    case "TaskCompleted":
      store.taskCompleted(
        body.tool_use_id || "",
        body.message || "Task"
      );
      break;

    case "SessionEnd":
      store.sessionEnd(sessionId);
      break;

    default:
      // Silently ignore unhandled events
      break;
  }
}
