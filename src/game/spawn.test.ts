import { describe, expect, it } from "vitest";
import { FIELD, ITEMS } from "../config";
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
  it("spawns above the field inside the side margins", () => {
    const rolls = [0, 0];
    const left = spawnItem(7, () => rolls.shift() ?? 0);
    expect(left).toMatchObject({ id: 7, kind: "glass", x: FIELD.edgePx });
    expect(left.y).toBeLessThan(0);
    const high = [0.99, 1];
    const right = spawnItem(8, () => high.shift() ?? 1);
    expect(right.kind).toBe("obstacle");
    expect(right.x).toBeCloseTo(FIELD.width - FIELD.edgePx, 6);
  });
});

describe("isCaught", () => {
  const at = (x: number, y: number) => ({
    id: 1,
    kind: "glass" as const,
    x,
    y,
  });

  it("catches an item inside the catch radius", () => {
    expect(isCaught(at(100, FIELD.playerY), 100)).toBe(true);
    expect(isCaught(at(130, FIELD.playerY - 30), 100)).toBe(true);
  });

  it("does not catch an item outside the catch radius", () => {
    expect(isCaught(at(300, FIELD.playerY), 100)).toBe(false);
    expect(isCaught(at(100, 100), 100)).toBe(false);
  });
});
