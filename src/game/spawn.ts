import { FIELD, ITEMS, PLAY } from "../config";
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

/** Create a new item above the field. `rand` returns values in [0, 1). */
export function spawnItem(id: number, rand: () => number): Item {
  const kind = pickKind(rand());
  const span = FIELD.width - 2 * FIELD.edgePx;
  return {
    id,
    kind,
    x: FIELD.edgePx + rand() * span,
    y: -FIELD.itemRadiusPx,
  };
}

export function isCaught(item: Item, playerX: number): boolean {
  const distance = Math.hypot(item.x - playerX, item.y - FIELD.playerY);
  return distance <= PLAY.catchRadiusPx;
}
