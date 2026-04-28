import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import type { Scene } from "@babylonjs/core/scene";
import { COLORS } from "../../shared/constants";

const HEALTH_COLORS: Record<string, { r: number; g: number; b: number }> = {
  healthy: COLORS.neon.cyan,
  warning: COLORS.neon.yellow,
  error: COLORS.neon.red,
  idle: { r: 0.3, g: 0.3, b: 0.4 },
};

export function createNeonSign(
  text: string,
  health: string,
  scene: Scene
): { mesh: import("@babylonjs/core/Meshes/mesh").Mesh; updateHealth: (h: string) => void } {
  const texWidth = 512;
  const texHeight = 128;
  const texture = new DynamicTexture(
    `sign-${text}`,
    { width: texWidth, height: texHeight },
    scene,
    true
  );

  const plane = MeshBuilder.CreatePlane(
    `sign-${text}`,
    { width: 5, height: 1.25 },
    scene
  );

  const mat = new StandardMaterial(`sign-mat-${text}`, scene);
  mat.backFaceCulling = false;
  mat.useAlphaFromDiffuseTexture = true;
  plane.material = mat;

  function renderSign(healthKey: string) {
    const color = HEALTH_COLORS[healthKey] ?? HEALTH_COLORS.idle;
    const ctx = texture.getContext();
    ctx.clearRect(0, 0, texWidth, texHeight);

    // Text
    ctx.font = "bold 56px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Glow layers
    ctx.shadowColor = `rgba(${color.r * 255}, ${color.g * 255}, ${color.b * 255}, 0.8)`;
    ctx.shadowBlur = 25;
    ctx.fillStyle = `rgba(${color.r * 255}, ${color.g * 255}, ${color.b * 255}, 1)`;
    ctx.fillText(text, texWidth / 2, texHeight / 2);

    // Second pass for extra glow
    ctx.shadowBlur = 10;
    ctx.fillText(text, texWidth / 2, texHeight / 2);

    texture.update();

    mat.diffuseTexture = texture;
    mat.emissiveTexture = texture;
    mat.emissiveColor = new Color3(color.r, color.g, color.b).scale(0.4);
  }

  renderSign(health);

  return {
    mesh: plane,
    updateHealth: renderSign,
  };
}
