import { FIELD, ITEMS, JUMP } from "../config";
import type { ItemKind } from "../game/types";
import type { Floor, FloorKind, Hazard, Pickup } from "./types";

export function floorWidth(index: number, rand: () => number): number {
  if (index === 0) return FIELD.width - 2 * JUMP.floorEdgePx;
  const t = Math.min(1, index / 36);
  const max =
    JUMP.floorWidthMax - t * (JUMP.floorWidthMax - JUMP.floorWidthMin - 20);
  return JUMP.floorWidthMin + rand() * Math.max(0, max - JUMP.floorWidthMin);
}

export function floorKind(index: number, rand: () => number): FloorKind {
  if (index === 0) return "ledge";
  const roll = rand();
  if (roll < 0.16) return "chandelier";
  return roll < 0.4 ? "tray" : "ledge";
}

export function floorX(
  index: number,
  width: number,
  rand: () => number,
): number {
  if (index === 0) return JUMP.floorEdgePx;
  const maxX = FIELD.width - width - JUMP.floorEdgePx;
  const left = JUMP.floorEdgePx;
  if (index % 2 === 0) return left + rand() * Math.max(0, maxX * 0.4);
  return left + maxX * 0.55 + rand() * Math.max(0, maxX * 0.45);
}

export function nextFloorY(prevY: number, rand: () => number): number {
  const span = JUMP.floorGapMax - JUMP.floorGapMin;
  return prevY - (JUMP.floorGapMin + rand() * span);
}

function pickupKind(
  kind: FloorKind,
  rand: () => number,
): Exclude<ItemKind, "obstacle"> {
  const pick = rand();
  if (pick < ITEMS.glass.spawnWeight / 9) return "glass";
  const starLimit = (ITEMS.glass.spawnWeight + ITEMS.star.spawnWeight) / 9;
  if (pick < starLimit || kind === "chandelier") return "star";
  return "clock";
}

export function lootFor(
  index: number,
  kind: FloorKind,
  rand: () => number,
): { pickup: Exclude<ItemKind, "obstacle"> | null; hazard: boolean } {
  if (index <= 1) return { pickup: null, hazard: false };
  const roll = rand();
  if (roll < 0.12) return { pickup: null, hazard: true };
  if (roll >= 0.55) return { pickup: null, hazard: false };
  return { pickup: pickupKind(kind, rand), hazard: false };
}

export function placeDecor(
  floor: Floor,
  loot: { pickup: Exclude<ItemKind, "obstacle"> | null; hazard: boolean },
  nextId: number,
): { pickups: Pickup[]; hazards: Hazard[]; nextId: number } {
  const cx = floor.x + floor.width / 2;
  const mid = floor.y - 30;
  let id = nextId;
  const pickups: Pickup[] = [];
  const hazards: Hazard[] = [];
  if (loot.pickup) {
    pickups.push({
      id,
      kind: loot.pickup,
      x: cx,
      y: mid,
      floorId: floor.id,
    });
    id += 1;
  }
  if (loot.hazard) {
    hazards.push({ id, x: cx, y: floor.y - 20, floorId: floor.id });
    id += 1;
  }
  return { pickups, hazards, nextId: id };
}

export function makeFloor(
  id: number,
  index: number,
  y: number,
  rand: () => number,
): Floor {
  const width = floorWidth(index, rand);
  return {
    id,
    index,
    kind: floorKind(index, rand),
    x: floorX(index, width, rand),
    y,
    width,
  };
}

export interface FloorPack {
  readonly floors: Floor[];
  readonly pickups: Pickup[];
  readonly hazards: Hazard[];
  readonly nextId: number;
}

function appendFloor(
  pack: FloorPack,
  index: number,
  y: number,
  rand: () => number,
): FloorPack {
  const floor = makeFloor(pack.nextId, index, y, rand);
  const loot = lootFor(index, floor.kind, rand);
  const decor = placeDecor(floor, loot, pack.nextId + 1);
  return {
    floors: [...pack.floors, floor],
    pickups: [...pack.pickups, ...decor.pickups],
    hazards: [...pack.hazards, ...decor.hazards],
    nextId: decor.nextId,
  };
}

/** Build the ground floor and enough floors to fill the first view. */
export function initialFloors(rand: () => number): FloorPack {
  let pack: FloorPack = {
    floors: [],
    pickups: [],
    hazards: [],
    nextId: 1,
  };
  pack = appendFloor(pack, 0, JUMP.groundY, rand);
  let y: number = JUMP.groundY;
  let index = 1;
  while (y > JUMP.groundY - FIELD.height - JUMP.generateAheadPx) {
    y = nextFloorY(y, rand);
    pack = appendFloor(pack, index, y, rand);
    index += 1;
  }
  return pack;
}

export function extendFloors(
  pack: FloorPack,
  cameraY: number,
  rand: () => number,
): FloorPack {
  const topNeeded = cameraY - JUMP.generateAheadPx;
  let next = pack;
  let last = next.floors[next.floors.length - 1];
  if (!last) return pack;
  while (last.y > topNeeded) {
    const y = nextFloorY(last.y, rand);
    next = appendFloor(next, last.index + 1, y, rand);
    last = next.floors[next.floors.length - 1]!;
  }
  return next;
}

export function pruneFloors(pack: FloorPack, cameraY: number): FloorPack {
  const keepBelow = cameraY + FIELD.height + JUMP.dropBehindPx;
  const floors = pack.floors.filter((floor) => floor.y < keepBelow);
  const ids = new Set(floors.map((floor) => floor.id));
  return {
    floors,
    pickups: pack.pickups.filter((item) => ids.has(item.floorId)),
    hazards: pack.hazards.filter((item) => ids.has(item.floorId)),
    nextId: pack.nextId,
  };
}
