import { DefaultRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline";
import type { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import type { Scene } from "@babylonjs/core/scene";

export function createPostProcessing(
  scene: Scene,
  camera: ArcRotateCamera
): DefaultRenderingPipeline {
  const pipeline = new DefaultRenderingPipeline(
    "pipeline",
    true, // HDR
    scene,
    [camera]
  );

  // Bloom for neon glow
  pipeline.bloomEnabled = true;
  pipeline.bloomThreshold = 0.3;
  pipeline.bloomWeight = 0.4;
  pipeline.bloomKernel = 64;
  pipeline.bloomScale = 0.5;

  // Subtle chromatic aberration for cyberpunk feel
  pipeline.chromaticAberrationEnabled = true;
  pipeline.chromaticAberration.aberrationAmount = 10;
  pipeline.chromaticAberration.radialIntensity = 5;

  // FXAA antialiasing
  pipeline.fxaaEnabled = true;

  // Color grading
  pipeline.imageProcessingEnabled = true;
  pipeline.imageProcessing.contrast = 1.4;
  pipeline.imageProcessing.exposure = 0.8;
  pipeline.imageProcessing.toneMappingEnabled = true;

  return pipeline;
}
