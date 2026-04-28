import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Animation } from "@babylonjs/core/Animations/animation";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import type { Scene } from "@babylonjs/core/scene";
import type { ProjectModel } from "../../shared/protocol";
import { DISTRICT_THEMES, type DistrictTheme } from "../../shared/protocol";
import { COLORS, GRID } from "../../shared/constants";

const FOOTPRINT = GRID.buildingFootprint;
const FLOOR_HEIGHT = 1.5;

const HEALTH_COLORS: Record<string, Color3> = {
  healthy: new Color3(COLORS.neon.cyan.r, COLORS.neon.cyan.g, COLORS.neon.cyan.b),
  warning: new Color3(COLORS.neon.yellow.r, COLORS.neon.yellow.g, COLORS.neon.yellow.b),
  error: new Color3(COLORS.neon.red.r, COLORS.neon.red.g, COLORS.neon.red.b),
  idle: new Color3(0.3, 0.3, 0.4),
};

function districtPrimary(district?: DistrictTheme): Color3 {
  if (district && DISTRICT_THEMES[district]) {
    const c = DISTRICT_THEMES[district].primaryColor;
    return new Color3(c.r, c.g, c.b);
  }
  return new Color3(COLORS.neon.cyan.r, COLORS.neon.cyan.g, COLORS.neon.cyan.b);
}

function districtAccent(district?: DistrictTheme): Color3 {
  if (district && DISTRICT_THEMES[district]) {
    const c = DISTRICT_THEMES[district].accentColor;
    return new Color3(c.r, c.g, c.b);
  }
  return new Color3(0, 0.6, 0.5);
}

export class LiveCity {
  private buildings = new Map<string, LiveBuilding>();
  private scene: Scene;

  constructor(scene: Scene) {
    this.scene = scene;
  }

  /** Sync projects — add new ones, remove stale ones */
  syncProjects(projects: Map<string, ProjectModel>): void {
    // Add new projects
    for (const [id, project] of projects) {
      if (!this.buildings.has(id)) {
        this.buildings.set(id, new LiveBuilding(project, this.scene));
      }
    }

    // Remove projects no longer present
    for (const [id, building] of this.buildings) {
      if (!projects.has(id)) {
        building.dispose();
        this.buildings.delete(id);
      }
    }
  }

  /** Handle a single bridge event */
  handleEvent(event: { type: string; payload: Record<string, unknown> }): void {
    const p = event.payload;
    const projectId = p.projectId as string | undefined;

    switch (event.type) {
      case "session:start": {
        const b = this.buildings.get(projectId || "");
        b?.activate();
        break;
      }

      case "session:end": {
        const b = this.buildings.get(projectId || "");
        if (b) b.deactivate();
        break;
      }

      case "session:tool_pre": {
        const b = this.buildings.get(projectId || "");
        if (b) b.pulse();
        break;
      }

      case "task:created": {
        const b = this.buildings.get(projectId || "");
        b?.addFloor(p.subject as string || "Task");
        break;
      }

      case "task:completed": {
        const b = this.buildings.get(projectId || "");
        b?.completeTopFloor();
        break;
      }
    }
  }
}

export class LiveBuilding {
  readonly root: TransformNode;
  private baseMesh: import("@babylonjs/core/Meshes/mesh").Mesh;
  private floors: import("@babylonjs/core/Meshes/mesh").Mesh[] = [];
  private sign: { mesh: import("@babylonjs/core/Meshes/mesh").Mesh; texture: DynamicTexture; mat: StandardMaterial };
  private light: PointLight;
  private project: ProjectModel;
  private scene: Scene;
  private district: DistrictTheme | undefined;
  private primaryColor: Color3;
  private accentColor: Color3;
  isActive = false;

  get name(): string { return this.project.name; }
  get path(): string { return this.project.path; }
  get health(): string { return this.project.health; }
  get position(): { x: number; z: number } { return this.project.position; }
  get floorCount(): number { return this.floors.length; }

  constructor(project: ProjectModel, scene: Scene) {
    this.project = project;
    this.scene = scene;
    this.district = project.district;
    this.primaryColor = districtPrimary(this.district);
    this.accentColor = districtAccent(this.district);

    this.root = new TransformNode(`live-${project.id}`, scene);
    this.root.position.x = project.position.x;
    this.root.position.z = project.position.z;

    // Base — tinted by district accent
    this.baseMesh = MeshBuilder.CreateBox(
      `base-${project.id}`,
      { width: FOOTPRINT, height: 0.5, depth: FOOTPRINT },
      scene
    );
    this.baseMesh.parent = this.root;
    this.baseMesh.position.y = 0.25;

    const baseMat = new StandardMaterial(`base-mat-${project.id}`, scene);
    baseMat.diffuseColor = new Color3(0.08, 0.08, 0.12);
    baseMat.specularColor = this.accentColor.scale(0.15);
    baseMat.emissiveColor = this.accentColor.scale(0.03);
    this.baseMesh.material = baseMat;

    // Neon sign — district-colored
    const signWidth = 512;
    const signHeight = 128;
    const texture = new DynamicTexture(`sign-${project.id}`, { width: signWidth, height: signHeight }, scene, true);
    const mat = new StandardMaterial(`sign-mat-${project.id}`, scene);
    mat.backFaceCulling = false;
    mat.useAlphaFromDiffuseTexture = true;

    const signMesh = MeshBuilder.CreatePlane(`sign-${project.id}`, { width: 5, height: 1.25 }, scene);
    signMesh.parent = this.root;
    signMesh.position.y = 3;
    signMesh.position.z = FOOTPRINT / 2 + 0.1;
    signMesh.material = mat;

    this.sign = { mesh: signMesh, texture, mat };
    this.renderSign(project.health);

    // Point light — district primary color
    this.light = new PointLight(`light-${project.id}`, new Vector3(0, 3, 0), scene);
    this.light.parent = this.root;
    this.light.diffuse = this.primaryColor;
    this.light.intensity = 0.5;
    this.light.range = 15;

    // Entrance animation
    this.root.scaling.y = 0.01;
    const dist = Math.sqrt(project.position.x ** 2 + project.position.z ** 2);
    setTimeout(() => {
      const anim = new Animation("rise", "scaling.y", 60, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CONSTANT);
      anim.setKeys([{ frame: 0, value: 0.01 }, { frame: 30, value: 1.0 }]);
      scene.beginDirectAnimation(this.root, [anim], 0, 30, false);
    }, dist * 20);
  }

