import { watch } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { existsSync } from "node:fs";
import type { SessionStore } from "./session-store.js";
import { readLastUserMessage } from "./jsonl-parser.js";

const RESUMABLE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 14; // 14 days
const PER_PROJECT_LIMIT = 30;

const CLAUDE_DIR = join(homedir(), ".claude");
const PROJECTS_DIR = join(CLAUDE_DIR, "projects");

interface TranscriptEntry {
  type: string;
  sessionId?: string;
  message?: {
    role?: string;
    content?: string | Array<{ type: string; text?: string }>;
    model?: string;
  };
  cwd?: string;
  timestamp?: string;
  uuid?: string;
}

/**
 * Watches ~/.claude/projects/ for transcript changes.
 * On startup, reads recent sessions to recover state.
 * Tails files for new entries and feeds them into the session store.
 */
export class TranscriptWatcher {
  private store: SessionStore;
  private watchers: Map<string, ReturnType<typeof watch>> = new Map();
  private knownSessions = new Map<string, string>(); // sessionId -> projectId

  constructor(store: SessionStore) {
    this.store = store;
  }

  async start(): Promise<void> {
    if (!existsSync(PROJECTS_DIR)) {
      console.log("No projects directory found, skipping transcript watch");
      return;
    }

    // Read existing transcripts for state recovery
    await this.recoverState();

    // Watch for new/changed transcripts
    this.watchDirectory();
  }

  private async recoverState(): Promise<void> {
    const cutoffMs = Date.now() - RESUMABLE_MAX_AGE_MS;
    try {
      const projectDirs = await readdir(PROJECTS_DIR);

      for (const dir of projectDirs) {
        const projectPath = join(PROJECTS_DIR, dir);
        const statResult = await stat(projectPath);
        if (!statResult.isDirectory()) continue;

        const cwd = "/" + dir.slice(1).replace(/-/g, "/");
        const projectId = this.store.getProjectId(cwd);

        const files = await readdir(projectPath);
        const candidates: Array<{ sessionId: string; filePath: string; mtimeMs: number; sizeBytes: number }> = [];
        for (const file of files) {
          if (!file.endsWith(".jsonl")) continue;
          const filePath = join(projectPath, file);
          try {
            const fst = await stat(filePath);
            if (fst.mtimeMs < cutoffMs) continue;
            if (fst.size === 0) continue;
            candidates.push({
              sessionId: file.replace(".jsonl", ""),
              filePath,
              mtimeMs: fst.mtimeMs,
              sizeBytes: fst.size,
            });
          } catch {
            // skip
          }
        }
        candidates.sort((a, b) => b.mtimeMs - a.mtimeMs);
        const top = candidates.slice(0, PER_PROJECT_LIMIT);

        for (const c of top) {
          const preview = await readLastUserMessage(c.filePath);
          if (!preview) continue; // empty / pure-noise sessions
          this.store.recoverSession(c.sessionId, cwd, {
            prompt: preview,
            startedAt: c.mtimeMs - 1000, // approximate; we don't read the start time
            lastActivityAt: c.mtimeMs,
          });
          this.knownSessions.set(c.sessionId, projectId);
        }
      }

      console.log(`Recovered ${this.knownSessions.size} sessions from transcripts`);
    } catch (err) {
      console.error("Transcript recovery failed:", err);
    }
  }

  private watchDirectory(): void {
    // Simple polling-based approach for new transcript files
    // In production, use chokidar for more robust file watching
    setInterval(async () => {
      try {
        const projectDirs = await readdir(PROJECTS_DIR);
        for (const dir of projectDirs) {
          const projectPath = join(PROJECTS_DIR, dir);
          try {
            const statResult = await stat(projectPath);
            if (!statResult.isDirectory()) continue;
          } catch {
            continue;
          }

          const files = await readdir(projectPath);
          for (const file of files) {
            if (!file.endsWith(".jsonl")) continue;
            const sessionId = file.replace(".jsonl", "");
            if (!this.knownSessions.has(sessionId)) {
              // New session discovered
              const cwd = "/" + dir.slice(1).replace(/-/g, "/");
              const projectId = this.store.getProjectId(cwd);
              this.knownSessions.set(sessionId, projectId);
            }
          }
        }
      } catch {
        // Ignore errors during polling
      }
    }, 10000); // Poll every 10 seconds
  }

  stop(): void {
    for (const watcher of this.watchers.values()) {
      watcher.close();
    }
    this.watchers.clear();
  }
}
