import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Animation } from "@babylonjs/core/Animations/animation";
import type { Scene } from "@babylonjs/core/scene";
import type { ProjectModel } from "../../shared/protocol";
import { DISTRICT_THEMES } from "../../shared/protocol";
import { LiveBuilding } from "../city/live-city";
import { AgentAvatar } from "../city/agent-avatar";

/**
 * Multi-district city manager.
 * Groups projects into themed districts with connecting transit lines,
 * agent avatars, and coordination links.
 */
export class MultiCity {
  private buildings = new Map<string, LiveBuilding>();
  private projects = new Map<string, ProjectModel>();
  private agents = new Map<string, { avatar: AgentAvatar; projectId: string }>();
  private scene: Scene;
  private transitLines: import("@babylonjs/core/Meshes/mesh").Mesh[] = [];
  private transitBeacons: import("@babylonjs/core/Meshes/mesh").Mesh[] = [];
  private coordLines: import("@babylonjs/core/Meshes/mesh").Mesh[] = [];
  private beaconObserver: import("@babylonjs/core/Misc/observable").Observer<import("@babylonjs/core/scene").Scene> | null = null;

  constructor(scene: Scene) {
    this.scene = scene;
    this.animateBeacons();
  }

  syncProjects(projects: Map<string, ProjectModel>): void {
    // Store project data for district lookups
    this.projects = new Map(projects);

    // Add new projects as district buildings
    for (const [id, project] of projects) {
      if (!this.buildings.has(id)) {
        const building = new LiveBuilding(project, this.scene);
        this.buildings.set(id, building);
      }
    }

    // Remove stale
    for (const [id, building] of this.buildings) {
      if (!projects.has(id)) {
        building.dispose();
        this.buildings.delete(id);
      }
    }

    this.drawTransitLines();
  }

  /** Get building by session ID (look up via agent or project mapping) */
  private getBuildingForSession(sessionId: string): LiveBuilding | undefined {
    // Check if any agent belongs to this session
    for (const [, entry] of this.agents) {
      // We can't directly map session to building here,
      // so iterate buildings and find active ones
    }
    // Fallback: find the active building
    for (const [, b] of this.buildings) {
      if (b.isActive) return b;
    }
    return undefined;
  }

  private getBuildingForProject(projectId: string): LiveBuilding | undefined {
    return this.buildings.get(projectId);
  }

  /** Draw transit lines between buildings — styled by district */
  private drawTransitLines(): void {
    for (const line of this.transitLines) line.dispose();
    for (const beacon of this.transitBeacons) beacon.dispose();
    this.transitLines = [];
    this.transitBeacons = [];

    const buildings = [...this.buildings.values()];
    if (buildings.length < 2) return;

    for (let i = 0; i < buildings.length - 1; i++) {
      const a = buildings[i];
      const b = buildings[i + 1];

      // Get district colors for the connection
      const districtA = this.projects.get([...this.projects.keys()][i])?.district;
      const districtB = this.projects.get([...this.projects.keys()][i + 1])?.district;
      const lineColor = this.blendDistrictColors(districtA, districtB);

      const points = this.generateTransitPath(
        new Vector3(a.root.position.x, 0.15, a.root.position.z),
        new Vector3(b.root.position.x, 0.15, b.root.position.z)
      );

      const line = MeshBuilder.CreateLines(
        `transit-${i}`,
        { points },
        this.scene
      );
      line.color = lineColor;
      line.alpha = 0.25;
      this.transitLines.push(line);

      // Beacon dot at midpoint — colored by blending districts
      const mid = points[Math.floor(points.length / 2)];
      const beacon = MeshBuilder.CreateSphere(`beacon-${i}`, { diameter: 0.15 }, this.scene);
      beacon.position = mid;
      const beaconMat = new StandardMaterial(`beacon-mat-${i}`, this.scene);
      beaconMat.emissiveColor = lineColor.scale(1.5);
      beaconMat.disableLighting = true;
      beaconMat.alpha = 0.6;
      beacon.material = beaconMat;
      this.transitBeacons.push(beacon);
    }
  }

  /** Blend colors from two districts for a transit connection */
  private blendDistrictColors(dA?: string, dB?: string): Color3 {
    const getPrimary = (d?: string) => {
      if (d && DISTRICT_THEMES[d as keyof typeof DISTRICT_THEMES]) {
        const c = DISTRICT_THEMES[d as keyof typeof DISTRICT_THEMES].primaryColor;
        return new Color3(c.r, c.g, c.b);
      }
      return new Color3(0, 0.5, 0.4);
    };
    const a = getPrimary(dA);
    const b = getPrimary(dB);
    return Color3.Lerp(a, b, 0.5).scale(0.5);
  }

