import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { randomUUID } from "node:crypto";
import type { MailModel } from "../shared/protocol.js";

const STORAGE_DIR = join(homedir(), ".neoncity");
const STORAGE_PATH = join(STORAGE_DIR, "mail.json");
const MAX_LEN = 2000;
const MAX_KEEP = 200;

type Listener = (event:
  | { kind: "added"; mail: MailModel }
  | { kind: "read_all" }
) => void;

export class Mailbox {
  private mail: MailModel[] = [];
  private listeners: Listener[] = [];

  constructor() {
    this.load();
  }

  private load(): void {
    try {
      if (!existsSync(STORAGE_PATH)) return;
      const raw = readFileSync(STORAGE_PATH, "utf8");
      const data = JSON.parse(raw) as MailModel[];
      if (Array.isArray(data)) {
        this.mail = data
          .filter((m) => m && typeof m.id === "string" && typeof m.text === "string")
          .slice(-MAX_KEEP);
      }
    } catch (err) {
      console.error("[mailbox] load failed:", err);
    }
  }

  private persist(): void {
    try {
      if (!existsSync(STORAGE_DIR)) mkdirSync(STORAGE_DIR, { recursive: true });
      writeFileSync(STORAGE_PATH, JSON.stringify(this.mail, null, 2), "utf8");
    } catch (err) {
      console.error("[mailbox] persist failed:", err);
    }
  }

  list(): MailModel[] {
    return [...this.mail];
  }

  add(text: string): MailModel {
    const m: MailModel = {
      id: randomUUID(),
      text: text.trim().slice(0, MAX_LEN),
      createdAt: Date.now(),
      read: false,
    };
    this.mail.push(m);
    if (this.mail.length > MAX_KEEP) this.mail = this.mail.slice(-MAX_KEEP);
    this.persist();
    for (const l of this.listeners) l({ kind: "added", mail: m });
    return m;
  }

  markAllRead(): void {
    let changed = false;
    for (const m of this.mail) {
      if (!m.read) {
        m.read = true;
        changed = true;
      }
    }
    if (!changed) return;
    this.persist();
    for (const l of this.listeners) l({ kind: "read_all" });
  }

  onChange(l: Listener): void {
    this.listeners.push(l);
  }
}
