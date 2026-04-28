import type { BridgeEvent, ClientCommand, FullSyncPayload } from "../shared/protocol";
import { BRIDGE_WS_PORT } from "../shared/constants";

type EventHandler = (event: BridgeEvent) => void;

export class Connection {
  private ws: WebSocket | null = null;
  private handlers: EventHandler[] = [];
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private url: string;

  constructor(host: string = location.hostname) {
    this.url = `ws://${host}:${BRIDGE_WS_PORT}`;
  }

  connect(): void {
    this.cleanup();

    console.log(`[NeonCity] Connecting to ${this.url}...`);
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      console.log("[NeonCity] Connected to bridge");
      this.send({ type: "subscribe" });
    };

    this.ws.onmessage = (event) => {
      try {
        const bridgeEvent: BridgeEvent = JSON.parse(event.data as string);
        for (const handler of this.handlers) {
          handler(bridgeEvent);
        }
      } catch (err) {
        console.error("[NeonCity] Failed to parse event:", err);
      }
    };

    this.ws.onclose = () => {
      console.log("[NeonCity] Disconnected, reconnecting in 3s...");
      this.reconnectTimer = setTimeout(() => this.connect(), 3000);
    };

    this.ws.onerror = () => {
      // onclose will fire after this
    };
  }

  send(cmd: ClientCommand): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(cmd));
    }
  }

  onEvent(handler: EventHandler): void {
    this.handlers.push(handler);
  }

  private cleanup(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.close();
      }
      this.ws = null;
    }
  }

  disconnect(): void {
    this.cleanup();
  }
}
