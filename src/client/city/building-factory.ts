import type { Scene } from "@babylonjs/core/scene";
import { Building, type BuildingConfig } from "./building";
import { layoutSlots } from "../../shared/city-layout";
import { DEMO_PROJECTS } from "../../shared/constants";

/**
 * Creates all demo buildings for Phase 1.
 * In later phases, this will be driven by live project data.
 */
export function createDemoCity(scene: Scene): Building[] {
  const slots = layoutSlots(DEMO_PROJECTS.length);
  const buildings: Building[] = [];

  DEMO_PROJECTS.forEach((project, i) => {
    const config: BuildingConfig = {
      name: project.name,
      taskCount: project.tasks,
      health: project.health,
      position: { x: slots[i].x, z: slots[i].z },
    };

    buildings.push(new Building(config, scene));
  });

  return buildings;
}
