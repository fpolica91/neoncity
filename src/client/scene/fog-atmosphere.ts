import { Scene } from "@babylonjs/core/scene";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { COLORS } from "../../shared/constants";

export function createFog(scene: Scene): void {
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogDensity = 0.012;
  scene.fogColor = new Color3(
    COLORS.fog.r,
    COLORS.fog.g,
    COLORS.fog.b
  );
}
