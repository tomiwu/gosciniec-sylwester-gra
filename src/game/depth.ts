import { DEPTH, FIELD } from "../config";

export function depthT(z: number, ease: number): number {
  const clamped = Math.min(Math.max(0, z), DEPTH.missZ);
  return clamped ** ease;
}

/** Left and right edges of the floor at a screen y, toward the vanishing point. */
export function floorEdges(y: number): { left: number; right: number } {
  const t = (y - DEPTH.vanishY) / (FIELD.height - DEPTH.vanishY);
  return {
    left: DEPTH.vanishX + (0 - DEPTH.vanishX) * t,
    right: DEPTH.vanishX + (FIELD.width - DEPTH.vanishX) * t,
  };
}

export function screenY(z: number): number {
  const t = depthT(z, DEPTH.easeY);
  return DEPTH.horizonY + t * (FIELD.playerY - DEPTH.horizonY);
}

export function laneX(lane: number, z: number): number {
  const y = screenY(z);
  const { left, right } = floorEdges(y);
  const u = (lane + 0.5) / DEPTH.lanes;
  return left + u * (right - left);
}

export function itemScale(z: number): number {
  const t = depthT(z, DEPTH.easeScale);
  return DEPTH.itemSizeFar + t * (DEPTH.itemSizeNear - DEPTH.itemSizeFar);
}

/** Map a lane and a depth to a screen position and a sprite size. */
export function project(
  lane: number,
  z: number,
): {
  x: number;
  y: number;
  scale: number;
} {
  return { x: laneX(lane, z), y: screenY(z), scale: itemScale(z) };
}

export function placeItem<T extends { lane: number; z: number }>(
  item: T,
): T & { x: number; y: number } {
  const pos = project(item.lane, item.z);
  return { ...item, x: pos.x, y: pos.y };
}

export function pickLane(roll: number): number {
  return Math.min(DEPTH.lanes - 1, Math.floor(roll * DEPTH.lanes));
}
