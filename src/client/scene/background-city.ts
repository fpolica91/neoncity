import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Matrix, Vector3, Quaternion } from "@babylonjs/core/Maths/math.vector";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import type { Scene } from "@babylonjs/core/scene";

/**
 * Creates distant low-poly skyline buildings using thin instances.
 * These are non-interactive silhouettes with randomly lit windows.
 */
export function createBackgroundCity(scene: Scene): void {
  const count = 200;
  const spread = 120;
  const innerRadius = 40; // keep clear of active project buildings

  // Single building template
  const template = MeshBuilder.CreateBox(
    "bg-template",
    { width: 3, height: 5, depth: 3 },
    scene
  );

  // Window texture
  const tex = new DynamicTexture("bg-tex", 128, scene, true);
  const ctx = tex.getContext();
  ctx.fillStyle = "#0d0d14";
  ctx.fillRect(0, 0, 128, 128);
  for (let wx = 8; wx < 128; wx += 16) {
    for (let wy = 8; wy < 128; wy += 16) {
      if (Math.random() > 0.6) {
        const b = Math.floor(50 + Math.random() * 100);
        ctx.fillStyle = `rgba(${b * 0.3}, ${b * 0.5}, ${b}, 0.8)`;
        ctx.fillRect(wx, wy, 8, 8);
      }
    }
  }
  tex.update();

  const mat = new StandardMaterial("bg-mat", scene);
  mat.diffuseTexture = tex;
  mat.emissiveTexture = tex;
  mat.emissiveColor = new Color3(0.04, 0.06, 0.12);
  mat.freeze();
  template.material = mat;

  // Generate instance matrices in a ring around the active area
  const bufferMatrices = new Float32Array(16 * count);
  const bufferColors = new Float32Array(4 * count);

  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = innerRadius + Math.random() * spread;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const height = 3 + Math.random() * 20;

    const matrix = Matrix.Compose(
      new Vector3(1, height / 5, 1),
      Quaternion.Identity(),
      new Vector3(x, height / 2, z)
    );
    matrix.copyToArray(bufferMatrices, i * 16);

    // Slight color variation
    const shade = 0.04 + Math.random() * 0.04;
    bufferColors[i * 4] = shade;
    bufferColors[i * 4 + 1] = shade;
    bufferColors[i * 4 + 2] = shade + 0.02;
    bufferColors[i * 4 + 3] = 1;
  }

  template.thinInstanceSetBuffer("matrix", bufferMatrices, 16);
  template.thinInstanceSetBuffer("color", bufferColors, 4);

  // Disable picking on background
  template.isPickable = false;
}
