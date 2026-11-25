import { describe, expect, it } from "vitest";
import {
  CLOCK,
  ITEMS,
  OFFER,
  PLAY,
  REWARD,
  discountedPrice,
  formatOfferPrice,
  isNicknameValid,
  isScoreSane,
  maxPossibleScore,
  slowFactor,
  tempoMultiplier,
  tickRemaining,
} from "./config";

describe("slowFactor", () => {
  it("is 1 when the streak is 0", () => {
    expect(slowFactor(0)).toBe(1);
  });

  it("grows as 1.5 to the power of the streak, then the cap applies", () => {
    expect(slowFactor(1)).toBeCloseTo(1.5, 8);
    expect(slowFactor(2)).toBe(CLOCK.maxFactor);
    expect(1.5 ** 2).toBeGreaterThan(CLOCK.maxFactor);
  });

  it("keeps a no-streak round near 25 s and a good streak near 40 s", () => {
    expect(CLOCK.baseDurationMs).toBe(25_000);
    expect(CLOCK.baseDurationMs * CLOCK.maxFactor).toBeCloseTo(40_000, 8);
    expect(CLOCK.maxWallClockMs).toBeGreaterThanOrEqual(40_000);
    expect(CLOCK.maxWallClockMs).toBeLessThanOrEqual(45_000);
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

describe("tempoMultiplier", () => {
  it("is 1 at the start of the round", () => {
    expect(tempoMultiplier(CLOCK.baseDurationMs)).toBe(1);
  });

  it("grows as remaining time falls and peaks at midnight", () => {
    expect(tempoMultiplier(CLOCK.baseDurationMs / 2)).toBeCloseTo(
      1 + PLAY.tempoBoost * 0.5,
      8,
    );
    expect(tempoMultiplier(0)).toBeCloseTo(1 + PLAY.tempoBoost, 8);
  });

  it("clamps a value outside the clock range", () => {
    expect(tempoMultiplier(-100)).toBeCloseTo(1 + PLAY.tempoBoost, 8);
    expect(tempoMultiplier(CLOCK.baseDurationMs + 5_000)).toBe(1);
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

describe("offer prices", () => {
  it("keeps the regular price at 370 zl per person", () => {
    expect(OFFER.price).toBe(370);
    expect(formatOfferPrice(OFFER.price)).toBe("370 zł / os.");
  });

  it("uses the exact 10 % and share-bonus prices that Tomasz confirmed", () => {
    expect(discountedPrice(REWARD.basePercent)).toBe(333);
    expect(discountedPrice(REWARD.referralPercent)).toBe(299);
    expect(OFFER.priceWithCode).toBe(333);
    expect(OFFER.priceWithShare).toBe(299);
    expect(formatOfferPrice(333)).toBe("333 zł / os.");
    expect(formatOfferPrice(299)).toBe("299 zł / os.");
  });

  it("treats a bad percent as no discount", () => {
    expect(discountedPrice(0)).toBe(370);
    expect(discountedPrice(-10)).toBe(370);
    expect(discountedPrice(Number.NaN)).toBe(370);
  });
});

describe("score sanity", () => {
  it("is at least the best item over a max-length round, plus slack", () => {
    const max = maxPossibleScore();
    const fastestEvery = PLAY.spawnEveryMs / (1 + PLAY.tempoBoost);
    const spawns = Math.floor(CLOCK.maxWallClockMs / fastestEvery) + 1;
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
