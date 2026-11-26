import { describe, expect, it } from "vitest";
import { CLOCK } from "../config";
import { remainingForSlot, viewCrossfade, VIEWS } from "./views";

const base = CLOCK.baseDurationMs;

describe("viewCrossfade", () => {
  it("starts on the hotel hall and ends on the aerial view", () => {
    const start = viewCrossfade(base);
    expect(start).toEqual({ from: 0, to: 0, mix: 1 });
    const end = viewCrossfade(0);
    expect(end).toEqual({ from: 4, to: 4, mix: 1 });
    expect(viewCrossfade(-20)).toEqual({ from: 4, to: 4, mix: 1 });
    expect(viewCrossfade(base + 5_000)).toEqual({ from: 0, to: 0, mix: 1 });
  });

  it("keeps each mid-slot view fully on", () => {
    for (let slot = 0; slot < VIEWS.count; slot += 1) {
      const fade = viewCrossfade(remainingForSlot(slot));
      expect(fade.from).toBe(slot);
      expect(fade.to).toBe(slot);
      expect(fade.mix).toBe(1);
    }
  });

  it("cross-fades at each slot boundary for every player", () => {
    // Slot length is 5 s of game time. Fade is 1 s. Hall fades from elapsed 4 s.
    const mid = viewCrossfade(base - 4_500);
    expect(mid.from).toBe(0);
    expect(mid.to).toBe(1);
    expect(mid.mix).toBeCloseTo(0.5, 8);
    const almost = viewCrossfade(base - 4_990);
    expect(almost.from).toBe(0);
    expect(almost.to).toBe(1);
    expect(almost.mix).toBeGreaterThan(0.9);
    const church = viewCrossfade(base - 5_000);
    expect(church).toEqual({ from: 1, to: 1, mix: 1 });
  });

  it("fades castle into termy and termy into the aerial view", () => {
    const intoTermy = viewCrossfade(base - 14_500);
    expect(intoTermy.from).toBe(2);
    expect(intoTermy.to).toBe(3);
    expect(intoTermy.mix).toBeCloseTo(0.5, 8);
    const intoAerial = viewCrossfade(base - 19_500);
    expect(intoAerial.from).toBe(3);
    expect(intoAerial.to).toBe(4);
    expect(intoAerial.mix).toBeCloseTo(0.5, 8);
  });

  it("uses one view when count is 1", () => {
    expect(viewCrossfade(1_000, base, 1)).toEqual({ from: 0, to: 0, mix: 1 });
  });
});

describe("remainingForSlot", () => {
  it("returns the mid-slot remaining time and clamps the index", () => {
    expect(remainingForSlot(0)).toBe(Math.round(0.9 * base));
    expect(remainingForSlot(4)).toBe(Math.round(0.1 * base));
    expect(remainingForSlot(-3)).toBe(remainingForSlot(0));
    expect(remainingForSlot(99)).toBe(remainingForSlot(4));
  });
});
