import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { randomUUID } from "node:crypto";
import type { PinModel, PinColor } from "../shared/protocol.js";

const STORAGE_DIR = join(homedir(), ".neoncity");
const STORAGE_PATH = join(STORAGE_DIR, "pins.json");
const COLORS: PinColor[] = ["yellow", "pink", "cyan", "green"];
const MAX_LEN = 240;

type Listener = (event: { kind: "added" | "removed"; pin?: PinModel; id?: string }) => void;

export class Pinboard {
  private pins: PinModel[] = [];
  private listeners: Listener[] = [];

  constructor() {
    this.load();
  }

  private load(): void {
    try {
      if (!existsSync(STORAGE_PATH)) return;
      const raw = readFileSync(STORAGE_PATH, "utf8");
      const data = JSON.parse(raw) as PinModel[];
      if (Array.isArray(data)) {
        this.pins = data.filter(
          (p) => p && typeof p.id === "string" && typeof p.text === "string",
        );
      }
    } catch (err) {
      console.error("[pinboard] load failed:", err);
    }
  }

  private persist(): void {
    try {
      if (!existsSync(STORAGE_DIR)) mkdirSync(STORAGE_DIR, { recursive: true });
      writeFileSync(STORAGE_PATH, JSON.stringify(this.pins, null, 2), "utf8");
    } catch (err) {
      console.error("[pinboard] persist failed:", err);
    }
  }

  list(): PinModel[] {
    return [...this.pins];
  }

  add(text: string, color?: PinColor): PinModel {
    const trimmed = text.trim().slice(0, MAX_LEN);
    const pin: PinModel = {
      id: randomUUID(),
      text: trimmed,
      color: color || COLORS[Math.floor(Math.random() * COLORS.length)],
      createdAt: Date.now(),
    };
    this.pins.push(pin);
    this.persist();
    for (const l of this.listeners) l({ kind: "added", pin });
    return pin;
  }

  remove(id: string): boolean {
    const before = this.pins.length;
    this.pins = this.pins.filter((p) => p.id !== id);
    if (this.pins.length === before) return false;
    this.persist();
    for (const l of this.listeners) l({ kind: "removed", id });
    return true;
  }

  onChange(l: Listener): void {
    this.listeners.push(l);
  }
}
