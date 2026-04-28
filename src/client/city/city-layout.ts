import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { GRID } from "../../shared/constants";

export interface LayoutSlot {
  x: number;
  z: number;
}

/**
 * Generates grid positions for project buildings in a spiral pattern
 * centered at the origin. Most active projects placed near center.
 */
export function layoutSlots(count: number): LayoutSlot[] {
  const slots: LayoutSlot[] = [];
  const stride = GRID.blockSize + GRID.streetWidth;

  // Spiral placement: center row first, then expanding rings
  let x = 0;
  let z = 0;
  let dx = stride;
  let dz = 0;
  const visited = new Set<string>();

  for (let i = 0; i < count; i++) {
    slots.push({ x, z });
    visited.add(`${x},${z}`);

    // Try next position in current direction
    const nx = x + dx;
    const nz = z + dz;

    if (!visited.has(`${nx},${nz}`)) {
      x = nx;
      z = nz;
    } else {
      // Turn clockwise
      const temp = dx;
      dx = -dz;
      dz = temp;
      x += dx;
      z += dz;
    }
  }

  return slots;
}
