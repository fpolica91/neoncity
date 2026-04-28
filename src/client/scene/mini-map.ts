import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { Camera } from "@babylonjs/core/Cameras/camera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { RenderTargetTexture } from "@babylonjs/core/Materials/Textures/renderTargetTexture";
import {
  AdvancedDynamicTexture,
  Rectangle,
  TextBlock,
  Control,
  Image,
} from "@babylonjs/gui/2D";
import type { Scene } from "@babylonjs/core/scene";
import type { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import type { DistrictTheme } from "../../shared/protocol";
import { DISTRICT_THEMES } from "../../shared/protocol";

const MINIMAP_SIZE = 200;

function districtHex(district?: DistrictTheme): string {
  if (district && DISTRICT_THEMES[district]) {
    const c = DISTRICT_THEMES[district].primaryColor;
    const r = Math.round(c.r * 255).toString(16).padStart(2, "0");
    const g = Math.round(c.g * 255).toString(16).padStart(2, "0");
    const b = Math.round(c.b * 255).toString(16).padStart(2, "0");
    return `#${r}${g}${b}`;
  }
  return "#00ffc8";
}

export class MiniMap {
  private minimapTexture: DynamicTexture;
  private container: Rectangle;
  private label: TextBlock;
  private mainCamera: ArcRotateCamera;
  private scene: Scene;
  private projectDots: { x: number; z: number; color: string; district?: DistrictTheme }[] = [];

  constructor(gui: AdvancedDynamicTexture, mainCamera: ArcRotateCamera, scene: Scene) {
    this.mainCamera = mainCamera;
    this.scene = scene;

    // Container in bottom-left corner
    this.container = new Rectangle("minimap-container");
    this.container.width = `${MINIMAP_SIZE}px`;
    this.container.height = `${MINIMAP_SIZE}px`;
    this.container.cornerRadius = 8;
    this.container.thickness = 1;
    this.container.color = "rgba(0, 200, 160, 0.3)";
    this.container.background = "rgba(0, 5, 15, 0.9)";
    this.container.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.container.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    this.container.left = "15px";
    this.container.top = "-65px";
    gui.addControl(this.container);

    // Minimap rendered as a dynamic texture
    this.minimapTexture = new DynamicTexture("minimap-tex", MINIMAP_SIZE, scene, true);

    this.label = new TextBlock("minimap-label");
    this.label.text = "DISTRICT MAP";
    this.label.color = "#00ffc8";
    this.label.fontSize = 9;
    this.label.fontFamily = "monospace";
    this.label.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.label.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.label.top = "5px";
    this.container.addControl(this.label);

    // Initial render
    this.render();
  }

  updateProjects(projects: Map<string, { name: string; position: { x: number; z: number }; health: string; district?: DistrictTheme }>): void {
    this.projectDots = [];
    for (const p of projects.values()) {
      this.projectDots.push({
        x: p.position.x,
        z: p.position.z,
        district: p.district,
        color: p.health === "healthy" ? districtHex(p.district) :
               p.health === "warning" ? "#ffcc00" :
               p.health === "error" ? "#ff4466" : "#334455",
      });
    }
    this.render();
  }

  private render(): void {
    const ctx = this.minimapTexture.getContext();
    const size = MINIMAP_SIZE;

    // Dark background
    ctx.fillStyle = "#050810";
    ctx.fillRect(0, 0, size, size);

    // Grid
    ctx.strokeStyle = "rgba(0, 100, 90, 0.1)";
    ctx.lineWidth = 0.5;
    for (let i = 0; i < size; i += 20) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(size, i);
      ctx.stroke();
    }

    // Draw transit connections between adjacent dots
    ctx.strokeStyle = "rgba(0, 80, 70, 0.2)";
    ctx.lineWidth = 1;
    for (let i = 0; i < this.projectDots.length - 1; i++) {
      const a = this.projectDots[i];
      const b = this.projectDots[i + 1];
      const scale = 1.5;
      const cx = size / 2;
      const cy = size / 2;
      ctx.beginPath();
      ctx.moveTo(cx + a.x * scale, cy + a.z * scale);
      ctx.lineTo(cx + b.x * scale, cy + b.z * scale);
      ctx.stroke();
    }

    // Project dots
    const scale = 1.5;
    const centerX = size / 2;
    const centerY = size / 2;

    for (const dot of this.projectDots) {
      const sx = centerX + dot.x * scale;
      const sy = centerY + dot.z * scale;

      // Glow
      ctx.fillStyle = dot.color + "40";
      ctx.beginPath();
      ctx.arc(sx, sy, 6, 0, Math.PI * 2);
      ctx.fill();

      // Dot
      ctx.fillStyle = dot.color;
      ctx.beginPath();
      ctx.arc(sx, sy, 3, 0, Math.PI * 2);
      ctx.fill();

      // District label
      if (dot.district && DISTRICT_THEMES[dot.district]) {
        ctx.fillStyle = dot.color + "99";
        ctx.font = "7px monospace";
        ctx.fillText(DISTRICT_THEMES[dot.district].tag, sx + 5, sy + 2);
      }
    }

    // Camera position indicator
    const camTarget = this.mainCamera.target;
    const camX = centerX + camTarget.x * scale;
    const camY = centerY + camTarget.z * scale;
    ctx.strokeStyle = "#ffffff80";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(camX, camY, 8, 0, Math.PI * 2);
    ctx.stroke();

    this.minimapTexture.update();
  }

  dispose(): void {
    this.container.dispose();
    this.minimapTexture.dispose();
  }
}
