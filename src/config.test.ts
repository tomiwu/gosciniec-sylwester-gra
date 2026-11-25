import { describe, expect, it } from "vitest";
import {
  CLOCK,
  ITEMS,
  REWARD,
  isNicknameValid,
  isScoreSane,
  maxPossibleScore,
  slowFactor,
  tickRemaining,
} from "./config";

describe("slowFactor", () => {
  it("is 1 when the streak is 0", () => {
    expect(slowFactor(0)).toBe(1);
  });

  it("grows as 1.5 to the power of the streak", () => {
    expect(slowFactor(1)).toBeCloseTo(1.5, 8);
    expect(slowFactor(2)).toBeCloseTo(2.25, 8);
    expect(slowFactor(3)).toBeCloseTo(3.375, 8);
    expect(slowFactor(4)).toBeCloseTo(5.0625, 8);
  });

  it("applies the cap", () => {
    expect(slowFactor(5)).toBe(CLOCK.maxFactor);
    expect(slowFactor(20)).toBe(CLOCK.maxFactor);
  });

  it("treats a negative or non-finite streak as 0", () => {
    expect(slowFactor(-3)).toBe(1);
    expect(slowFactor(Number.NaN)).toBe(1);
  });
});

describe("tickRemaining", () => {
  it("uses real time when the factor is 1", () => {
    expect(tickRemaining(60_000, 1_000, 1)).toBe(59_000);
  });

  it("falls more slowly when the factor is higher", () => {
    expect(tickRemaining(60_000, 1_000, 2)).toBe(59_500);
    expect(tickRemaining(60_000, 1_000, 4)).toBe(59_750);
  });

  it("does not go below 0", () => {
    expect(tickRemaining(100, 1_000, 1)).toBe(0);
  });

  it("does not move when dt is 0 or negative", () => {
    expect(tickRemaining(60_000, 0, 2)).toBe(60_000);
    expect(tickRemaining(60_000, -10, 2)).toBe(60_000);
  });
});

describe("score sanity", () => {
  it("is at least the best item over a max-length round, plus slack", () => {
    const max = maxPossibleScore();
    const spawns = Math.floor(CLOCK.maxWallClockMs / 700) + 1;
    expect(max).toBe(spawns * ITEMS.clock.points + REWARD.scoreSlack);
    expect(isScoreSane(0)).toBe(true);
    expect(isScoreSane(max)).toBe(true);
    expect(isScoreSane(max + 1)).toBe(false);
    expect(isScoreSane(-1)).toBe(false);
    expect(isScoreSane(3.5)).toBe(false);
  });
});

describe("isNicknameValid", () => {
  it("accepts a short name and rejects an empty or long name", () => {
    expect(isNicknameValid("Anna")).toBe(true);
    expect(isNicknameValid("")).toBe(false);
    expect(isNicknameValid("   ")).toBe(false);
    expect(isNicknameValid("a".repeat(16))).toBe(true);
    expect(isNicknameValid("a".repeat(17))).toBe(false);
  });
});
