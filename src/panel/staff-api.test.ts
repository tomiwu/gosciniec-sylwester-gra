import { afterEach, describe, expect, it, vi } from "vitest";
import { BackendError } from "../backend/types";
import {
  createSameOriginStaff,
  fetchStaffRanking,
  verifyStaffRound,
  toCheck,
  toCodeRow,
  toScoreRow,
  toStats,
} from "./staff-api";

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

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("createSameOriginStaff", () => {
  it("maps check, redeem, list, stats and hide responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (path: string) => {
        if (String(path).startsWith("/api/staff/check")) {
          return jsonResponse(200, {
            code: "SYL-SBAA",
            status: "valid",
            nickname: "TEST-NOCNY",
            kind: "base",
            discount_percent: 10,
            price_per_person: 333,
            earned_at: "2026-11-25T21:00:00Z",
            used_at: null,
          });
        }
        if (String(path).startsWith("/api/staff/redeem")) {
          return jsonResponse(200, {
            ok: true,
            check: {
              code: "SYL-SBAA",
              status: "already_used",
              nickname: "TEST-NOCNY",
              kind: "base",
              discount_percent: 10,
              price_per_person: 333,
              earned_at: "2026-11-25T21:00:00Z",
              used_at: "2026-11-25T22:00:00Z",
            },
          });
        }
        if (String(path).startsWith("/api/staff/codes")) {
          return jsonResponse(200, [
            {
              code: "SYL-SBAA",
              nickname: "TEST-NOCNY",
              score: 200,
              kind: "base",
              referrals: 0,
              earned_at: "2026-11-25T21:00:00Z",
              used_at: null,
            },
          ]);
        }
        if (String(path).startsWith("/api/staff/stats")) {
          return jsonResponse(200, {
            players: 1,
            codes: 1,
            share_codes: 0,
            redeemed: 0,
          });
        }
        if (String(path).includes("hide-nickname")) {
          return jsonResponse(200, true);
        }
        return jsonResponse(404, { error: "no" });
      }),
    );
    const staff = createSameOriginStaff();
    expect((await staff.check("syl-sbaa")).code).toBe("SYL-SBAA");
    expect((await staff.redeem("SYL-SBAA", "note")).ok).toBe(true);
    expect((await staff.listCodes(10, 0))[0]?.nickname).toBe("TEST-NOCNY");
    expect((await staff.stats()).redeemed).toBe(0);
    expect(await staff.hideNickname("TEST-NOCNY")).toBe(true);
  });

  it("maps 401 to forbidden and a dropped network to network", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(401, { error: "unauthorized" })),
    );
    await expect(
      createSameOriginStaff().check("SYL-SBAA"),
    ).rejects.toBeInstanceOf(BackendError);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );
    await expect(createSameOriginStaff().stats()).rejects.toMatchObject({
      kind: "network",
    });
  });

  it("rejects a non-JSON or failed staff body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nope", { status: 200 })),
    );
    await expect(createSameOriginStaff().stats()).rejects.toMatchObject({
      kind: "server",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(500, { error: "boom" })),
    );
    await expect(createSameOriginStaff().stats()).rejects.toMatchObject({
      kind: "server",
    });
  });
});

describe("fetchStaffRanking", () => {
  it("maps ranking rows and rejects a bad payload", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(200, [{ nickname: "TEST-NOCNY", score: 200 }]),
      ),
    );
    expect(await fetchStaffRanking()).toEqual([
      { nickname: "TEST-NOCNY", score: 200 },
    ]);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(200, { no: "array" })),
    );
    await expect(fetchStaffRanking()).rejects.toMatchObject({ kind: "server" });
  });
});

describe("verifyStaffRound", () => {
  it("maps a verify-round response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(200, {
          ok: true,
          flags: ["few_events"],
          replayedScore: 10,
          score: 10,
        }),
      ),
    );
    expect(await verifyStaffRound("r1")).toEqual({
      ok: true,
      flags: ["few_events"],
      replayedScore: 10,
      score: 10,
    });
  });
});
