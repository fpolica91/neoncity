import { spawn, execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { WsBus } from "./ws-bus.js";
import type { SessionStore } from "./session-store.js";
import { readLastAssistantMessage } from "./jsonl-parser.js";

let claudeBin = "claude";

// Track in-flight subprocesses by sessionId so we can cancel them.
const activeProcs = new Map<string, ReturnType<typeof spawn>>();

export function cancelSession(sessionId: string): boolean {
  const proc = activeProcs.get(sessionId);
  if (!proc) return false;
  try {
    proc.kill("SIGTERM");
  } catch {
    // process already gone
  }
  activeProcs.delete(sessionId);
  return true;
}
try {
  const resolved = execSync(
    'zsh -lc "unalias claude 2>/dev/null; command -v claude"',
    { encoding: "utf8" },
  ).trim();
  if (resolved && resolved !== "claude") {
    claudeBin = resolved;
    console.log(`[claude-control] resolved claude binary: ${claudeBin}`);
  }
} catch (e) {
  console.warn(`[claude-control] could not resolve claude via login shell, falling back to PATH`);
}

export function sendPrompt(
  prompt: string,
  projectPath: string,
  store: SessionStore,
  bus: WsBus,
  resumeSessionId?: string,
): string {
  const sessionId = resumeSessionId || `headless-${Date.now()}`;
  const cwd = projectPath.startsWith("/")
    ? projectPath
    : `${homedir()}/${projectPath}`;

  store.sessionStart(sessionId, cwd);
  store.sessionPrompt(sessionId, prompt);

  if (!existsSync(cwd)) {
    const msg = `(project path no longer exists: ${cwd})`;
    console.error(`[claude ${sessionId}] ${msg}`);
    store.sessionStop(sessionId, msg);
    return sessionId;
  }

  let proc;
  try {
    const args = [
      "-p", prompt,
      "--output-format", "stream-json",
      "--verbose",
      "--dangerously-skip-permissions",
    ];
    if (resumeSessionId) {
      args.unshift("--resume", resumeSessionId);
    }
    // Cancel any in-flight spawn for the same session before starting a new one
    const existing = activeProcs.get(sessionId);
    if (existing) {
      try { existing.kill("SIGTERM"); } catch { /* */ }
      activeProcs.delete(sessionId);
    }
    proc = spawn(claudeBin, args, {
      cwd,
      env: { ...process.env },
      stdio: ["pipe", "pipe", "pipe"],
    });
    activeProcs.set(sessionId, proc);
  } catch (e) {
    console.error(`[claude ${sessionId}] spawn threw:`, e);
    store.sessionStop(sessionId, `(error: ${String(e)})`);
    return sessionId;
  }

  proc.on("error", (err) => {
    console.error(`[claude ${sessionId}] spawn error:`, err);
    store.sessionStop(sessionId, `(spawn error: ${err.message})`);
  });

  let buffer = "";
  let finalText: string | undefined;
  let actualClaudeSessionId: string | undefined;

  proc.stdout?.on("data", (chunk: Buffer) => {
    const text = chunk.toString();
    console.log(`[claude ${sessionId.slice(0, 8)}] STDOUT: ${text.slice(0, 200)}`);
    buffer += text;
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const event = JSON.parse(line);
        // Capture the claude-internal session_id from init (it may differ from
        // resumeSessionId when claude branches off, and it's needed to find
        // the JSONL file for tail-fallback).
        if (
          event.type === "system" &&
          event.subtype === "init" &&
          typeof event.session_id === "string"
        ) {
          actualClaudeSessionId = event.session_id;
        }
        const msg = routeStreamEvent(event, sessionId, store, bus);
        if (msg) finalText = msg;
      } catch {
        // not JSON
      }
    }
  });

  proc.stderr?.on("data", (chunk: Buffer) => {
    console.error(`[claude ${sessionId.slice(0, 8)}] STDERR: ${chunk.toString().trim()}`);
  });

  proc.on("close", async (code) => {
    console.log(`[claude ${sessionId.slice(0, 8)}] EXIT code=${code} finalTextLen=${finalText?.length ?? 0}`);
    activeProcs.delete(sessionId);
    // Fallback: if the result stream-event never arrived (it's late, buffered,
    // or claude crashed mid-output), peek at the JSONL transcript and grab the
    // last assistant message there. This is what claude-remote does — treat
    // the .jsonl file as the source of truth, not the stream.
    if (!finalText) {
      const claudeSid = actualClaudeSessionId || resumeSessionId;
      if (claudeSid) {
        const transcriptPath = join(
          homedir(),
          ".claude",
          "projects",
          encodeProjectDir(cwd),
          `${claudeSid}.jsonl`,
        );
        if (existsSync(transcriptPath)) {
          try {
            const tail = await readLastAssistantMessage(transcriptPath);
            if (tail) {
              console.log(`[claude ${sessionId.slice(0, 8)}] JSONL fallback: ${tail.length} chars`);
              finalText = tail;
            }
          } catch (e) {
            console.error(`[claude ${sessionId.slice(0, 8)}] JSONL fallback failed:`, e);
          }
        }
      }
    }
    if (code !== 0 && !finalText) {
      finalText = `(claude exited with code ${code})`;
    }
    store.sessionStop(sessionId, finalText);
  });

  proc.stdin?.end();
  return sessionId;
}

function encodeProjectDir(cwd: string): string {
  // /Users/fabricio/Desktop/neoncity → -Users-fabricio-Desktop-neoncity
  return cwd.replace(/\//g, "-");
}

function routeStreamEvent(
  event: Record<string, unknown>,
  _sessionId: string,
  _store: SessionStore,
  _bus: WsBus,
): string | undefined {
  if (event.type === "result") {
    const subtype = event.subtype as string | undefined;
    if (subtype === "success" && typeof event.result === "string") {
      return event.result as string;
    }
    if (typeof event.result === "string") return event.result as string;
  }
  return undefined;
}
