import { describe, expect, it } from "vitest";
import { STAFF } from "../config";
import { StaffApiError, createHttpStaffApi, parseCheck } from "./staff-api";

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
