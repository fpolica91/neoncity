import { watch } from "node:fs";
import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { existsSync } from "node:fs";
import type { SessionStore } from "./session-store.js";

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
  sessionId?: string;
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
    try {
      const projectDirs = await readdir(PROJECTS_DIR);

      for (const dir of projectDirs) {
        const projectPath = join(PROJECTS_DIR, dir);
        const statResult = await stat(projectPath);
        if (!statResult.isDirectory()) continue;

        const files = await readdir(projectPath);
        const jsonlFiles = files
          .filter((f) => f.endsWith(".jsonl"))
          .sort()
          .reverse(); // newest first

        // Only recover last 3 sessions per project
        let recovered = 0;
        for (const file of jsonlFiles) {
          if (recovered >= 3) break;

          const filePath = join(projectPath, file);
          const sessionId = file.replace(".jsonl", "");

          try {
            const content = await readFile(filePath, "utf-8");
            const lines = content.split("\n").filter((l) => l.trim());
            if (lines.length === 0) continue;

            // Parse first line to get cwd
            const first: TranscriptEntry = JSON.parse(lines[0]);
            const cwd = first.cwd || "/" + dir.slice(1).replace(/-/g, "/");
            const projectId = this.store.getProjectId(cwd);

            // Mark this session as known
            this.knownSessions.set(sessionId, projectId);
            recovered++;
          } catch {
            // Skip malformed files
          }
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
