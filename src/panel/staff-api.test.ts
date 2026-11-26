import { describe, expect, it } from "vitest";
import { LEADERBOARD, STAFF } from "../config";
import {
  StaffApiError,
  createHttpStaffApi,
  parseCheck,
  parseLeaderboardRow,
  parseListEntry,
  parseStats,
  statusAt,
} from "./staff-api";

const VALID_ROW = {
  code: "SYL-AB2C",
  status: "valid",
  nickname: "TestPlayer1",
  kind: "base",
  discount_percent: 10,
  price_per_person: 333,
  earned_at: "2026-11-20T18:30:00.000Z",
  used_at: null,
};

type Call = { url: string; init: RequestInit | undefined };

function fakeFetch(respond: () => Response | Promise<Response>) {
  const calls: Call[] = [];
  const fn = (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return Promise.resolve(respond());
  };
  return { fn: fn as typeof fetch, calls };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe("parseCheck", () => {
  it("maps the check_code row to a CodeCheck", () => {
    expect(parseCheck(VALID_ROW)).toEqual({
      code: "SYL-AB2C",
      status: "valid",
      nickname: "TestPlayer1",
      kind: "base",
      earnedAt: "2026-11-20T18:30:00.000Z",
      usedAt: null,
    });
  });

  it("maps an unknown code with no nickname, kind or dates", () => {
    const check = parseCheck({
      code: "SYL-ZZZZ",
      status: "unknown",
      nickname: null,
      kind: null,
      earned_at: null,
      used_at: null,
    });
    expect(check).toEqual({
      code: "SYL-ZZZZ",
      status: "unknown",
      nickname: null,
      kind: null,
      earnedAt: null,
      usedAt: null,
    });
  });

  it("rejects a body that is not an object or has a bad status", () => {
    expect(() => parseCheck(null)).toThrow(StaffApiError);
    expect(() => parseCheck("SYL-AB2C")).toThrow(StaffApiError);
    expect(() => parseCheck({ ...VALID_ROW, status: "maybe" })).toThrow(
      StaffApiError,
    );
    expect(() => parseCheck({ ...VALID_ROW, code: 7 })).toThrow(StaffApiError);
  });

  it("treats a kind that is not base or share as no kind", () => {
    expect(parseCheck({ ...VALID_ROW, kind: "gold" }).kind).toBeNull();
    expect(parseCheck({ ...VALID_ROW, kind: "share" }).kind).toBe("share");
  });
});

describe("createHttpStaffApi", () => {
  it("posts the normalised code to the same-origin check route", async () => {
    const { fn, calls } = fakeFetch(() => jsonResponse(VALID_ROW));
    const api = createHttpStaffApi(fn);
    const check = await api.checkCode("  syl-ab2c ");
    expect(check.status).toBe("valid");
    expect(calls).toHaveLength(1);
    const [call] = calls;
    expect(call?.url).toBe(STAFF.api.checkPath);
    expect(call?.url.startsWith("/")).toBe(true);
    expect(call?.init?.method).toBe("POST");
    expect(call?.init?.credentials).toBe("same-origin");
    expect(call?.init?.body).toBe(JSON.stringify({ code: "SYL-AB2C" }));
  });

  it("posts to the redeem route and returns ok and the new state", async () => {
    const used = { ...VALID_ROW, status: "already_used", used_at: "x" };
    const { fn, calls } = fakeFetch(() =>
      jsonResponse({ ok: true, check: used }),
    );
    const result = await createHttpStaffApi(fn).redeemCode("SYL-AB2C");
    expect(calls[0]?.url).toBe(STAFF.api.redeemPath);
    expect(result.ok).toBe(true);
    expect(result.check.status).toBe("already_used");
  });

  it("reads ok as false unless the body says true", async () => {
    const { fn } = fakeFetch(() =>
      jsonResponse({ ok: "yes", check: VALID_ROW }),
    );
    expect((await createHttpStaffApi(fn).redeemCode("SYL-AB2C")).ok).toBe(
      false,
    );
  });

  it("throws a StaffApiError when the request fails", async () => {
    const offline = (() =>
      Promise.reject(new TypeError("offline"))) as typeof fetch;
    await expect(
      createHttpStaffApi(offline).checkCode("SYL-AB2C"),
    ).rejects.toBeInstanceOf(StaffApiError);
  });

  it("throws a StaffApiError on an HTTP error or a body that is not JSON", async () => {
    const denied = fakeFetch(() => jsonResponse({ error: "x" }, 403)).fn;
    await expect(
      createHttpStaffApi(denied).checkCode("SYL-AB2C"),
    ).rejects.toBeInstanceOf(StaffApiError);
    const broken = fakeFetch(() => new Response("<html>", { status: 200 })).fn;
    await expect(
      createHttpStaffApi(broken).redeemCode("SYL-AB2C"),
    ).rejects.toBeInstanceOf(StaffApiError);
  });
});

const LIST_ROW = {
  code: "SYL-AB2C",
  nickname: "TestPlayer1",
  score: 240,
  kind: "base",
  referrals: 2,
  earned_at: "2026-11-20T18:30:00.000Z",
  used_at: null,
};

describe("parseListEntry", () => {
  it("maps a list_codes row to a CodeListEntry", () => {
    expect(parseListEntry(LIST_ROW)).toEqual({
      code: "SYL-AB2C",
      nickname: "TestPlayer1",
      score: 240,
      kind: "base",
      referrals: 2,
      earnedAt: "2026-11-20T18:30:00.000Z",
      usedAt: null,
    });
  });

  it("keeps no device id or other field that the list does not show", () => {
    const entry = parseListEntry({
      ...LIST_ROW,
      device_id: "device-test-1",
      referred_by: "SYL-ZZZZ",
    });
    expect(Object.keys(entry).sort()).toEqual([
      "code",
      "earnedAt",
      "kind",
      "nickname",
      "referrals",
      "score",
      "usedAt",
    ]);
    expect(JSON.stringify(entry)).not.toContain("device-test-1");
  });

  it("rejects a row with a missing code, nickname, kind, date or a bad count", () => {
    expect(() => parseListEntry(null)).toThrow(StaffApiError);
    expect(() => parseListEntry({ ...LIST_ROW, code: 1 })).toThrow(
      StaffApiError,
    );
    expect(() => parseListEntry({ ...LIST_ROW, nickname: null })).toThrow(
      StaffApiError,
    );
    expect(() => parseListEntry({ ...LIST_ROW, kind: "gold" })).toThrow(
      StaffApiError,
    );
    expect(() => parseListEntry({ ...LIST_ROW, earned_at: null })).toThrow(
      StaffApiError,
    );
    expect(() => parseListEntry({ ...LIST_ROW, referrals: -1 })).toThrow(
      StaffApiError,
    );
    expect(() => parseListEntry({ ...LIST_ROW, score: "240" })).toThrow(
      StaffApiError,
    );
  });
});

describe("parseStats", () => {
  it("maps the dashboard_stats body", () => {
    expect(
      parseStats({ players: 12, codes: 8, share_codes: 3, redeemed: 2 }),
    ).toEqual({ players: 12, codes: 8, shareCodes: 3, redeemed: 2 });
  });

  it("rejects a count that is missing or not a whole number", () => {
    expect(() => parseStats({ players: 1, codes: 1, share_codes: 0 })).toThrow(
      StaffApiError,
    );
    expect(() =>
      parseStats({ players: 1.5, codes: 1, share_codes: 0, redeemed: 0 }),
    ).toThrow(StaffApiError);
  });
});

describe("statusAt", () => {
  const end = Date.parse(STAFF.codeExpiresAtIso);

  it("is valid until 31 December 2026, 23:59:59 Warsaw time", () => {
    expect(statusAt(null, new Date(end - 1000))).toBe("valid");
    expect(statusAt(null, new Date(end))).toBe("expired");
  });

  it("is already used for a used code, also after the end date", () => {
    const used = "2026-12-01T10:00:00.000Z";
    expect(statusAt(used, new Date(end - 1000))).toBe("already_used");
    expect(statusAt(used, new Date(end + 1000))).toBe("already_used");
  });
});

describe("createHttpStaffApi list and stats", () => {
  function rows(count: number, offset: number) {
    return Array.from({ length: count }, (_, i) => ({
      ...LIST_ROW,
      code: `SYL-T${String(offset + i).padStart(3, "0")}`,
    }));
  }

  it("gets the code list from the same-origin route", async () => {
    const { fn, calls } = fakeFetch(() => jsonResponse([LIST_ROW]));
    const list = await createHttpStaffApi(fn).listCodes();
    expect(list).toHaveLength(1);
    expect(list[0]?.code).toBe("SYL-AB2C");
    expect(calls).toHaveLength(1);
    const [call] = calls;
    expect(call?.url).toBe(
      `${STAFF.api.listPath}?limit=${STAFF.api.listPageSize}&offset=0`,
    );
    expect(call?.url.startsWith("/")).toBe(true);
    expect(call?.init?.method).toBe("GET");
    expect(call?.init?.credentials).toBe("same-origin");
    expect(call?.init?.body).toBeUndefined();
  });

  it("reads every page until a short page", async () => {
    const size = STAFF.api.listPageSize;
    let offset = 0;
    const { fn, calls } = fakeFetch(() => {
      const page = rows(offset === 0 ? size : 2, offset);
      offset += size;
      return jsonResponse(page);
    });
    const list = await createHttpStaffApi(fn).listCodes();
    expect(list).toHaveLength(size + 2);
    expect(calls.map((c) => c.url)).toEqual([
      `${STAFF.api.listPath}?limit=${size}&offset=0`,
      `${STAFF.api.listPath}?limit=${size}&offset=${size}`,
    ]);
  });

  it("stops after the page limit when the server always sends a full page", async () => {
    const size = STAFF.api.listPageSize;
    const { fn, calls } = fakeFetch(() => jsonResponse(rows(size, 0)));
    const list = await createHttpStaffApi(fn).listCodes();
    expect(calls).toHaveLength(STAFF.api.listMaxPages);
    expect(list).toHaveLength(size * STAFF.api.listMaxPages);
  });

  it("returns an empty list for an empty page", async () => {
    const { fn } = fakeFetch(() => jsonResponse([]));
    expect(await createHttpStaffApi(fn).listCodes()).toEqual([]);
  });

  it("throws a StaffApiError when the list body is not an array", async () => {
    const { fn } = fakeFetch(() => jsonResponse({ rows: [] }));
    await expect(createHttpStaffApi(fn).listCodes()).rejects.toBeInstanceOf(
      StaffApiError,
    );
  });

  it("gets the counts from the same-origin stats route", async () => {
    const body = { players: 4, codes: 3, share_codes: 1, redeemed: 1 };
    const { fn, calls } = fakeFetch(() => jsonResponse(body));
    const stats = await createHttpStaffApi(fn).dashboardStats();
    expect(stats).toEqual({ players: 4, codes: 3, shareCodes: 1, redeemed: 1 });
    expect(calls[0]?.url).toBe(STAFF.api.statsPath);
    expect(calls[0]?.init?.method).toBe("GET");
    expect(calls[0]?.init?.credentials).toBe("same-origin");
  });

  it("throws a StaffApiError when the stats route fails", async () => {
    const { fn } = fakeFetch(() => jsonResponse({ error: "x" }, 401));
    await expect(
      createHttpStaffApi(fn).dashboardStats(),
    ).rejects.toBeInstanceOf(StaffApiError);
  });
});

describe("parseLeaderboardRow", () => {
  it("keeps only the nickname and the score", () => {
    const row = parseLeaderboardRow({
      nickname: "BadNick",
      score: 300,
      code: "SYL-BAD1",
      device_id: "device-test-1",
    });
    expect(row).toEqual({ nickname: "BadNick", score: 300 });
  });

  it("rejects a row with no nickname or a bad score", () => {
    expect(() => parseLeaderboardRow(null)).toThrow(StaffApiError);
    expect(() => parseLeaderboardRow({ score: 1 })).toThrow(StaffApiError);
    expect(() =>
      parseLeaderboardRow({ nickname: "BadNick", score: -1 }),
    ).toThrow(StaffApiError);
  });
});

describe("createHttpStaffApi ranking and hide", () => {
  it("gets the ranking from the same-origin route at the top-list size", async () => {
    const body = [
      { nickname: "BadNick", score: 300 },
      { nickname: "GoodNick", score: 250 },
    ];
    const { fn, calls } = fakeFetch(() => jsonResponse(body));
    const rows = await createHttpStaffApi(fn).leaderboard();
    expect(rows).toEqual(body);
    expect(calls).toHaveLength(1);
    const [call] = calls;
    expect(call?.url).toBe(
      `${STAFF.api.leaderboardPath}?limit=${LEADERBOARD.topN}`,
    );
    expect(call?.url.startsWith("/api/staff/")).toBe(true);
    expect(call?.init?.method).toBe("GET");
    expect(call?.init?.credentials).toBe("same-origin");
  });

  it("throws a StaffApiError when the ranking body is not an array", async () => {
    const { fn } = fakeFetch(() => jsonResponse({ rows: [] }));
    await expect(createHttpStaffApi(fn).leaderboard()).rejects.toBeInstanceOf(
      StaffApiError,
    );
  });

  it("posts the trimmed nick to the same-origin hide route", async () => {
    const { fn, calls } = fakeFetch(() => jsonResponse(true));
    expect(await createHttpStaffApi(fn).hideNickname("  BadNick ")).toBe(true);
    expect(calls).toHaveLength(1);
    const [call] = calls;
    expect(call?.url).toBe(STAFF.api.hidePath);
    expect(call?.url.startsWith("/api/staff/")).toBe(true);
    expect(call?.init?.method).toBe("POST");
    expect(call?.init?.credentials).toBe("same-origin");
    expect(call?.init?.body).toBe(JSON.stringify({ nickname: "BadNick" }));
    const headers = JSON.stringify(call?.init?.headers ?? {});
    expect(headers.toLowerCase()).not.toContain("authorization");
    expect(headers.toLowerCase()).not.toContain("apikey");
  });

  it("returns false when the server found no such nick", async () => {
    const { fn } = fakeFetch(() => jsonResponse(false));
    expect(await createHttpStaffApi(fn).hideNickname("NoSuchNick")).toBe(false);
  });

  it("can send the same hide twice", async () => {
    const { fn, calls } = fakeFetch(() => jsonResponse(true));
    const api = createHttpStaffApi(fn);
    expect(await api.hideNickname("BadNick")).toBe(true);
    expect(await api.hideNickname("BadNick")).toBe(true);
    expect(calls).toHaveLength(2);
  });

  it("throws a StaffApiError for a body that is not true or false, or an HTTP error", async () => {
    const odd = fakeFetch(() => jsonResponse({ hidden: "yes" })).fn;
    await expect(
      createHttpStaffApi(odd).hideNickname("BadNick"),
    ).rejects.toBeInstanceOf(StaffApiError);
    const denied = fakeFetch(() =>
      jsonResponse({ error: "forbidden" }, 403),
    ).fn;
    await expect(
      createHttpStaffApi(denied).hideNickname("BadNick"),
    ).rejects.toBeInstanceOf(StaffApiError);
  });
});
