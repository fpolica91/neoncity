import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Animation } from "@babylonjs/core/Animations/animation";
import type { Scene } from "@babylonjs/core/scene";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { COLORS } from "../../shared/constants";

const AGENT_TYPES: Record<string, { color: Color3; shape: "capsule" | "cube" | "sphere" }> = {
  Explore: { color: new Color3(0, 0.9, 0.8), shape: "sphere" },
  Plan: { color: new Color3(1, 0.9, 0.2), shape: "cube" },
  Bash: { color: new Color3(1, 0.5, 0.1), shape: "capsule" },
  general: { color: new Color3(0.7, 0.2, 1), shape: "capsule" },
};

export class AgentAvatar {
  readonly root: TransformNode;
  private body: import("@babylonjs/core/Meshes/mesh").Mesh;
  private ring: import("@babylonjs/core/Meshes/mesh").Mesh;
  private label: { mesh: import("@babylonjs/core/Meshes/mesh").Mesh; texture: DynamicTexture; mat: StandardMaterial } | null = null;
  private mat: StandardMaterial;
  private ringMat: StandardMaterial;
  private scene: Scene;
  private type: string;
  private state: "idle" | "thinking" | "executing" | "error" = "idle";
  private floatOffset = 0;
  private currentTool: string | null = null;
  private observer: import("@babylonjs/core/Misc/observable").Observer<import("@babylonjs/core/scene").Scene> | null = null;
  readonly agentId: string;
  private disposed = false;

  constructor(
    agentId: string,
    agentType: string,
    parent: TransformNode,
    floorY: number,
    scene: Scene
  ) {
    this.scene = scene;
    this.type = agentType;
    this.agentId = agentId;
    this.root = new TransformNode(`agent-${agentId}`, scene);
    this.root.parent = parent;
    this.root.position.y = floorY + 1.5;
    this.root.position.x = (Math.random() - 0.5) * 3;
    this.root.position.z = (Math.random() - 0.5) * 3;

    const config = AGENT_TYPES[agentType] || AGENT_TYPES.general;

    // Body
    this.body = MeshBuilder.CreateSphere(`agent-body-${agentId}`, { diameter: 0.6 }, scene);
    this.body.parent = this.root;

    this.mat = new StandardMaterial(`agent-mat-${agentId}`, scene);
    this.mat.diffuseColor = config.color.scale(0.3);
    this.mat.emissiveColor = config.color.scale(0.6);
    this.mat.specularColor = Color3.Black();
    this.body.material = this.mat;

    // Orbiting ring
    this.ring = MeshBuilder.CreateTorus(`agent-ring-${agentId}`, {
      diameter: 1,
      thickness: 0.05,
      tessellation: 24,
    }, scene);
    this.ring.parent = this.root;
    this.ring.scaling.y = 0.3;

    this.ringMat = new StandardMaterial(`agent-ring-mat-${agentId}`, scene);
    this.ringMat.diffuseColor = config.color.scale(0.2);
    this.ringMat.emissiveColor = config.color.scale(0.4);
    this.ringMat.alpha = 0.6;
    this.ring.material = this.ringMat;

    // Spawn animation — scale from 0
    this.root.scaling = Vector3.Zero();
    const anim = new Animation("spawn", "scaling", 60, Animation.ANIMATIONTYPE_VECTOR3, Animation.ANIMATIONLOOPMODE_CONSTANT);
    anim.setKeys([
      { frame: 0, value: Vector3.Zero() },
      { frame: 15, value: new Vector3(1.3, 1.3, 1.3) },
      { frame: 20, value: new Vector3(1, 1, 1) },
    ]);
    scene.beginDirectAnimation(this.root, [anim], 0, 20, false);

    // Start floating
    this.float();
  }

  setState(state: "idle" | "thinking" | "executing" | "error"): void {
    this.state = state;
    const config = AGENT_TYPES[this.type] || AGENT_TYPES.general;

    switch (state) {
      case "thinking":
        this.mat.emissiveColor = config.color.scale(0.8);
        this.ringMat.emissiveColor = config.color.scale(0.6);
        this.ringMat.alpha = 0.8;
        break;
      case "executing":
        this.mat.emissiveColor = config.color;
        this.ringMat.emissiveColor = config.color.scale(0.8);
        this.ringMat.alpha = 1;
        // Speed up ring rotation while executing
        break;
      case "error":
        this.mat.emissiveColor = new Color3(1, 0.2, 0.2);
        this.ringMat.emissiveColor = new Color3(1, 0.2, 0.2);
        this.ringMat.alpha = 0.7;
        break;
      default:
        this.mat.emissiveColor = config.color.scale(0.5);
        this.ringMat.emissiveColor = config.color.scale(0.3);
        this.ringMat.alpha = 0.6;
    }
  }

