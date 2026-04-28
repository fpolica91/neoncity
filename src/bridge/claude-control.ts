import { spawn } from "node:child_process";
import type { WsBus } from "./ws-bus.js";
import type { SessionStore } from "./session-store.js";

/**
 * Spawns a Claude Code headless session via `claude -p` with stream-json output.
 * Pipes stream events back through the WebSocket bus.
 */
export function sendPrompt(
  prompt: string,
  projectPath: string,
  store: SessionStore,
  bus: WsBus
): string {
  const sessionId = `headless-${Date.now()}`;
  const cwd = projectPath.startsWith("/")
    ? projectPath
    : `/home/fabricio/${projectPath}`;

  // Notify clients a session started
  store.sessionStart(sessionId, cwd);
  store.sessionPrompt(sessionId, prompt);

  const proc = spawn(
    "claude",
    [
      "-p", prompt,
      "--output-format", "stream-json",
      "--verbose",
    ],
    {
      cwd,
      env: { ...process.env },
      stdio: ["pipe", "pipe", "pipe"],
    }
  );

  let buffer = "";

  proc.stdout.on("data", (chunk: Buffer) => {
    buffer += chunk.toString();
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const event = JSON.parse(line);
        routeStreamEvent(event, sessionId, store, bus);
      } catch {
        // Not JSON — ignore
      }
    }
  });

  proc.stderr.on("data", (chunk: Buffer) => {
    console.error(`[claude ${sessionId}] ${chunk.toString().trim()}`);
  });

  proc.on("close", (code) => {
    store.sessionStop(sessionId);
    if (code !== 0) {
      console.error(`[claude ${sessionId}] exited with code ${code}`);
    }
  });

  proc.stdin?.end();

  return sessionId;
}

function routeStreamEvent(
  event: Record<string, unknown>,
  sessionId: string,
  store: SessionStore,
  bus: WsBus
): void {
  const type = event.type as string;

  if (type === "system/init") {
    // Session metadata
    return;
  }

  if (type === "stream_event") {
    // Token delta — we don't need to forward these for the 3D view
    return;
  }

  if (type === "result") {
    // Final result
    const stopReason = event.stop_reason as string;
    if (stopReason === "tool_deferred") {
      // Tool needs approval — future: surface in GUI
    }
    return;
  }
}
