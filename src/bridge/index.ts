import { SessionStore } from "./session-store.js";
import { WsBus } from "./ws-bus.js";
import { createServer } from "./server.js";
import { sendPrompt, cancelSession } from "./claude-control.js";
import { TranscriptWatcher } from "./transcript-watcher.js";

async function main() {
  console.log("NeonCity bridge starting...");

  const store = new SessionStore();
  const bus = new WsBus();

  // Route store events to WebSocket clients
  store.onEvent((event) => {
    bus.broadcast(event);
  });

  // Handle client commands
  bus.onCommand((cmd, _ws) => {
    switch (cmd.type) {
      case "subscribe": {
        const sync = store.getFullSync();
        bus.send(_ws, { type: "state:full_sync", payload: sync });
        break;
      }
      case "prompt:send": {
        const { projectPath, prompt, sessionId } = cmd.payload;
        console.log(
          `Prompt for ${projectPath}${sessionId ? ` (resume ${sessionId.slice(0, 8)}…)` : ""}: ${prompt}`,
        );
        sendPrompt(prompt, projectPath, store, bus, sessionId);
        break;
      }
      case "session:create": {
        const { projectPath, prompt } = cmd.payload;
        sendPrompt(prompt, projectPath, store, bus);
        break;
      }
      case "session:cancel": {
        const ok = cancelSession(cmd.payload.sessionId);
        console.log(`session:cancel sid=${cmd.payload.sessionId.slice(0, 8)} → ${ok ? "killed" : "not found"}`);
        break;
      }
      default:
        break;
    }
  });

  // Scan existing projects
  await store.initialize();

  // Start transcript watcher for state recovery
  const watcher = new TranscriptWatcher(store);
  await watcher.start();

  // Start HTTP hook server
  await createServer(store, bus);

  console.log("NeonCity bridge ready");
}

main().catch((err) => {
  console.error("Bridge failed:", err);
  process.exit(1);
});