  /** Generate a path with slight curve for transit lines */
  private generateTransitPath(from: Vector3, to: Vector3): Vector3[] {
    const points: Vector3[] = [from];
    const steps = 8;
    const mid = Vector3.Center(from, to);

    // Add a slight perpendicular offset for curves
    const dir = to.subtract(from).normalize();
    const perp = new Vector3(-dir.z, 0, dir.x);
    const curvature = 1.5;

    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const pos = Vector3.Lerp(from, to, t);
      // Parabolic offset — max at midpoint
      const offset = Math.sin(t * Math.PI) * curvature;
      pos.addInPlace(perp.scale(offset));
      points.push(pos);
    }
    points.push(to);
    return points;
  }

  /** Animate transit beacons with pulsing glow */
  private animateBeacons(): void {
    let t = 0;
    this.beaconObserver = this.scene.registerBeforeRender(() => {
      t += 0.04;
      for (const beacon of this.transitBeacons) {
        const scale = 0.8 + Math.sin(t) * 0.3;
        beacon.scaling.setAll(scale);
        const mat = beacon.material as StandardMaterial;
        if (mat) mat.alpha = 0.4 + Math.sin(t) * 0.3;
      }
    });
  }

  /** Draw coordination lines between agents working on the same project */
  private updateCoordinationLines(): void {
    for (const line of this.coordLines) line.dispose();
    this.coordLines = [];

    // Group agents by project
    const byProject = new Map<string, AgentAvatar[]>();
    for (const [, entry] of this.agents) {
      let list = byProject.get(entry.projectId);
      if (!list) {
        list = [];
        byProject.set(entry.projectId, list);
      }
      list.push(entry.avatar);
    }

    // Draw lines between agents on the same project
    for (const [projectId, avatars] of byProject) {
      if (avatars.length < 2) continue;

      const building = this.buildings.get(projectId);
      if (!building) continue;

      for (let i = 0; i < avatars.length - 1; i++) {
        const a = avatars[i].root.getAbsolutePosition();
        const b = avatars[i + 1].root.getAbsolutePosition();

        const line = MeshBuilder.CreateLines(`coord-${projectId}-${i}`, {
          points: [a, b],
        }, this.scene);
        line.color = new Color3(0.7, 0.3, 1);
        line.alpha = 0.3;
        this.coordLines.push(line);
      }
    }
  }

  addAgent(agentId: string, agentType: string, projectId: string): void {
    const building = this.buildings.get(projectId);
    if (!building) return;

    const avatar = new AgentAvatar(
      agentId,
      agentType,
      building.root,
      building.floorCount * 1.5,
      this.scene
    );

    this.agents.set(agentId, { avatar, projectId });
    this.updateCoordinationLines();
  }

  removeAgent(agentId: string): void {
    const entry = this.agents.get(agentId);
    if (entry) {
      entry.avatar.dissolve();
      this.agents.delete(agentId);
      this.updateCoordinationLines();
    }
  }

  setAgentState(agentId: string, state: "idle" | "thinking" | "executing" | "error"): void {
    const entry = this.agents.get(agentId);
    entry?.avatar.setState(state);
  }

  setAgentTool(agentId: string, toolName: string): void {
    const entry = this.agents.get(agentId);
    entry?.avatar.setCurrentTool(toolName);
  }

  handleEvent(event: { type: string; payload: Record<string, unknown> }): void {
    const p = event.payload;
    const projectId = p.projectId as string | undefined;

    switch (event.type) {
      case "session:start": {
        const pid = projectId || "";
        const b = this.buildings.get(pid);
        b?.activate();
        break;
      }

      case "session:end": {
        const pid = projectId || "";
        const b = this.buildings.get(pid);
        if (b) b.deactivate();
        else {
          // Fallback: deactivate all active
          for (const building of this.buildings.values()) building.deactivate();
        }
        break;
      }

      case "session:tool_pre": {
        const pid = projectId || "";
        const b = this.buildings.get(pid);
        if (b) b.pulse();
        break;
      }

      case "agent:start": {
        const agentId = p.agentId as string;
        const agentType = p.agentType as string;
        const pid = projectId || "";
        if (pid) this.addAgent(agentId, agentType, pid);
        break;
      }

      case "agent:stop": {
        this.removeAgent(p.agentId as string);
        break;
      }

      case "agent:state_change": {
        const agentId = p.agentId as string;
        const state = p.state as "idle" | "thinking" | "executing" | "error";
        this.setAgentState(agentId, state);
        if (p.currentTool) this.setAgentTool(agentId, p.currentTool as string);
        break;
      }

      case "task:created": {
        const pid = projectId || "";
        const b = this.buildings.get(pid);
        b?.addFloor(p.subject as string || "Task");
        break;
      }

      case "task:completed": {
        const pid = projectId || "";
        const b = this.buildings.get(pid);
        b?.completeTopFloor();
        break;
      }

      case "task:failed": {
        const pid = projectId || "";
        const b = this.buildings.get(pid);
        // Flash red on the building
        if (b) {
          b.pulse();
          // Could add a red flash method later
        }
        break;
      }
    }
  }

  dispose(): void {
    if (this.beaconObserver) {
      this.scene.unregisterBeforeRender(this.beaconObserver as any);
    }
    for (const line of this.transitLines) line.dispose();
    for (const beacon of this.transitBeacons) beacon.dispose();
    for (const line of this.coordLines) line.dispose();
    for (const [, entry] of this.agents) entry.avatar.dispose();
    for (const [, building] of this.buildings) building.dispose();
  }
}
