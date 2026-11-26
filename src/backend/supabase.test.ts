import { describe, expect, it } from "vitest";
import { createSupabaseBackend, createSupabaseStaff } from "./supabase";
import { BackendError } from "./types";

const URL_BASE = "https://project-ref.example.test";
const ANON = "fake-anon-key";
const STAFF_TOKEN = "fake-staff-session";

type Call = { url: string; init: RequestInit };

function fakeFetch(status: number, body: unknown) {
  const calls: Call[] = [];
  const fetchFn = async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), init: init ?? {} });
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  };
  return { calls, fetchFn: fetchFn as typeof fetch };
}

function offline(): typeof fetch {
  return (async () => {
    throw new TypeError("offline");
  }) as typeof fetch;
}

function header(call: Call | undefined, name: string): string | null {
  return new Headers(call?.init.headers).get(name);
}

const CHECK_ROW = {
  code: "SYL-7K2P",
  status: "valid",
  nickname: "AdaTest",
  kind: "base",
  discount_percent: 10,
  price_per_person: 333,
  earned_at: "2026-12-10T18:30:00+00:00",
  used_at: null,
};

const CHECK = {
  code: "SYL-7K2P",
  status: "valid",
  nickname: "AdaTest",
  kind: "base",
  discountPercent: 10,
  pricePerPerson: 333,
  earnedAt: "2026-12-10T18:30:00+00:00",
  usedAt: null,
};

describe("createSupabaseBackend", () => {
  it("calls issue_code with the anon key and maps the result", async () => {
    const { calls, fetchFn } = fakeFetch(200, {
      accepted: true,
      code: "SYL-7K2P",
      discount_percent: 10,
      referral_progress: 2,
      referral_needed: 5,
    });
    const backend = createSupabaseBackend({
      url: `${URL_BASE}/`,
      anonKey: ANON,
      fetch: fetchFn,
    });
    const result = await backend.submit({
      nickname: "AdaTest",
      score: 210,
      deviceId: "device-ada",
      referralCode: "SYL-3456",
    });
    expect(result).toEqual({
      accepted: true,
      code: "SYL-7K2P",
      discountPercent: 10,
      referralProgress: 2,
      referralNeeded: 5,
    });
    expect(calls[0]?.url).toBe(`${URL_BASE}/rest/v1/rpc/issue_code`);
    expect(calls[0]?.init.method).toBe("POST");
    expect(header(calls[0], "apikey")).toBe(ANON);
    expect(header(calls[0], "Authorization")).toBe(`Bearer ${ANON}`);
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({
      p_nickname: "AdaTest",
      p_score: 210,
      p_device_id: "device-ada",
      p_referral_code: "SYL-3456",
    });
  });

  it("sends a null referral code and keeps a reject reason", async () => {
    const { calls, fetchFn } = fakeFetch(200, {
      accepted: false,
      reason: "score",
      code: "",
      discount_percent: 0,
      referral_progress: 0,
      referral_needed: 5,
    });
    const backend = createSupabaseBackend({
      url: URL_BASE,
      anonKey: ANON,
      fetch: fetchFn,
    });
    const result = await backend.submit({
      nickname: "AdaTest",
      score: 9_999_999,
      deviceId: "device-ada",
    });
    expect(result).toMatchObject({ accepted: false, reason: "score" });
    expect(JSON.parse(String(calls[0]?.init.body)).p_referral_code).toBeNull();
  });

  it("gives a not-accepted result when the network fails", async () => {
    const backend = createSupabaseBackend({
      url: URL_BASE,
      anonKey: ANON,
      fetch: offline(),
    });
    const result = await backend.submit({
      nickname: "AdaTest",
      score: 210,
      deviceId: "device-ada",
    });
    expect(result).toEqual({
      accepted: false,
      reason: "network",
      code: "",
      discountPercent: 0,
      referralProgress: 0,
      referralNeeded: 5,
    });
  });

  it("gives a server reason when the reply is not JSON", async () => {
    const fetchFn = (async () =>
      new Response("<html>", { status: 200 })) as typeof fetch;
    const backend = createSupabaseBackend({
      url: URL_BASE,
      anonKey: ANON,
      fetch: fetchFn,
    });
    const result = await backend.submit({
      nickname: "AdaTest",
      score: 210,
      deviceId: "device-ada",
    });
    expect(result).toMatchObject({ accepted: false, reason: "server" });
  });

  it("reads the leaderboard as nickname and score only", async () => {
    const { calls, fetchFn } = fakeFetch(200, [
      { nickname: "BenTest", score: 300, code: "SYL-ZZZZ" },
    ]);
    const backend = createSupabaseBackend({
      url: URL_BASE,
      anonKey: ANON,
      fetch: fetchFn,
    });
    expect(await backend.top(20)).toEqual([
      { nickname: "BenTest", score: 300 },
    ]);
    expect(calls[0]?.url).toBe(`${URL_BASE}/rest/v1/rpc/leaderboard`);
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({ p_limit: 20 });
  });
});

