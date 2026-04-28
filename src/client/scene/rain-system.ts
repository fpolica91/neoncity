import { ParticleSystem } from "@babylonjs/core/Particles/particleSystem";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color4 } from "@babylonjs/core/Maths/math.color";
import type { Scene } from "@babylonjs/core/scene";

/**
 * Creates a rain particle system over the city.
 * Uses a simple procedural texture instead of requiring an image file.
 */
export function createRain(scene: Scene): ParticleSystem {
  // Generate a simple raindrop texture procedurally
  const rainTexture = new Texture(
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAAXNSR0IArs4c6QAAAMlJREFUWEft1sENwyAMBVDv6SXkFHACOYEdoROoESoJnEB3yU2aUmO8qqr+WjO+Z/+XjDF3nHN/BwBQDV8dwDeAv0sN4AWwLQCs0hBwB5y0pxdQf0bAiDH/2wH1qUoCYJ4VQGsA1n0wABgAnAG0A9gBeAN4ACMA7sR9+r3VAP4AHmW7JQBfcQdwKk4AznUBAI8Ap2M5KgCXhQBMApTrCGA4KgHfAEQDqOYCcBsIsACsArAOwDqoAgOwCgDnAK4COtQBcAqgmgLYBu4A1gC0AVYBKJcA1AUAPAHwA+AJ4A3ADewhU8E2C56AAAAAElFTkSuQmCC",
    scene,
    false,
    false
  );

  const rain = new ParticleSystem("rain", 5000, scene);
  rain.particleTexture = rainTexture;

  rain.emitter = new Vector3(0, 40, 0);
  rain.minEmitBox = new Vector3(-60, 0, -60);
  rain.maxEmitBox = new Vector3(60, 0, 60);

  rain.direction1 = new Vector3(-0.3, -1, -0.3);
  rain.direction2 = new Vector3(0.3, -1, 0.3);

  rain.minLifeTime = 0.4;
  rain.maxLifeTime = 0.8;
  rain.emitRate = 3000;
  rain.minSize = 0.02;
  rain.maxSize = 0.06;
  rain.minEmitPower = 15;
  rain.maxEmitPower = 25;
  rain.updateSpeed = 0.01;
  rain.gravity = new Vector3(0, -25, 0);

  rain.color1 = new Color4(0.7, 0.8, 1.0, 0.3);
  rain.color2 = new Color4(0.5, 0.6, 1.0, 0.2);
  rain.colorDead = new Color4(0.3, 0.4, 0.8, 0);

  rain.blendMode = ParticleSystem.BLENDMODE_ADD;
  rain.start();

  return rain;
}
