import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Camera } from "@babylonjs/core/Cameras/camera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Scene } from "@babylonjs/core/scene";

export function createIsometricCamera(
  scene: Scene,
  canvas: HTMLCanvasElement
): ArcRotateCamera {
  const camera = new ArcRotateCamera(
    "isometric-cam",
    -Math.PI / 4, // alpha: 45 deg around Y
    Math.PI / 3, // beta: ~60 deg from vertical
    80,
    new Vector3(0, 0, 0),
    scene
  );

  camera.mode = Camera.ORTHOGRAPHIC_CAMERA;

  const aspectRatio = canvas.width / canvas.height;
  const orthoSize = 30;
  camera.orthoTop = orthoSize;
  camera.orthoBottom = -orthoSize;
  camera.orthoLeft = -orthoSize * aspectRatio;
  camera.orthoRight = orthoSize * aspectRatio;

  // Allow limited rotation and zoom
  camera.lowerBetaLimit = 0.3;
  camera.upperBetaLimit = Math.PI / 2.2;
  camera.lowerRadiusLimit = 30;
  camera.upperRadiusLimit = 200;
  camera.wheelPrecision = 10;
  camera.panningSensibility = 100;
  camera.minZ = 0.1;
  camera.maxZ = 500;

  camera.attachControl(canvas, true);
  return camera;
}
