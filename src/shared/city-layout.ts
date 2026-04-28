import { GRID } from "./constants";

export interface LayoutSlot {
  x: number;
  z: number;
}

export function layoutSlots(count: number): LayoutSlot[] {
  const slots: LayoutSlot[] = [];
  const stride = GRID.blockSize + GRID.streetWidth;

  let x = 0;
  let z = 0;
  let dx = 1;
  let dz = 0;
  let armLen = 1;
  let stepsInArm = 0;
  let armsAtThisLen = 0;

  for (let i = 0; i < count; i++) {
    slots.push({ x: x * stride, z: z * stride });
    x += dx;
    z += dz;
    stepsInArm++;
    if (stepsInArm === armLen) {
      stepsInArm = 0;
      const ndx = -dz;
      const ndz = dx;
      dx = ndx;
      dz = ndz;
      armsAtThisLen++;
      if (armsAtThisLen === 2) {
        armsAtThisLen = 0;
        armLen++;
      }
    }
  }

  return slots;
}
