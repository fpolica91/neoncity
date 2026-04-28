import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Scene } from "@babylonjs/core/scene";

export function createLighting(scene: Scene): void {
  // Dim ambient — nighttime city
  const ambient = new HemisphericLight(
    "ambient",
    new Vector3(0, 1, 0),
    scene
  );
  ambient.intensity = 0.12;
  ambient.diffuse = new Color3(0.15, 0.18, 0.3);
  ambient.groundColor = new Color3(0.02, 0.02, 0.05);
}
