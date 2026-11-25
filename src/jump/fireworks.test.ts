import { describe, expect, it } from "vitest";
import { burstOrigin, makeBurst, stepSparks } from "./fireworks";

describe("makeBurst", () => {
  it("creates sparks around a point with a limited life", () => {
    const burst = makeBurst(100, 80, () => 0.4, 10);
    expect(burst).toHaveLength(10);
    expect(burst[0]?.x).toBe(100);
    expect(burst[0]?.lifeMs).toBeGreaterThan(700);
  });
});

describe("stepSparks", () => {
  it("moves sparks and drops those that expire", () => {
    const burst = makeBurst(10, 10, () => 0, 4);
    const mid = stepSparks(burst, 200);
    expect(mid.length).toBe(4);
    expect(mid[0]?.ageMs).toBe(200);
    expect(mid[0]?.y).not.toBe(10);
    expect(stepSparks(mid, 5_000)).toEqual([]);
  });
});

describe("burstOrigin", () => {
  it("keeps bursts in the upper field", () => {
    const a = burstOrigin(390, 844, () => 0);
    const b = burstOrigin(390, 844, () => 1);
    expect(a.x).toBeGreaterThan(0);
    expect(b.x).toBeLessThan(390);
    expect(a.y).toBeLessThan(844 / 2);
    expect(b.y).toBeLessThan(844 / 2);
  });
});
