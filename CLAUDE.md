# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**NeonCity** is a 3D cyberpunk-themed visual interface for [Claude Code](https://claude.com/claude-code). Five named agents (ARIA, KAI, RUNE, LYNX, ECHO) wander a procedurally-generated neon cityscape. Click one to open a chat box, pick a project from the dropdown, and your prompt is dispatched to a headless `claude` CLI in that project's cwd. While the agent is working it walks to its desk and types; when the response comes back it appears in the chat log and the agent goes idle. There's also a session picker for resuming prior conversations and a force-release button to kill stuck runs.

The system has two cooperating processes that you almost always run together:

1. **Bridge** (Node, `src/bridge/`) — long-lived backend. Ingests Claude Code hook events over HTTP, mirrors them into an in-memory model, and broadcasts `BridgeEvent`s to browser clients over WebSocket. Also scans `~/.claude/projects/` and tails recent transcripts to seed the session picker.
2. **Client** (Vite + THREE.js r99, `src/client/main.ts`) — the 3D city in the browser. The client is intentionally a single file (~690 lines): scene, camera, agents, HTML overlay UI, WebSocket connection, and event handling all live here.

`src/shared/` holds the wire protocol and a few constants used by both processes.

## Commands

```bash
npm install                 # one-time
npm run bridge              # bridge backend (HTTP :3777, WS :3778). Run alongside `dev`.
npm run dev                 # vite dev server on :5173, opens browser
npm run build               # tsc type-check + vite production build
npm run preview             # preview the production build
```

There is **no test runner, linter, or formatter configured** — `tsc --noEmit` (via `npm run build`) is the only static check. The bridge runs straight from TypeScript via `tsx`; only the client is bundled.

`src/client/main.ts` has `// @ts-nocheck` at the top because three.js r99 ships legacy types — type-checking is effectively only enforced on the bridge and shared layers.

For the city to react to live activity from a project (real Claude Code sessions, not just the chat box), that project needs `.claude/settings.json` hooks pointing at `http://localhost:3777/hooks/<EventName>`. This repo's own `.claude/settings.json` is the canonical template — copy it into other projects.

## Architecture

### Event flow

```
Claude Code (any project)
        │  POSTs hook events
        ▼
Bridge HTTP server (:3777, server.ts)
        │  routeEvent → SessionStore mutators
        ▼
SessionStore (session-store.ts)        ◄─── ProjectScanner (one-shot at boot)
        │  emits BridgeEvent           ◄─── TranscriptWatcher (recoverSession + 10s poll)
        ▼
WsBus broadcast (:3778)
        │
        ▼
Browser (src/client/main.ts)
        │
        ├──▶ projectPicker / sessionPicker  (driven by state:full_sync)
        ├──▶ pulse + status sprite          (driven by session:tool_pre)
        └──▶ chat log + release agent       (driven by session:stop with lastMessage)
```

Outbound (chat box → headless Claude): the client sends `prompt:send` over WS with `{ projectPath, prompt, sessionId? }`. `claude-control.ts` spawns `claude -p --output-format stream-json --verbose --dangerously-skip-permissions` in the project's cwd, prepending `--resume <sessionId>` when one is provided. Stream output is parsed line-by-line; the final `result/success` payload becomes the `lastMessage` on `session:stop`.

### Directory map

