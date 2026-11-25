import { describe, expect, it } from "vitest";
import { FEEDBACK } from "../config";
import { ageEffects, applyEvents, createEffects } from "./effects";
import type { GameEvent } from "./types";

const catchEvent = (streak: number, factor: number): GameEvent => ({
  kind: "catch",
  item: "glass",
  x: 50,
  y: 60,
  points: 10,
  streak,
  factor,
});

describe("applyEvents", () => {
  it("adds a pop for a catch", () => {
    const fx = applyEvents(createEffects(), [catchEvent(1, 1.5)]);
    expect(fx.pops).toEqual([{ x: 50, y: 60, points: 10, ageMs: 0 }]);
  });

  it("pulses gold when the clock slows", () => {
    const fx = applyEvents(createEffects(), [catchEvent(1, 1.5)]);
    expect(fx.pulseMs).toBe(FEEDBACK.pulseMs);
  });

  it("does not pulse at factor 1", () => {
    const fx = applyEvents(createEffects(), [catchEvent(1, 1)]);
    expect(fx.pulseMs).toBe(0);
  });

  it("flashes only from the configured streak", () => {
    const low = applyEvents(createEffects(), [
      catchEvent(FEEDBACK.flashFromStreak - 1, 2),
    ]);
    expect(low.flashMs).toBe(0);
    const high = applyEvents(createEffects(), [
      catchEvent(FEEDBACK.flashFromStreak, 3),
    ]);
    expect(high.flashMs).toBe(FEEDBACK.flashMs);
  });

  it("flashes red on an obstacle hit", () => {
    const fx = applyEvents(createEffects(), [{ kind: "hit", x: 1, y: 2 }]);
    expect(fx.hitMs).toBe(FEEDBACK.hitMs);
    expect(fx.pops).toEqual([]);
  });

  it("returns the same effects for no events", () => {
    const fx = createEffects();
    expect(applyEvents(fx, [])).toEqual(fx);
  });
});

describe("ageEffects", () => {
  it("ages pops and drops the old ones", () => {
    const fx = applyEvents(createEffects(), [catchEvent(1, 1.5)]);
    const mid = ageEffects(fx, 100);
    expect(mid.pops[0]?.ageMs).toBe(100);
    expect(ageEffects(mid, FEEDBACK.popMs).pops).toEqual([]);
  });

  it("counts timers down and stops at 0", () => {
    const fx = applyEvents(createEffects(), [
      catchEvent(FEEDBACK.flashFromStreak, 3),
      { kind: "hit", x: 0, y: 0 },
    ]);
    const aged = ageEffects(fx, 100);
    expect(aged.flashMs).toBe(FEEDBACK.flashMs - 100);
    expect(aged.pulseMs).toBe(FEEDBACK.pulseMs - 100);
    expect(aged.hitMs).toBe(FEEDBACK.hitMs - 100);
    const done = ageEffects(aged, 10_000);
    expect([done.flashMs, done.pulseMs, done.hitMs]).toEqual([0, 0, 0]);
  });
});
