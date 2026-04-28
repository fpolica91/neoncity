import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import type { Scene } from "@babylonjs/core/scene";
import { GRID, COLORS } from "../../shared/constants";

export function createGround(scene: Scene): void {
  // Ground plane
  const ground = MeshBuilder.CreateGround(
    "ground",
    { width: 200, height: 200 },
    scene
  );
  ground.position.y = -0.01;

  // Ground material with grid texture
  const groundMat = new StandardMaterial("ground-mat", scene);
  const gridTexture = new DynamicTexture("grid-tex", 1024, scene, true);
  const ctx = gridTexture.getContext();

  // Dark background
  ctx.fillStyle = "#0a0a0f";
  ctx.fillRect(0, 0, 1024, 1024);

  // Draw grid lines
  const gridSize = 1024 / 20; // 20 divisions
  ctx.strokeStyle = "rgba(0, 100, 90, 0.15)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 20; i++) {
    const pos = i * gridSize;
    ctx.beginPath();
    ctx.moveTo(pos, 0);
    ctx.lineTo(pos, 1024);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, pos);
    ctx.lineTo(1024, pos);
    ctx.stroke();
  }

  // Brighter street lines at intervals
  ctx.strokeStyle = "rgba(0, 200, 175, 0.25)";
  ctx.lineWidth = 2;
  const streetInterval = 1024 / (200 / (GRID.blockSize + GRID.streetWidth));
  for (let i = 0; i <= 200 / (GRID.blockSize + GRID.streetWidth); i++) {
    const pos = i * streetInterval;
    ctx.beginPath();
    ctx.moveTo(pos, 0);
    ctx.lineTo(pos, 1024);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, pos);
    ctx.lineTo(1024, pos);
    ctx.stroke();
  }

  gridTexture.update();

  groundMat.diffuseTexture = gridTexture;
  groundMat.specularColor = Color3.Black();
  ground.material = groundMat;
}