describe("createSupabaseStaff", () => {
  function staff(status: number, body: unknown) {
    const fake = fakeFetch(status, body);
    const backend = createSupabaseStaff({
      url: URL_BASE,
      anonKey: ANON,
      accessToken: STAFF_TOKEN,
      fetch: fake.fetchFn,
    });
    return { ...fake, backend };
  }

  it("checks a code with the staff session token", async () => {
    const { calls, backend } = staff(200, CHECK_ROW);
    expect(await backend.check(" syl-7k2p ")).toEqual(CHECK);
    expect(calls[0]?.url).toBe(`${URL_BASE}/rest/v1/rpc/check_code`);
    expect(header(calls[0], "apikey")).toBe(ANON);
    expect(header(calls[0], "Authorization")).toBe(`Bearer ${STAFF_TOKEN}`);
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({
      p_code: "SYL-7K2P",
    });
  });

  it("maps an unknown code with empty fields", async () => {
    const { backend } = staff(200, {
      code: "SYL-ZZZZ",
      status: "unknown",
      nickname: null,
      kind: null,
      discount_percent: 0,
      price_per_person: null,
      earned_at: null,
      used_at: null,
    });
    expect(await backend.check("SYL-ZZZZ")).toEqual({
      code: "SYL-ZZZZ",
      status: "unknown",
      nickname: null,
      kind: null,
      discountPercent: 0,
      pricePerPerson: null,
      earnedAt: null,
      usedAt: null,
    });
  });

  it("redeems a code and maps the new state", async () => {
    const used = {
      ...CHECK_ROW,
      status: "already_used",
      used_at: "2026-12-20T09:00:00+00:00",
    };
    const { calls, backend } = staff(200, { ok: true, check: used });
    const result = await backend.redeem("SYL-7K2P", "front desk");
    expect(result).toEqual({
      ok: true,
      check: {
        ...CHECK,
        status: "already_used",
        usedAt: "2026-12-20T09:00:00+00:00",
      },
    });
    expect(calls[0]?.url).toBe(`${URL_BASE}/rest/v1/rpc/redeem_code`);
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({
      p_code: "SYL-7K2P",
      p_note: "front desk",
    });
  });

  it("sends a null note when the staff gives none", async () => {
    const { calls, backend } = staff(200, {
      ok: false,
      check: { ...CHECK_ROW, status: "expired" },
    });
    const result = await backend.redeem("SYL-7K2P");
    expect(result.ok).toBe(false);
    expect(result.check.status).toBe("expired");
    expect(JSON.parse(String(calls[0]?.init.body)).p_note).toBeNull();
  });

  it("lists codes", async () => {
    const { calls, backend } = staff(200, [
      {
        code: "SYL-7K2P",
        nickname: "AdaTest",
        score: 210,
        kind: "share",
        referrals: 5,
        earned_at: "2026-12-10T18:30:00+00:00",
        used_at: null,
      },
    ]);
    expect(await backend.listCodes(50, 0)).toEqual([
      {
        code: "SYL-7K2P",
        nickname: "AdaTest",
        score: 210,
        kind: "share",
        referrals: 5,
        earnedAt: "2026-12-10T18:30:00+00:00",
        usedAt: null,
      },
    ]);
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({
      p_limit: 50,
      p_offset: 0,
    });
  });

  it("reads dashboard stats", async () => {
    const { calls, backend } = staff(200, {
      players: 12,
      codes: 7,
      share_codes: 1,
      redeemed: 2,
    });
    expect(await backend.stats()).toEqual({
      players: 12,
      codes: 7,
      shareCodes: 1,
      redeemed: 2,
    });
    expect(calls[0]?.url).toBe(`${URL_BASE}/rest/v1/rpc/dashboard_stats`);
  });

  it("hides a nickname", async () => {
    const { calls, backend } = staff(200, true);
    expect(await backend.hideNickname("AdaTest")).toBe(true);
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({
      p_nickname: "AdaTest",
    });
  });
});

describe("Supabase adapter errors", () => {
  async function failure(status: number, body: unknown): Promise<unknown> {
    const { fetchFn } = fakeFetch(status, body);
    const backend = createSupabaseStaff({
      url: URL_BASE,
      anonKey: ANON,
      accessToken: ANON,
      fetch: fetchFn,
    });
    return backend.redeem("SYL-7K2P").catch((error: unknown) => error);
  }

  it("gives forbidden when RLS or the staff check denies the call", async () => {
    const denied = await failure(401, {
      code: "42501",
      message: "permission denied for function redeem_code",
    });
    expect(denied).toBeInstanceOf(BackendError);
    expect(denied).toMatchObject({
      kind: "forbidden",
      name: "BackendError",
      message: "redeem_code: permission denied for function redeem_code",
    });
  });

  it("gives forbidden for HTTP 403 and for SQL state 42501", async () => {
    expect(await failure(403, {})).toMatchObject({ kind: "forbidden" });
    expect(await failure(400, { code: "42501" })).toMatchObject({
      kind: "forbidden",
    });
  });

  it("gives server for other HTTP errors, also with a non-JSON body", async () => {
    expect(await failure(500, { message: "boom" })).toMatchObject({
      kind: "server",
      message: "redeem_code: boom",
    });
    const fetchFn = (async () =>
      new Response("Bad Gateway", { status: 502 })) as typeof fetch;
    const backend = createSupabaseStaff({
      url: URL_BASE,
      anonKey: ANON,
      accessToken: STAFF_TOKEN,
      fetch: fetchFn,
    });
    await expect(backend.stats()).rejects.toMatchObject({
      kind: "server",
      message: "dashboard_stats: HTTP 502",
    });
  });

  it("gives network when fetch throws a value that is not an Error", async () => {
    const backend = createSupabaseStaff({
      url: URL_BASE,
      anonKey: ANON,
      accessToken: STAFF_TOKEN,
      fetch: (async () => {
        throw "socket closed";
      }) as typeof fetch,
    });
    await expect(backend.stats()).rejects.toMatchObject({
      kind: "network",
      message: "dashboard_stats: socket closed",
    });
  });

  it("gives network when fetch throws", async () => {
    const backend = createSupabaseStaff({
      url: URL_BASE,
      anonKey: ANON,
      accessToken: STAFF_TOKEN,
      fetch: offline(),
    });
    await expect(backend.check("SYL-7K2P")).rejects.toMatchObject({
      kind: "network",
      message: "check_code: offline",
    });
  });
});
