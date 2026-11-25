import { DEPTH, ITEMS, PLAY } from "../config";
import { placeItem, pickLane } from "./depth";
import type { Item, ItemKind } from "./types";

type Weights = Record<ItemKind, { readonly spawnWeight: number }>;

const KINDS: readonly ItemKind[] = ["glass", "star", "clock", "obstacle"];

/** Pick an item kind from a roll in [0, 1) using the spawn weights. */
export function pickKind(roll: number, items: Weights = ITEMS): ItemKind {
  const total = KINDS.reduce((sum, kind) => sum + items[kind].spawnWeight, 0);
  let left = roll * total;
  for (const kind of KINDS) {
    left -= items[kind].spawnWeight;
    if (left < 0) return kind;
  }
  return "obstacle";
}

/** Create a new item at the far end of a floor lane. `rand` is in [0, 1). */
export function spawnItem(id: number, rand: () => number): Item {
  const kind = pickKind(rand());
  const lane = pickLane(rand());
  return placeItem({ id, kind, lane, z: DEPTH.spawnZ });
}

export function isCaught(item: Item, playerX: number): boolean {
  if (item.z < DEPTH.catchMinZ || item.z > DEPTH.catchMaxZ) return false;
  return Math.abs(item.x - playerX) <= PLAY.catchRadiusPx;
}
