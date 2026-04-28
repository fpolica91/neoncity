import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Animation } from "@babylonjs/core/Animations/animation";
import type { Scene } from "@babylonjs/core/scene";
import { GRID, COLORS } from "../../shared/constants";
import { createFloor } from "./floor";
import { createNeonSign } from "./neon-sign";
import {
  createBuildingBaseMaterial,
} from "../scene/materials";

const FOOTPRINT = GRID.buildingFootprint;
const FLOOR_HEIGHT = 1.5;

export interface BuildingConfig {
  name: string;
  taskCount: number;
  health: string;
  position: { x: number; z: number };
}

export class Building {
  readonly root: TransformNode;
  private baseMesh: import("@babylonjs/core/Meshes/mesh").Mesh;
  private floors: import("@babylonjs/core/Meshes/mesh").Mesh[] = [];
  private sign: ReturnType<typeof createNeonSign>;
  private light: PointLight;
  private config: BuildingConfig;

  constructor(config: BuildingConfig, scene: Scene) {
    this.config = config;
    this.root = new TransformNode(`building-${config.name}`, scene);
    this.root.position.x = config.position.x;
    this.root.position.z = config.position.z;

    // Base
    const baseMat = createBuildingBaseMaterial(scene);
    this.baseMesh = MeshBuilder.CreateBox(
      `base-${config.name}`,
      { width: FOOTPRINT, height: 0.5, depth: FOOTPRINT },
      scene
    );
    this.baseMesh.parent = this.root;
    this.baseMesh.position.y = 0.25;
    this.baseMesh.material = baseMat;

    // Floors — last floor is "under construction"
    for (let i = 0; i < config.taskCount; i++) {
      const floor = createFloor(i, i < config.taskCount - 1, scene);
      floor.parent = this.root;
      this.floors.push(floor);
    }

    // Neon sign
    this.sign = createNeonSign(config.name, config.health, scene);
    this.sign.mesh.parent = this.root;
    const totalHeight = config.taskCount * FLOOR_HEIGHT;
    this.sign.mesh.position.y = totalHeight * 0.5;
    this.sign.mesh.position.z = FOOTPRINT / 2 + 0.1;
    this.sign.mesh.rotation.y = 0;

    // Point light for glow
    const healthColor = this.getHealthColor();
    this.light = new PointLight(
      `light-${config.name}`,
      new Vector3(0, totalHeight * 0.6, 0),
      scene
    );
    this.light.parent = this.root;
    this.light.diffuse = new Color3(healthColor.r, healthColor.g, healthColor.b);
    this.light.intensity = config.health === "idle" ? 0.3 : 1.2;
    this.light.range = 15;

    // Entrance animation — grow from ground
    this.animateEntrance(scene);
  }

  private getHealthColor(): { r: number; g: number; b: number } {
    switch (this.config.health) {
      case "healthy": return COLORS.neon.cyan;
      case "warning": return COLORS.neon.yellow;
      case "error": return COLORS.neon.red;
      default: return { r: 0.3, g: 0.3, b: 0.4 };
    }
  }

  private animateEntrance(scene: Scene): void {
    // Scale Y from 0 to 1 over 1.5 seconds with delay based on distance from center
    const dist = Math.sqrt(
      this.config.position.x ** 2 + this.config.position.z ** 2
    );
    const delay = dist * 30; // stagger by distance

    this.root.scaling.y = 0.01;

    const anim = new Animation(
      "entrance",
      "scaling.y",
      60,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );

    anim.setKeys([
      { frame: 0, value: 0.01 },
      { frame: 30, value: 1.0 },
    ]);

    const animatable = scene.beginDirectAnimation(
      this.root,
      [anim],
      0,
      30,
      false,
      1,
      () => {
        // Animation complete
      }
    );

    // Delay the start
    setTimeout(() => {
      animatable.start();
    }, delay);
  }

  updateHealth(health: string): void {
    this.config.health = health;
    this.sign.updateHealth(health);
    const color = this.getHealthColor();
    this.light.diffuse = new Color3(color.r, color.g, color.b);
  }

  pulse(color: Color3, duration: number, scene: Scene): void {
    const originalIntensity = this.light.intensity;
    this.light.intensity = 3;
    this.light.diffuse = color;

    setTimeout(() => {
      this.light.intensity = originalIntensity;
      this.light.diffuse = new Color3(
        ...Object.values(this.getHealthColor()) as [number, number, number]
      );
    }, duration);
  }
}
