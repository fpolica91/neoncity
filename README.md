# NeonCity

A 3D cyberpunk-themed visual interface for [Claude Code](https://claude.com/claude-code).

Five named agents — **ARIA**, **KAI**, **RUNE**, **LYNX**, **ECHO** — wander a procedurally-generated neon cityscape. Click one, pick a project from the dropdown, type a prompt, and the agent walks to its desk and starts typing while a headless `claude` CLI runs the request in that project's cwd. When the response comes back, it shows up in the chat log and the agent goes idle. There's a session picker for resuming prior conversations and a force-release button for killing stuck runs.

## Architecture at a glance

Two cooperating processes:

- **Bridge** (`src/bridge/`, Node + Fastify + `ws`) — ingests Claude Code hook events over HTTP, mirrors them into an in-memory model, broadcasts `BridgeEvent`s over WebSocket. Spawns and manages headless `claude` subprocesses for chat-box prompts. Scans `~/.claude/projects/` and reads recent transcripts to seed the session picker.
- **Client** (`src/client/main.ts`, Vite + THREE.js r99) — the entire 3D city in a single ~690-line file: scene, camera, agents, HTML overlay UI, and WebSocket client. Subscribes to the bridge and reacts to events.

`src/shared/` holds the wire protocol and a few constants used by both processes.

For the architectural deep-dive (event flow, file map, path-encoding convention, how to add a new bridge event), see [CLAUDE.md](./CLAUDE.md).

## Setup

```bash
npm install
```

Requirements: Node 20+, a working Claude Code install with state under `~/.claude/projects/` (the bridge reads this directory), and a `claude` binary resolvable from a login shell (the bridge resolves it via `zsh -lc "command -v claude"` to handle aliases).

## Run

You need both processes running together. In two terminals:

```bash
# terminal 1 — bridge backend (HTTP :3777, WS :3778)
npm run bridge

# terminal 2 — Vite dev server, auto-opens http://localhost:5173
npm run dev
```

The project picker populates from whatever already exists under `~/.claude/projects/`. The session picker fills with the most recent UUID-formatted sessions for the selected project (resumable via `claude --resume`).

To see *live* activity from a project (real Claude Code sessions, not just the chat box), that project needs hooks pointing at the bridge — see below.

## Using the city

- **Drag** to orbit the camera. **Shift+drag** to pan. **Mouse wheel** to zoom.
- **Click an agent** to select them. The info panel appears in the top-left and the chat box at the bottom unlocks.
- **Pick a project** in the top-right dropdown. Optionally pick a prior session to resume; leave it on "new conversation" to start fresh.
- **Type and send.** The agent transitions to a "working" state, walks to its desk, and types until the bridge reports `session:stop`. Their reply appears in the chat log.
- **Force release** appears on the info panel for working agents. It sends `session:cancel` to the bridge, which SIGTERMs the headless `claude` subprocess.
- **+ AGENT** spawns a custom agent with a name and role of your choosing.

## Wiring up a project for live events

Copy this repo's [`.claude/settings.json`](./.claude/settings.json) into any project you want to appear live. It registers HTTP hooks at `http://localhost:3777/hooks/<EventName>` for `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `Stop`, `SubagentStart`, `SubagentStop`, `TaskCreated`, `TaskCompleted`, and `SessionEnd`.

If the bridge isn't running, the hooks time out after 3s and Claude Code keeps working — NeonCity is purely observational (plus the optional chat box).

Today the client only visually reacts to a subset of these (`session:tool_pre` pulses the bound agent and updates its status sprite; `session:stop` posts the final message into the chat log). Task and subagent events are still ingested by the bridge but not yet rendered.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run bridge` | Bridge backend on `:3777` (HTTP) and `:3778` (WS), via `tsx`. |
| `npm run dev` | Vite dev server on `:5173`. |
| `npm run build` | `tsc --noEmit` type-check, then Vite production build. |
| `npm run preview` | Preview the production build. |

There is no test runner, linter, or formatter — `npm run build` is the only static check. `src/client/main.ts` uses `// @ts-nocheck` because three.js r99 has legacy types; type-checking is effectively only enforced on the bridge and shared layers.

## Tech stack

- **THREE.js r99** for 3D rendering. Locked to this version intentionally — the procedural building backdrop and agent meshes are built against its legacy API.
- **Fastify 5** + **ws 8** for the bridge.
- **chokidar** is a dependency but not currently wired up (transcript watching uses a plain 10s `setInterval` poll).
- **Vite 6** for the client dev server and bundling.

## Known caveats

- **Bridge state is in-memory only.** Restarting it drops live state but reseeds projects from `~/.claude/projects/` and session metadata from recent transcripts.
- **`src/shared/storyline.ts` is dead code** (a complete missions/factions/progression engine that nothing imports). Either revive it via `main.ts` or delete it; don't trust the comments inside as documentation of current behavior.
- **`src/shared/constants.ts:DEMO_PROJECTS` is unused** — the city backdrop is procedural and project-independent.
- **Districts (`classifyDistrict`) are computed but not visually applied** — the heuristic is part of the wire protocol but `main.ts` doesn't currently render district-specific colors or styles.
- **Headless session IDs aren't resumable.** Sessions spawned via the chat box use `headless-<timestamp>` IDs which `claude --resume` rejects. The session picker filters those out and only shows real UUID sessions.

## License

Not specified.
