import { describe, expect, it } from "vitest";
import { createMockBackend } from "../backend/mock";
import { LEADERBOARD, STAFF } from "../config";
import {
  MOCK_CODES,
  createMockPromo,
  createMockStaffApi,
  type MockCode,
} from "./mock-staff-api";

const BEFORE_END = new Date("2026-12-31T22:59:59.000Z");
const AFTER_END = new Date(STAFF.codeExpiresAtIso);

function api(now = BEFORE_END) {
  return createMockStaffApi({ codes: MOCK_CODES, now: () => now });
}

describe("createMockStaffApi", () => {
  it("returns valid for a known code that is not used, in any case", async () => {
    const check = await api().checkCode(" syl-ab2c ");
    expect(check).toMatchObject({
      code: "SYL-AB2C",
      status: "valid",
      kind: "base",
    });
    expect(check.nickname).not.toBeNull();
    expect(check.earnedAt).not.toBeNull();
  });

  it("returns unknown for a code that does not exist", async () => {
    expect(await api().checkCode("SYL-ZZZZ")).toEqual({
      code: "SYL-ZZZZ",
      status: "unknown",
      nickname: null,
      kind: null,
      earnedAt: null,
      usedAt: null,
    });
  });

  it("returns expired after 31 December 2026, 23:59:59 Warsaw time", async () => {
    expect((await api(AFTER_END).checkCode("SYL-AB2C")).status).toBe("expired");
  });

  it("returns already used for a used code, also after the end date", async () => {
    expect((await api().checkCode("SYL-USED")).status).toBe("already_used");
    expect((await api(AFTER_END).checkCode("SYL-USED")).status).toBe(
      "already_used",
    );
  });

  it("redeems a valid code one time only", async () => {
    const staff = api();
    const first = await staff.redeemCode("SYL-PX7K");
    expect(first.ok).toBe(true);
    expect(first.check.status).toBe("already_used");
    expect(first.check.usedAt).toBe(BEFORE_END.toISOString());
    const second = await staff.redeemCode("syl-px7k");
    expect(second.ok).toBe(false);
    expect(second.check.status).toBe("already_used");
    expect((await staff.checkCode("SYL-PX7K")).status).toBe("already_used");
  });

  it("does not redeem an unknown or an expired code", async () => {
    expect((await api().redeemCode("SYL-ZZZZ")).ok).toBe(false);
    const late = api(AFTER_END);
    expect((await late.redeemCode("SYL-AB2C")).ok).toBe(false);
    expect((await late.checkCode("SYL-AB2C")).status).toBe("expired");
  });

  it("does not change the seed list", async () => {
    await api().redeemCode("SYL-AB2C");
    expect((await api().checkCode("SYL-AB2C")).status).toBe("valid");
  });
});

describe("createMockStaffApi list and stats", () => {
  it("lists every code, newest first, with the status at now", async () => {
    const list = await api().listCodes();
    expect(list.map((c) => c.code)).toEqual(
      [...MOCK_CODES]
        .sort((a, b) => b.earnedAt.localeCompare(a.earnedAt))
        .map((c) => c.code),
    );
    const used = list.find((c) => c.code === "SYL-USED");
    expect(used?.usedAt).not.toBeNull();
  });

  it("shows a code as used in the list after a redeem", async () => {
    const staff = api();
    await staff.redeemCode("SYL-AB2C");
    const entry = (await staff.listCodes()).find((c) => c.code === "SYL-AB2C");
    expect(entry?.usedAt).toBe(BEFORE_END.toISOString());
  });

  it("returns an empty list and zero counts with no codes", async () => {
    const empty = createMockStaffApi({ codes: [], now: () => BEFORE_END });
    expect(await empty.listCodes()).toEqual([]);
    expect(await empty.dashboardStats()).toEqual({
      players: 0,
      codes: 0,
      shareCodes: 0,
      redeemed: 0,
    });
  });

  it("counts players, codes, share codes and used codes", async () => {
    const staff = createMockStaffApi({
      codes: MOCK_CODES,
      players: 9,
      now: () => BEFORE_END,
    });
    const before = await staff.dashboardStats();
    expect(before).toEqual({
      players: 9,
      codes: MOCK_CODES.length,
      shareCodes: MOCK_CODES.filter((c) => c.kind === "share").length,
      redeemed: MOCK_CODES.filter((c) => c.usedAt !== null).length,
    });
    await staff.redeemCode("SYL-AB2C");
    expect((await staff.dashboardStats()).redeemed).toBe(before.redeemed + 1);
  });

  it("counts one player per code when the player count is not set", async () => {
    expect((await api().dashboardStats()).players).toBe(MOCK_CODES.length);
  });
});

