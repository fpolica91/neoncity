import { SessionStore } from "./session-store.js";
import { WsBus } from "./ws-bus.js";
import { createServer } from "./server.js";
import { sendPrompt, cancelSession } from "./claude-control.js";
import { TranscriptWatcher } from "./transcript-watcher.js";
import { Pinboard } from "./pinboard.js";
import { Mailbox } from "./mailbox.js";

async function main() {
  console.log("NeonCity bridge starting...");

  const store = new SessionStore();
  const bus = new WsBus();
  const pinboard = new Pinboard();
  const mailbox = new Mailbox();

  // Route store events to WebSocket clients
  store.onEvent((event) => {
    bus.broadcast(event);
  });

  // Route pinboard mutations to clients
  pinboard.onChange((ev) => {
    if (ev.kind === "added" && ev.pin) {
      bus.broadcast({ type: "pin:added", payload: ev.pin });
    } else if (ev.kind === "removed" && ev.id) {
      bus.broadcast({ type: "pin:removed", payload: { id: ev.id } });
    }
  });

  // Route mailbox mutations to clients
  mailbox.onChange((ev) => {
    if (ev.kind === "added") {
      bus.broadcast({ type: "mail:added", payload: ev.mail });
    } else if (ev.kind === "read_all") {
      bus.broadcast({ type: "mail:read_all", payload: {} });
    }
  });

  // Handle client commands
  bus.onCommand((cmd, _ws) => {
    switch (cmd.type) {
      case "subscribe": {
        const sync = store.getFullSync();
        sync.pins = pinboard.list();
        sync.mail = mailbox.list();
        bus.send(_ws, { type: "state:full_sync", payload: sync });
        break;
      }
      case "pin:add": {
        const text = (cmd.payload.text || "").trim();
        if (text) pinboard.add(text, cmd.payload.color);
        break;
      }
      case "pin:remove": {
        pinboard.remove(cmd.payload.id);
        break;
      }
      case "mail:send": {
        const text = (cmd.payload.text || "").trim();
        if (text) mailbox.add(text);
        break;
      }
      case "mail:read_all": {
        mailbox.markAllRead();
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
