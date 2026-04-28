import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Animation } from "@babylonjs/core/Animations/animation";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { Scene } from "@babylonjs/core/scene";
import { COLORS } from "../../shared/constants";

const FLOOR_HEIGHT = 1.5;
const FOOTPRINT = 6;

export function createFloor(
  index: number,
  isCompleted: boolean,
  scene: Scene
): Mesh {
  const mesh = MeshBuilder.CreateBox(
    `floor-${index}`,
    { width: FOOTPRINT, height: FLOOR_HEIGHT, depth: FOOTPRINT },
    scene
  );

  mesh.position.y = index * FLOOR_HEIGHT + FLOOR_HEIGHT / 2;

  if (isCompleted) {
    // Completed floor — dark with lit windows
    const mat = new StandardMaterial(`floor-mat-${index}`, scene);
    mat.diffuseColor = new Color3(0.1, 0.1, 0.15);
    mat.specularColor = new Color3(0.05, 0.05, 0.05);

    // Add lit windows (emissive dots on the surface)
    const windowTex = new DynamicTexture(
      `floor-tex-${index}`,
      256,
      scene,
      true
    );
    const ctx = windowTex.getContext();
    ctx.fillStyle = "#1a1a24";
    ctx.fillRect(0, 0, 256, 256);

    // Random lit windows
    const windowSize = 12;
    const gap = 20;
    for (let wx = 15; wx < 256; wx += gap + windowSize) {
      for (let wy = 15; wy < 256; wy += gap + windowSize) {
        if (Math.random() > 0.4) {
          const brightness = 0.3 + Math.random() * 0.7;
          const hue = Math.random() > 0.7 ? "cyan" : "blue";
          const color =
            hue === "cyan"
              ? `rgba(0, ${Math.floor(180 * brightness)}, ${Math.floor(200 * brightness)}, 1)`
              : `rgba(${Math.floor(60 * brightness)}, ${Math.floor(100 * brightness)}, ${Math.floor(200 * brightness)}, 1)`;
          ctx.fillStyle = color;
          ctx.fillRect(wx, wy, windowSize, windowSize);
        }
      }
    }
    windowTex.update();

    mat.diffuseTexture = windowTex;
    mat.emissiveTexture = windowTex;
    mat.emissiveColor = new Color3(0.08, 0.12, 0.2);
    mesh.material = mat;
  } else {
    // Under construction — wireframe glow
    const mat = new StandardMaterial(`floor-con-${index}`, scene);
    mat.diffuseColor = new Color3(
      COLORS.building.construction.r,
      COLORS.building.construction.g,
      COLORS.building.construction.b
    );
    mat.emissiveColor = new Color3(
      COLORS.building.construction.r * 0.3,
      COLORS.building.construction.g * 0.3,
      COLORS.building.construction.b * 0.3
    );
    mat.alpha = 0.5;
    mat.wireframe = true;
    mesh.material = mat;
  }

  return mesh;
}

// Need DynamicTexture import
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