/** Invented codes. `BadNick` is the nickname that staff hide. */
const BOARD: MockCode[] = [
  {
    code: "SYL-BAD1",
    nickname: "BadNick",
    score: 300,
    kind: "base",
    referrals: 0,
    earnedAt: "2026-11-21T10:00:00.000Z",
    usedAt: null,
  },
  {
    code: "SYL-GUD2",
    nickname: "GoodNick",
    score: 250,
    kind: "share",
    referrals: 5,
    earnedAt: "2026-11-20T10:00:00.000Z",
    usedAt: null,
  },
  {
    code: "SYL-TIE3",
    nickname: "TieNick",
    score: 250,
    kind: "base",
    referrals: 0,
    earnedAt: "2026-11-22T10:00:00.000Z",
    usedAt: null,
  },
];

function promo() {
  return createMockPromo({ codes: BOARD, now: () => BEFORE_END });
}

function nicks(rows: { nickname: string }[]): string[] {
  return rows.map((r) => r.nickname);
}

describe("createMockPromo ranking and nickname hiding", () => {
  it("ranks by score, then by the earlier date, like the public top list", async () => {
    const { staff, board } = promo();
    const expected = ["BadNick", "GoodNick", "TieNick"];
    expect(nicks(await staff.leaderboard())).toEqual(expected);
    expect(nicks(await board.top(LEADERBOARD.topN))).toEqual(expected);
    expect(await board.top(1)).toEqual([{ nickname: "BadNick", score: 300 }]);
  });

  it("shows only the nickname and the score in both lists", async () => {
    const { staff, board } = promo();
    const rows = [...(await staff.leaderboard()), ...(await board.top(20))];
    for (const row of rows) {
      expect(Object.keys(row).sort()).toEqual(["nickname", "score"]);
    }
  });

  it("keeps the staff ranking at the public top-list size", async () => {
    const many = Array.from({ length: LEADERBOARD.topN + 3 }, (_, i) => ({
      ...BOARD[1]!,
      code: `SYL-N${String(i).padStart(3, "0")}`,
      nickname: `Nick${i}`,
      score: 200 + i,
    }));
    const { staff } = createMockPromo({ codes: many, now: () => BEFORE_END });
    expect(await staff.leaderboard()).toHaveLength(LEADERBOARD.topN);
  });

  it("hides one nick from the staff ranking and from the public top list", async () => {
    const { staff, board } = promo();
    expect(await staff.hideNickname("BadNick")).toBe(true);
    expect(nicks(await staff.leaderboard())).toEqual(["GoodNick", "TieNick"]);
    expect(nicks(await board.top(20))).toEqual(["GoodNick", "TieNick"]);
  });

  it("matches the nick without case and outer spaces", async () => {
    const { staff, board } = promo();
    expect(await staff.hideNickname("  badnick ")).toBe(true);
    expect(nicks(await board.top(20))).not.toContain("BadNick");
  });

  it("keeps the code row: the code still checks, lists and redeems", async () => {
    const { staff } = promo();
    await staff.hideNickname("BadNick");
    expect(await staff.checkCode("SYL-BAD1")).toMatchObject({
      status: "valid",
      nickname: "BadNick",
    });
    expect((await staff.listCodes()).map((c) => c.code)).toContain("SYL-BAD1");
    expect((await staff.dashboardStats()).codes).toBe(BOARD.length);
    const redeem = await staff.redeemCode("SYL-BAD1");
    expect(redeem.ok).toBe(true);
    expect(redeem.check.status).toBe("already_used");
  });

  it("is safe to hide the same nick twice", async () => {
    const { staff, board } = promo();
    await staff.hideNickname("BadNick");
    expect(await staff.hideNickname("BadNick")).toBe(true);
    expect(nicks(await board.top(20))).toEqual(["GoodNick", "TieNick"]);
    expect((await staff.checkCode("SYL-BAD1")).status).toBe("valid");
  });

  it("returns false for a nick that has no score", async () => {
    const { staff, board } = promo();
    expect(await staff.hideNickname("NoSuchNick")).toBe(false);
    expect(await board.top(20)).toHaveLength(BOARD.length);
  });

  it("gives the public side only top(), so the anon path cannot hide", () => {
    const { board } = promo();
    expect(Object.keys(board)).toEqual(["top"]);
    expect("hideNickname" in createMockBackend()).toBe(false);
  });

  it("does not share hidden nicks between two mock instances", async () => {
    await promo().staff.hideNickname("BadNick");
    expect(nicks(await promo().board.top(20))).toContain("BadNick");
  });
});
