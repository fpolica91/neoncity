import { WebSocketServer, WebSocket } from "ws";
import type { BridgeEvent, ClientCommand } from "../shared/protocol.js";
import { BRIDGE_WS_PORT } from "../shared/constants.js";

type MessageHandler = (cmd: ClientCommand, ws: WebSocket) => void;

export class WsBus {
  private wss: WebSocketServer;
  private clients = new Set<WebSocket>();
  private messageHandlers: MessageHandler[] = [];

  constructor() {
    this.wss = new WebSocketServer({ port: BRIDGE_WS_PORT });
    console.log(`WebSocket server on port ${BRIDGE_WS_PORT}`);

    this.wss.on("connection", (ws) => {
      this.clients.add(ws);
      console.log(`Client connected (${this.clients.size} total)`);

      ws.on("message", (data) => {
        try {
          const cmd: ClientCommand = JSON.parse(data.toString());
          for (const handler of this.messageHandlers) {
            handler(cmd, ws);
          }
        } catch (err) {
          console.error("Invalid client message:", err);
        }
      });

      ws.on("close", () => {
        this.clients.delete(ws);
        console.log(`Client disconnected (${this.clients.size} total)`);
      });
    });
  }

  /** Register handler for client commands */
  onCommand(handler: MessageHandler): void {
    this.messageHandlers.push(handler);
  }

  /** Broadcast event to all connected clients */
  broadcast(event: BridgeEvent): void {
    const data = JSON.stringify(event);
    if (event.type === "session:start" || event.type === "session:stop") {
      const sid = (event.payload as { sessionId?: string }).sessionId;
      console.log(`[ws.broadcast] ${event.type} sid=${sid?.slice(0, 8)} clients=${this.clients.size}`);
    }
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }

  /** Send event to a specific client */
  send(ws: WebSocket, event: BridgeEvent): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(event));
    }
  }
}
