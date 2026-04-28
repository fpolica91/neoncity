import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import type { InternalProject } from "./types.js";

const CLAUDE_DIR = join(homedir(), ".claude");
const PROJECTS_DIR = join(CLAUDE_DIR, "projects");

/**
 * Scans ~/.claude/projects/ to discover known Claude Code projects.
 * Directory names are encoded paths (/home/user -> -home-user).
 */
export async function scanProjects(): Promise<Map<string, InternalProject>> {
  const projects = new Map<string, InternalProject>();

  try {
    const entries = await readdir(PROJECTS_DIR);

    for (const entry of entries) {
      const fullPath = join(PROJECTS_DIR, entry);
      const entryStat = await stat(fullPath);

      if (!entryStat.isDirectory()) continue;

      // Decode path: -home-fabricio -> /home/fabricio
      const decodedPath = "/" + entry.slice(1).replace(/-/g, "/");
      const name = decodedPath.split("/").pop() || entry;

      // Count transcript files to gauge activity
      let transcriptCount = 0;
      try {
        const files = await readdir(fullPath);
        transcriptCount = files.filter((f) => f.endsWith(".jsonl")).length;
      } catch {
        // Permission denied or similar
      }

      const project: InternalProject = {
        id: entry,
        name,
        path: decodedPath,
        health: "idle" as const,
        position: { x: 0, z: 0 }, // will be assigned by layout
        sessions: new Map(),
        tasks: new Map(),
        agents: new Map(),
      };

      // Only include projects that have had at least one session
      if (transcriptCount > 0) {
        projects.set(project.id, project);
      }
    }
  } catch (err) {
    console.error("Failed to scan projects:", err);
  }

  return projects;
}
