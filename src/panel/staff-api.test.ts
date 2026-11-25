import { describe, expect, it } from "vitest";
import { toCheck, toCodeRow, toScoreRow, toStats } from "./staff-api";

describe("staff API mappers", () => {
  it("maps a valid check result", () => {
    expect(
      toCheck({
        code: "SYL-SBAA",
        status: "valid",
        nickname: "TEST-NOCNY",
        kind: "base",
        discount_percent: 10,
        price_per_person: 333,
        earned_at: "2026-11-25T21:00:00Z",
        used_at: null,
      }),
    ).toEqual({
      code: "SYL-SBAA",
      status: "valid",
      nickname: "TEST-NOCNY",
      kind: "base",
      discountPercent: 10,
      pricePerPerson: 333,
      earnedAt: "2026-11-25T21:00:00Z",
      usedAt: null,
    });
  });

  it("maps list, stats and ranking rows", () => {
    expect(
      toCodeRow({
        code: "SYL-SBAA",
        nickname: "TEST-NOCNY",
        score: 200,
        kind: "base",
        referrals: 0,
        earned_at: "2026-11-25T21:00:00Z",
        used_at: null,
      }).code,
    ).toBe("SYL-SBAA");
    expect(
      toStats({ players: 1, codes: 1, share_codes: 0, redeemed: 0 }),
    ).toEqual({ players: 1, codes: 1, shareCodes: 0, redeemed: 0 });
    expect(toScoreRow({ nickname: "TEST-NOCNY", score: 200 })).toEqual({
      nickname: "TEST-NOCNY",
      score: 200,
    });
  });
});
