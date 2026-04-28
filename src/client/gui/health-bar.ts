import {
  TextBlock,
  Rectangle,
  Control,
} from "@babylonjs/gui/2D";
import type { AdvancedDynamicTexture } from "@babylonjs/gui/2D";

/**
 * Floating health indicator above each building in the GUI layer.
 */
export class HealthBar {
  private bar: Rectangle;
  private fill: Rectangle;
  private label: TextBlock;
  private gui: AdvancedDynamicTexture;

  constructor(gui: AdvancedDynamicTexture, name: string) {
    this.gui = gui;

    this.bar = new Rectangle(`health-bar-${name}`);
    this.bar.width = "60px";
    this.bar.height = "6px";
    this.bar.cornerRadius = 3;
    this.bar.thickness = 1;
    this.bar.color = "rgba(0, 200, 160, 0.3)";
    this.bar.background = "rgba(0, 0, 0, 0.5)";
    this.bar.isVisible = false;
    gui.addControl(this.bar);

    this.fill = new Rectangle(`health-fill-${name}`);
    this.fill.width = "100%";
    this.fill.height = "100%";
    this.fill.thickness = 0;
    this.fill.background = "#00ffc8";
    this.fill.cornerRadius = 2;
    this.bar.addControl(this.fill);

    this.label = new TextBlock(`health-label-${name}`);
    this.label.text = "";
    this.label.color = "#00ffc8";
    this.label.fontSize = 10;
    this.label.fontFamily = "monospace";
    this.label.isVisible = false;
    gui.addControl(this.label);
  }

  update(health: string, errorCount: number): void {
    switch (health) {
      case "healthy":
        this.fill.background = "#00ffc8";
        this.fill.width = "100%";
        this.label.color = "#00ffc8";
        break;
      case "warning":
        this.fill.background = "#ffcc00";
        this.fill.width = `${Math.max(30, 80 - errorCount * 10)}%`;
        this.label.color = "#ffcc00";
        break;
      case "error":
        this.fill.background = "#ff4466";
        this.fill.width = `${Math.max(15, 60 - errorCount * 10)}%`;
        this.label.color = "#ff4466";
        break;
      case "idle":
      default:
        this.fill.background = "#334";
        this.fill.width = "10%";
        this.label.color = "#556";
        break;
    }
  }

  dispose(): void {
    this.bar.dispose();
    this.label.dispose();
  }
}
