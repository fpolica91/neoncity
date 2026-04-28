// Adapted from /Users/fabricio/hydra-repos/claude-remote/src/daemon/{jsonl-parser,resumable-sessions}.ts
import { createReadStream } from "node:fs";
import readline from "node:readline";

export interface ParsedEvent {
  kind: "user_message" | "assistant_message" | "tool_use" | "tool_result" | "hook_event";
  tsMs: number;
  userMessage?: { text: string };
  assistantMessage?: { text: string; thinking?: string };
  toolUse?: { toolUseId: string; name: string; inputJson: string };
  toolResult?: { toolUseId: string; output: string; isError: boolean };
  hookEvent?: { eventType: string; hookName: string; content: string };
}

const COMMAND_NOISE_PREFIXES = [
  "<command-name>",
  "<command-message>",
  "<command-args>",
  "<local-command-stdout>",
  "<local-command-stderr>",
  "<local-command-caveat>",
  "<bash-stdout>",
  "<bash-stderr>",
  "<system-reminder>",
  "<task-notification>",
  "[Request interrupted by user for tool use]",
  "[Request interrupted by user]",
];

export function isCommandNoise(text: string): boolean {
  const trimmed = text.trim();
  return COMMAND_NOISE_PREFIXES.some((p) => trimmed.startsWith(p));
}

function tsToMs(ts: unknown): number {
  if (typeof ts === "string") {
    const n = Date.parse(ts);
    return Number.isFinite(n) ? n : Date.now();
  }
  if (typeof ts === "number") return ts;
  return Date.now();
}

function extractText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((b: { type?: string }) => b && b.type === "text")
      .map((b: { text?: string }) => b.text ?? "")
      .join("");
  }
  return "";
}

export function parseJsonlLine(line: string): ParsedEvent | null {
  if (!line.trim()) return null;
  let obj: { type?: string; message?: { content?: unknown }; timestamp?: unknown; attachment?: { hookEvent?: string; hookName?: string; content?: string } };
  try {
    obj = JSON.parse(line);
  } catch {
    return null;
  }
  if (!obj || typeof obj !== "object") return null;
  const tsMs = tsToMs(obj.timestamp);

  if (obj.type === "attachment" && obj.attachment) {
    const a = obj.attachment;
    return {
      kind: "hook_event",
      tsMs,
      hookEvent: { eventType: a.hookEvent ?? "", hookName: a.hookName ?? "", content: a.content ?? "" },
    };
  }

  if (obj.type === "user" && Array.isArray(obj.message?.content)) {
    const arr = obj.message.content as Array<{ type?: string; tool_use_id?: string; content?: unknown; is_error?: boolean }>;
    const tr = arr.find((b) => b?.type === "tool_result");
    if (tr) {
      return {
        kind: "tool_result",
        tsMs,
        toolResult: {
          toolUseId: tr.tool_use_id ?? "",
          output: typeof tr.content === "string" ? tr.content : JSON.stringify(tr.content ?? ""),
          isError: Boolean(tr.is_error),
        },
      };
    }
  }

  if (obj.type === "user" && obj.message) {
    const text = extractText(obj.message.content);
    if (text) return { kind: "user_message", tsMs, userMessage: { text } };
  }

  if (obj.type === "assistant" && obj.message) {
    const content = obj.message.content;
    const text = extractText(content);
    if (text) return { kind: "assistant_message", tsMs, assistantMessage: { text } };
  }

  return null;
}

/** Stream the JSONL and keep the most-recent non-noise user message. */
export async function readLastUserMessage(filepath: string): Promise<string> {
  return new Promise((resolve) => {
    const stream = createReadStream(filepath, { encoding: "utf8" });
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
    let latest = "";
    rl.on("line", (line) => {
      const ev = parseJsonlLine(line);
      if (ev?.kind === "user_message" && ev.userMessage?.text) {
        if (!isCommandNoise(ev.userMessage.text)) latest = ev.userMessage.text;
      }
    });
    rl.on("close", () => resolve(latest.replace(/\s+/g, " ").trim().slice(0, 120)));
    stream.on("error", () => resolve(""));
  });
}

/** Stream the JSONL and keep the most-recent assistant message text. */
export async function readLastAssistantMessage(filepath: string): Promise<string> {
  return new Promise((resolve) => {
    const stream = createReadStream(filepath, { encoding: "utf8" });
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
    let latest = "";
    rl.on("line", (line) => {
      const ev = parseJsonlLine(line);
      if (ev?.kind === "assistant_message" && ev.assistantMessage?.text) {
        latest = ev.assistantMessage.text;
      }
    });
    rl.on("close", () => resolve(latest.trim()));
    stream.on("error", () => resolve(""));
  });
}