  private renderSign(health: string): void {
    const color = HEALTH_COLORS[health] || HEALTH_COLORS.idle;
    const signColor = this.isActive ? color : this.primaryColor;
    const ctx = this.sign.texture.getContext();
    ctx.clearRect(0, 0, 512, 128);

    // District-specific sign styles
    const style = this.district ? DISTRICT_THEMES[this.district].signStyle : "clean";
    ctx.font = style === "harsh" || style === "rigid"
      ? "bold 48px monospace"
      : "bold 56px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = `rgba(${signColor.r * 255}, ${signColor.g * 255}, ${signColor.b * 255}, 0.8)`;

    // Multi-pass glow
    ctx.shadowBlur = 30;
    ctx.fillStyle = `rgba(${signColor.r * 255}, ${signColor.g * 255}, ${signColor.b * 255}, 0.6)`;
    ctx.fillText(this.project.name, 256, 64);

    ctx.shadowBlur = 15;
    ctx.fillStyle = `rgba(${signColor.r * 255}, ${signColor.g * 255}, ${signColor.b * 255}, 1)`;
    ctx.fillText(this.project.name, 256, 64);

    // Glitch effect for research districts
    if (style === "glitch" && this.isActive) {
      ctx.fillStyle = `rgba(${signColor.r * 255}, ${signColor.g * 255}, ${signColor.b * 255}, 0.3)`;
      ctx.fillText(this.project.name, 258, 63);
      ctx.fillStyle = `rgba(255, 50, 50, 0.15)`;
      ctx.fillText(this.project.name, 254, 66);
    }

    this.sign.texture.update();
    this.sign.mat.diffuseTexture = this.sign.texture;
    this.sign.mat.emissiveTexture = this.sign.texture;
    this.sign.mat.emissiveColor = signColor.scale(0.4);
  }

  activate(): void {
    this.isActive = true;
    this.light.intensity = 1.5;
    this.renderSign("healthy");
  }

  deactivate(): void {
    this.isActive = false;
    this.light.intensity = 0.3;
    this.renderSign("idle");
  }

  pulse(): void {
    this.light.intensity = 4;
    setTimeout(() => {
      this.light.intensity = this.isActive ? 1.5 : 0.3;
    }, 300);
  }

  addFloor(label: string): void {
    const index = this.floors.length;
    const floor = MeshBuilder.CreateBox(
      `floor-${this.project.id}-${index}`,
      { width: FOOTPRINT, height: FLOOR_HEIGHT, depth: FOOTPRINT },
      this.scene
    );
    floor.parent = this.root;
    floor.position.y = index * FLOOR_HEIGHT + FLOOR_HEIGHT / 2;

    const mat = new StandardMaterial(`floor-mat-${this.project.id}-${index}`, this.scene);
    mat.diffuseColor = new Color3(0.1, 0.1, 0.15);
    // Under-construction glow uses district accent
    mat.emissiveColor = this.accentColor.scale(0.2);
    mat.alpha = 0.6;
    mat.wireframe = true;
    floor.material = mat;

    // Scale-in animation
    floor.scaling.y = 0.01;
    const anim = new Animation("floor-rise", "scaling.y", 60, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CONSTANT);
    anim.setKeys([{ frame: 0, value: 0.01 }, { frame: 20, value: 1.0 }]);
    this.scene.beginDirectAnimation(floor, [anim], 0, 20, false);

    this.floors.push(floor);

    // Update sign and light position
    const totalHeight = this.floors.length * FLOOR_HEIGHT;
    this.sign.mesh.position.y = totalHeight * 0.5;
    this.light.position.y = totalHeight * 0.6;
  }

  completeTopFloor(): void {
    const floor = this.floors[this.floors.length - 1];
    if (!floor) return;

    const mat = floor.material as StandardMaterial;
    mat.wireframe = false;
    mat.alpha = 1;
    mat.diffuseColor = new Color3(0.1, 0.1, 0.15);
    mat.emissiveColor = new Color3(0.08, 0.12, 0.2);

    // Brief completion flash using district color
    mat.emissiveColor = this.primaryColor.scale(0.5);
    setTimeout(() => {
      mat.emissiveColor = new Color3(0.08, 0.12, 0.2);
    }, 500);
  }

  updateHealth(health: string): void {
    this.light.diffuse = HEALTH_COLORS[health] || HEALTH_COLORS.idle;
    this.renderSign(health);
  }

  dispose(): void {
    this.baseMesh.dispose();
    this.sign.mesh.dispose();
    this.sign.texture.dispose();
    this.sign.mat.dispose();
    this.light.dispose();
    for (const f of this.floors) {
      f.material?.dispose();
      f.dispose();
    }
    this.root.dispose();
  }
}
