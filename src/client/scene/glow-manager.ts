import { GlowLayer } from "@babylonjs/core/Layers/glowLayer";
import type { Scene } from "@babylonjs/core/scene";

export function createGlowLayer(scene: Scene): GlowLayer {
  const gl = new GlowLayer("neon-glow", scene, {
    blurKernelSize: 32,
  });
  gl.intensity = 1.2;
  return gl;
}