  setCurrentTool(toolName: string): void {
    this.currentTool = toolName;
    this.renderLabel();
  }

  private renderLabel(): void {
    const text = this.currentTool || this.type;
    const config = AGENT_TYPES[this.type] || AGENT_TYPES.general;

    if (!this.label) {
      const texture = new DynamicTexture(`agent-label-${this.agentId}`, { width: 256, height: 64 }, this.scene, true);
      const mat = new StandardMaterial(`agent-label-mat-${this.agentId}`, this.scene);
      mat.backFaceCulling = false;
      mat.useAlphaFromDiffuseTexture = true;

      const mesh = MeshBuilder.CreatePlane(`agent-label-plane-${this.agentId}`, { width: 2, height: 0.5 }, this.scene);
      mesh.parent = this.root;
      mesh.position.y = 0.8;
      mesh.billboardMode = 7; // billboard all axes

      this.label = { mesh, texture, mat };
      mesh.material = mat;
    }

    const ctx = this.label.texture.getContext();
    ctx.clearRect(0, 0, 256, 64);
    ctx.font = "bold 28px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = `rgba(${config.color.r * 255}, ${config.color.g * 255}, ${config.color.b * 255}, 0.9)`;
    ctx.shadowBlur = 12;
    ctx.fillStyle = `rgba(${config.color.r * 255}, ${config.color.g * 255}, ${config.color.b * 255}, 1)`;
    ctx.fillText(text.toUpperCase(), 128, 32);
    this.label.texture.update();
    this.label.mat.diffuseTexture = this.label.texture;
    this.label.mat.emissiveTexture = this.label.texture;
    this.label.mat.emissiveColor = config.color.scale(0.3);
  }

  /** Move to a target position relative to parent */
  moveTo(targetX: number, targetZ: number, durationMs: number = 1200): void {
    if (this.disposed) return;

    const startX = this.root.position.x;
    const startZ = this.root.position.z;

    const animX = new Animation("moveX", "position.x", 60, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CONSTANT);
    animX.setKeys([
      { frame: 0, value: startX },
      { frame: 60, value: targetX },
    ]);

    const animZ = new Animation("moveZ", "position.z", 60, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CONSTANT);
    animZ.setKeys([
      { frame: 0, value: startZ },
      { frame: 60, value: targetZ },
    ]);

    const frames = Math.round((durationMs / 1000) * 60);
    animX.setKeys([{ frame: 0, value: startX }, { frame: frames, value: targetX }]);
    animZ.setKeys([{ frame: 0, value: startZ }, { frame: frames, value: targetZ }]);

    this.scene.beginDirectAnimation(this.root, [animX, animZ], 0, frames, false);
  }

  /** Float up and down with sine wave + rotate ring */
  private float(): void {
    const speedMult = () => this.state === "executing" ? 0.06 : 0.03;

    this.observer = this.scene.registerBeforeRender(() => {
      if (this.disposed) return;
      this.floatOffset += speedMult();
      this.root.position.y += Math.sin(this.floatOffset) * 0.003;
      const ringSpeed = this.state === "executing" ? 0.05 : 0.02;
      this.ring.rotation.y += ringSpeed;
      this.ring.rotation.x += ringSpeed * 0.5;
    });
  }

  dissolve(): void {
    if (this.disposed) return;
    this.disposed = true;

    const anim = new Animation("dissolve", "scaling", 60, Animation.ANIMATIONTYPE_VECTOR3, Animation.ANIMATIONLOOPMODE_CONSTANT);
    anim.setKeys([
      { frame: 0, value: this.root.scaling.clone() },
      { frame: 15, value: Vector3.Zero() },
    ]);

    this.scene.beginDirectAnimation(this.root, [anim], 0, 15, false, 1, () => {
      this.dispose();
    });
  }

  dispose(): void {
    this.disposed = true;
    if (this.observer) {
      this.scene.unregisterBeforeRender(this.observer as any);
      this.observer = null;
    }
    this.body.dispose();
    this.ring.dispose();
    this.mat.dispose();
    this.ringMat.dispose();
    if (this.label) {
      this.label.mesh.dispose();
      this.label.texture.dispose();
      this.label.mat.dispose();
    }
    this.root.dispose();
  }
}
