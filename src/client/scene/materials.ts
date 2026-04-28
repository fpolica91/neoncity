import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import type { Scene } from "@babylonjs/core/scene";
import { COLORS } from "../../shared/constants";

export function createBuildingBaseMaterial(scene: Scene): StandardMaterial {
  const mat = new StandardMaterial("building-base", scene);
  mat.diffuseColor = color3(COLORS.building.base);
  mat.specularColor = new Color3(0.1, 0.1, 0.1);
  mat.freeze();
  return mat;
}

export function createFloorCompletedMaterial(scene: Scene): StandardMaterial {
  const mat = new StandardMaterial("floor-completed", scene);
  mat.diffuseColor = color3(COLORS.building.completed);
  mat.specularColor = new Color3(0.05, 0.05, 0.05);
  mat.freeze();
  return mat;
}

export function createFloorConstructionMaterial(scene: Scene): StandardMaterial {
  const mat = new StandardMaterial("floor-construction", scene);
  mat.diffuseColor = color3(COLORS.building.construction);
  mat.emissiveColor = color3(COLORS.building.construction).scale(0.3);
  mat.alpha = 0.6;
  mat.wireframe = true;
  return mat;
}

export function createGroundMaterial(scene: Scene): StandardMaterial {
  const mat = new StandardMaterial("ground", scene);
  mat.diffuseColor = color3(COLORS.ground);
  mat.specularColor = Color3.Black();
  mat.freeze();
  return mat;
}

export function createNeonMaterial(
  name: string,
  color: { r: number; g: number; b: number },
  scene: Scene
): StandardMaterial {
  const mat = new StandardMaterial(name, scene);
  mat.diffuseColor = color3(color).scale(0.15);
  mat.emissiveColor = color3(color);
  mat.specularColor = Color3.Black();
  return mat;
}

function color3(c: { r: number; g: number; b: number }): Color3 {
  return new Color3(c.r, c.g, c.b);
}
