import { describe, expect, it } from "vitest";
import { DEPTH, FIELD, ITEMS, PLAY } from "../config";
import { project } from "./depth";
import { isCaught, pickKind, spawnItem } from "./spawn";

const weights = {
  glass: { points: 10, spawnWeight: 1 },
  star: { points: 15, spawnWeight: 2 },
  clock: { points: 20, spawnWeight: 1 },
  obstacle: { points: 0, spawnWeight: 1 },
} as const;

describe("pickKind", () => {
  it("walks the weights in order", () => {
    expect(pickKind(0, weights)).toBe("glass");
    expect(pickKind(0.1, weights)).toBe("glass");
    expect(pickKind(0.3, weights)).toBe("star");
    expect(pickKind(0.7, weights)).toBe("clock");
    expect(pickKind(0.9, weights)).toBe("obstacle");
  });

  it("returns the last kind when the roll is 1 or more", () => {
    expect(pickKind(1, weights)).toBe("obstacle");
    expect(pickKind(5, weights)).toBe("obstacle");
  });

  it("can pick every kind with the real weights", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 100; i += 1) seen.add(pickKind(i / 100));
    expect([...seen].sort()).toEqual(Object.keys(ITEMS).sort());
  });
});

describe("spawnItem", () => {
  it("spawns at the far end of a floor lane", () => {
    const rolls = [0, 0];
    const left = spawnItem(7, () => rolls.shift() ?? 0);
    expect(left).toMatchObject({
      id: 7,
      kind: "glass",
      lane: 0,
      z: DEPTH.spawnZ,
    });
    const far = project(0, DEPTH.spawnZ);
    expect(left.x).toBeCloseTo(far.x, 6);
    expect(left.y).toBeCloseTo(far.y, 6);
    const high = [0.99, 0.99];
    const right = spawnItem(8, () => high.shift() ?? 1);
    expect(right.kind).toBe("obstacle");
    expect(right.lane).toBe(DEPTH.lanes - 1);
  });
});

describe("isCaught", () => {
  const at = (x: number, z: number) => ({
    id: 1,
    kind: "glass" as const,
    lane: 2,
    z,
    x,
    y: FIELD.playerY,
  });

  it("catches an item in the catch window and radius", () => {
    expect(isCaught(at(100, DEPTH.catchZ), 100)).toBe(true);
    expect(isCaught(at(100 + PLAY.catchRadiusPx, DEPTH.catchZ), 100)).toBe(
      true,
    );
  });

  it("does not catch an item that is too far or too wide", () => {
    expect(isCaught(at(100 + PLAY.catchRadiusPx + 1, DEPTH.catchZ), 100)).toBe(
      false,
    );
    expect(isCaught(at(100, 0.2), 100)).toBe(false);
  });
});
