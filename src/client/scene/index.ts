import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { Color4 } from "@babylonjs/core/Maths/math.color";
import { createIsometricCamera } from "./camera";
import { createLighting } from "./lighting";
import { createPostProcessing } from "./post-processing";
import { createGlowLayer } from "./glow-manager";
import { createGround } from "./ground";
import { createFog } from "./fog-atmosphere";
import { createBackgroundCity } from "./background-city";
import { createRain } from "./rain-system";
import { createDemoCity } from "../city/building-factory";
import { COLORS } from "../../shared/constants";

// Ensure side-effect imports for Babylon.js features
import "@babylonjs/core/Lights/pointLight";
import "@babylonjs/core/Animations/animation";
import "@babylonjs/core/Meshes/thinInstanceMesh";
import "@babylonjs/core/Helpers/sceneHelpers";

export function createScene(
  engine: Engine,
  canvas: HTMLCanvasElement
): Scene {
  const scene = new Scene(engine);

  // Dark background
  scene.clearColor = new Color4(
    COLORS.background.r,
    COLORS.background.g,
    COLORS.background.b,
    1
  );
  scene.ambientColor = new Color4(0.02, 0.02, 0.05, 1);

  // Setup layers
  const camera = createIsometricCamera(scene, canvas);
  createLighting(scene);
  createPostProcessing(scene, camera);
  createGlowLayer(scene);
  createGround(scene);
  createFog(scene);
  createBackgroundCity(scene);
  createRain(scene);

  // Demo buildings
  createDemoCity(scene);

  return scene;
}