- `src/shared/protocol.ts` — **the contract**. `BridgeEvent` (server→client), `ClientCommand` (client→server, includes `session:cancel`), `HookEvent` (Claude→bridge), all model types, `DistrictTheme`/`DISTRICT_THEMES`, and `classifyDistrict()`. Districts are defined here but **the current client doesn't visually distinguish them** — they're carried in the model for future use.
- `src/shared/constants.ts` — color palette, grid sizing, hardcoded `DEMO_PROJECTS` (unused), and the two ports (`BRIDGE_HTTP_PORT=3777`, `BRIDGE_WS_PORT=3778`).
- `src/shared/city-layout.ts` — `layoutSlots(count)`: deterministic spiral grid placement. Used by `SessionStore.assignLayout()`.
- `src/shared/storyline.ts` — **dead code.** A complete mission/faction/progression engine that nothing imports. Either revive it or delete it; don't trust the comments inside.
- `src/bridge/index.ts` — process entrypoint. Wires SessionStore ↔ WsBus ↔ HTTP server ↔ TranscriptWatcher. Routes `ClientCommand`s: `subscribe` → send full sync, `prompt:send` / `session:create` → `sendPrompt`, `session:cancel` → `cancelSession`.
- `src/bridge/session-store.ts` — the only place that mutates project/session/task/agent state and emits `BridgeEvent`s. Includes `recoverSession(id, cwd, { prompt, startedAt, lastActivityAt })` for inserting sessions read from disk **without** emitting an event (so the picker populates but the city doesn't trigger animations on stale history). All other mutators emit.
- `src/bridge/server.ts` — Fastify routes (`GET /health`, `POST /hooks/:eventName`, `GET /state`). The `routeEvent` switch is the canonical mapping from Claude hook names to store mutators.
- `src/bridge/ws-bus.ts` — WebSocket fanout (:3778). Receives `ClientCommand`s and dispatches to handlers registered via `onCommand`. Sends `BridgeEvent`s to clients via `broadcast`/`send`. The initial `state:full_sync` is delivered in response to a `subscribe` command, **not** automatically on connect.
- `src/bridge/claude-control.ts` — outbound side. Resolves the `claude` binary at startup via `zsh -lc "command -v claude"` (handles the case where `claude` is a shell alias). `sendPrompt(prompt, projectPath, store, bus, resumeSessionId?)` spawns a subprocess, tracks it in `activeProcs: Map<sessionId, ChildProcess>`, and synthesizes `session:start` / `session:prompt` / `session:stop` events into the store. `cancelSession(id)` sends SIGTERM and removes the entry. Cwd resolution uses `homedir()` from `node:os`.
- `src/bridge/project-scanner.ts` / `transcript-watcher.ts` — read `~/.claude/projects/`. The directory naming convention `/home/foo/bar` ↔ `-home-foo-bar` is **load-bearing**; `SessionStore.getProjectId()` and the scanner both rely on it. The watcher's `recoverState()` reads up to 3 recent `.jsonl` files per project, extracts the first user prompt and timestamps, and calls `recoverSession()`. It also polls every 10s for new transcript files but does **not** emit events for them.
- `src/bridge/types.ts` — bridge-internal types (`InternalProject`, `InternalSession`, etc.) not part of the wire protocol.
- `src/client/main.ts` — **everything client-side.** In order: renderer/scene/camera setup, manual orbit controls (drag-rotate, shift-drag pan, wheel zoom), procedural city backdrop (`createCity()` builds ~6000 box-instanced buildings with a canvas-generated window texture), agent factory (`makeAgent()` builds a humanoid mesh group + desk + monitor + name/status sprites), five hardcoded agent spawns, HTML overlay (`#help`, `#infoPanel`, `#chatBox`, `#chatLog` injected into the document), WebSocket client (`connectBridge`), event router (`handleBridgeEvent`), chat send (`send`), raycaster click handling, animation loop. There are no separate scene/, gui/, state/, audio/, or city/ subdirectories — they were collapsed during the THREE.js migration.

### Path encoding

Project IDs are derived from cwd by replacing `/` with `-` and prefixing `-`: `/Users/fabricio/foo` → `-Users-fabricio-foo`. This matches the directory layout under `~/.claude/projects/` (Claude Code's own convention) and is used as the canonical key in both processes. `SessionStore.getProjectId()` is the one place to derive it.

### TypeScript paths

Aliases `@shared/*`, `@client/*`, `@bridge/*` are configured in both `tsconfig.json` and `vite.config.ts`. In practice the codebase uses relative imports (`../shared/...`) — match the surrounding style when editing.

### What lives where on the client

The client only reacts to **four** `BridgeEvent` types (see `handleBridgeEvent` in `main.ts`):

- `state:full_sync` — populates `projectPicker` and `sessionPicker`. The session picker filters to UUID-format session IDs only (sessions spawned via `prompt:send` use `headless-<timestamp>` IDs that aren't valid `--resume` targets).
- `session:start` — claims a `pendingPromptAgent` (set when the user clicks Send) and binds it to the new sessionId in `sessionToAgent`.
- `session:tool_pre` — pulses the bound agent's torso color and writes the tool name to its status sprite.
- `session:stop` — appends `lastMessage` to the chat log and releases the agent. **Hook-fired Stop events without `lastMessage` are ignored**; only the close-event path through `claude-control.ts` carries final text.

Everything else from the bridge (task events, agent events, project discovery beyond the initial sync) is silently dropped on the floor today. If you want the city to visualize them, that's a feature, not a bug.

## Adding a new bridge event

1. Add the variant to the `BridgeEvent` union in `src/shared/protocol.ts`.
2. Add a mutator on `SessionStore` that updates internal maps and calls `this.emit({ type, payload })`.
3. Map the corresponding Claude hook name (or stream-json type) to the mutator in `src/bridge/server.ts` `routeEvent` and/or `claude-control.ts` `routeStreamEvent`.
4. Handle the event in `main.ts` `handleBridgeEvent`. Decide whether it should affect agent state, status sprites, the chat log, or the city backdrop.
5. If the event implies new persisted-snapshot state, extend `FullSyncPayload` and `getFullSync()` so reconnecting clients catch up.

## Conventions worth knowing

- **No persistence layer in the bridge** — it logs via `console` and holds all state in memory. Restarting the bridge drops live state but reseeds projects from `~/.claude/projects/` and session metadata from recent transcripts.
- **Side-effect resolution of the `claude` binary**: `claude-control.ts` runs `zsh -lc "unalias claude 2>/dev/null; command -v claude"` at module load. If you spawn the bridge from an environment where this command fails, the binary falls back to PATH lookup of `"claude"`. Don't move the resolution code out of the top-level — it's intentionally eager.
- **Session ID conventions**: real Claude Code sessions use UUIDs; chat-box-spawned sessions use `headless-<timestamp>`. The session picker in the UI filters to UUID-only because `claude --resume <id>` rejects non-UUID values.
- **Force-release**: clicking "force release" on a working agent sends `{ type: "session:cancel", payload: { sessionId } }` for every session bound to that agent in `sessionToAgent`. The bridge calls `cancelSession()` which SIGTERMs the tracked subprocess. This is the right escape hatch when an agent is stuck on `thinking…` and `proc.on("close")` hasn't fired.
- **Districts**: `classifyDistrict(path)` keyword-matches the project path and is part of the wire protocol, but the current `main.ts` doesn't render district color/style differences. If you re-enable that, do it by reading `project.district` off the full-sync payload.
- **`storyline.ts` is dead code.** Don't extend it casually. If you want missions/factions back, wire them into `main.ts` first; the file as it stands has no consumers.
- **`DEMO_PROJECTS` in `constants.ts` is also unused** — there's no fallback "demo city" anymore; `createCity()` generates a procedural backdrop independent of project state.
- **Five named agents are hardcoded** in `main.ts` (ARIA/KAI/RUNE/LYNX/ECHO with roles Researcher/Coder/Reviewer/Planner/Tester). Users can spawn extras via the "+ AGENT" button (uses `window.prompt` for name and role). Agents are not tied to projects — any agent can be sent to any project; the `sessionToAgent` map binds them at send-time.
- **Two camera modes via mouse**: drag = rotate (alpha/beta), shift-drag = pan, wheel = zoom. There's no on-screen control hint.
