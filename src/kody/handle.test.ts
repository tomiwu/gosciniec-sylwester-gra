import { describe, expect, it, vi } from "vitest";
import {
  handleRequest,
  visitorFromHeader,
  type AppUser,
  type HandleDeps,
} from "./handle";

const staff: AppUser = { id: "1", username: "tomiwu" };
const guest: AppUser = { id: "2", username: "stranger" };

function deps(user: AppUser | null, fetchFn: typeof fetch): HandleDeps {
  return {
    fetch: fetchFn,
    allowList: ["tomiwu"],
    resolveUser: async () => user,
  };
}

function rpcOk(body: unknown) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }));
}

describe("handleRequest", () => {
  it("sends the game and the panel to the built assets", async () => {
    const game = await handleRequest(
      new Request("https://app.example/"),
      deps(null, rpcOk({})),
    );
    expect(game.status).toBe(302);
    expect(game.headers.get("Location")).toBe(
      "https://app.example/_assets/index.html",
    );

    const panel = await handleRequest(
      new Request("https://app.example/panel/"),
      deps(null, rpcOk({})),
    );
    expect(panel.headers.get("Location")).toBe(
      "https://app.example/_assets/panel/index.html",
    );
  });

  it("rejects a staff RPC when the Kody user is not on the allow list", async () => {
    const fetchFn = rpcOk({ ok: true });
    const response = await handleRequest(
      new Request("https://app.example/api/staff/check", {
        method: "POST",
        body: JSON.stringify({ code: "SYL-TEST" }),
      }),
      deps(guest, fetchFn),
    );
    expect(response.status).toBe(401);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("calls check_code when staff is signed in", async () => {
    const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toContain("/rpc/check_code");
      expect(String(init?.body)).toBe(JSON.stringify({ p_code: "SYL-SBAA" }));
      return new Response(
        JSON.stringify({ status: "valid", code: "SYL-SBAA" }),
        {
          status: 200,
        },
      );
    });
    const response = await handleRequest(
      new Request("https://app.example/api/staff/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: "SYL-SBAA" }),
      }),
      deps(staff, fetchFn as unknown as typeof fetch),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "valid",
      code: "SYL-SBAA",
    });
  });

  it("lists codes and ranking for staff", async () => {
    const fetchFn = rpcOk([{ nickname: "TEST-NOCNY", score: 200 }]);
    const ranking = await handleRequest(
      new Request("https://app.example/api/staff/ranking"),
      deps(staff, fetchFn),
    );
    expect(ranking.status).toBe(200);
    expect(await ranking.json()).toEqual([
      { nickname: "TEST-NOCNY", score: 200 },
    ]);
  });
});

describe("handleRequest staff routes", () => {
  it("returns the current user on /api/staff/me", async () => {
    const response = await handleRequest(
      new Request("https://app.example/api/staff/me"),
      deps(staff, rpcOk({})),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ user: staff });
  });

  it("posts redeem and hide-nickname, and serves stats", async () => {
    const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
      const path = new URL(url).pathname;
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<
        string,
        unknown
      >;
      if (path.endsWith("/redeem_code")) {
        expect(body.p_note).toBe("desk 1");
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      if (path.endsWith("/hide_nickname")) {
        expect(body.p_nickname).toBe("TEST-NOCNY");
        return new Response(JSON.stringify(true), { status: 200 });
      }
      if (path.endsWith("/dashboard_stats")) {
        return new Response(
          JSON.stringify({ players: 1, codes: 1, share_codes: 0, redeemed: 0 }),
          { status: 200 },
        );
      }
      if (path.endsWith("/list_codes")) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      return new Response("no", { status: 404 });
    });
    const common = deps(staff, fetchFn as unknown as typeof fetch);
    const redeem = await handleRequest(
      new Request("https://app.example/api/staff/redeem", {
        method: "POST",
        body: JSON.stringify({ code: "SYL-SBAA", note: "desk 1" }),
      }),
      common,
    );
    expect(redeem.status).toBe(200);
    const hide = await handleRequest(
      new Request("https://app.example/api/staff/hide-nickname", {
        method: "POST",
        body: JSON.stringify({ nickname: "TEST-NOCNY" }),
      }),
      common,
    );
    expect(await hide.json()).toBe(true);
    const stats = await handleRequest(
      new Request("https://app.example/api/staff/stats"),
      common,
    );
    expect((await stats.json()).players).toBe(1);
    const codes = await handleRequest(
      new Request("https://app.example/api/staff/codes"),
      common,
    );
    expect(await codes.json()).toEqual([]);
  });

  it("returns 404 for an unknown staff path or a non-GET/POST method", async () => {
    const missing = await handleRequest(
      new Request("https://app.example/api/staff/unknown"),
      deps(staff, rpcOk({})),
    );
    expect(missing.status).toBe(404);
    const weird = await handleRequest(
      new Request("https://app.example/api/staff/stats", { method: "PUT" }),
      deps(staff, rpcOk({})),
    );
    expect(weird.status).toBe(404);
    const other = await handleRequest(
      new Request("https://app.example/favicon.ico"),
      deps(null, rpcOk({})),
    );
    expect(other.status).toBe(404);
  });

  it("replays a staff round from its packed log", async () => {
    const fetchFn = vi.fn(async (url: string) => {
      if (String(url).includes("get_round_log")) {
        return new Response(
          JSON.stringify({ seed: 1, input_log: "not-json", score: 10 }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify(true), { status: 200 });
    });
    const response = await handleRequest(
      new Request("https://app.example/api/staff/verify-round", {
        method: "POST",
        body: JSON.stringify({ roundId: "r1" }),
      }),
      deps(staff, fetchFn as unknown as typeof fetch),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { ok: boolean; score: number };
    expect(body.ok).toBe(false);
    expect(body.score).toBe(10);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("rejects a missing round id and a failed log lookup", async () => {
    const missing = await handleRequest(
      new Request("https://app.example/api/staff/verify-round", {
        method: "POST",
        body: JSON.stringify({}),
      }),
      deps(staff, rpcOk({})),
    );
    expect(missing.status).toBe(400);
    const fetchFn = vi.fn(async () => new Response("missing", { status: 404 }));
    const failed = await handleRequest(
      new Request("https://app.example/api/staff/verify-round", {
        method: "POST",
        body: JSON.stringify({ roundId: "r-missing" }),
      }),
      deps(staff, fetchFn as unknown as typeof fetch),
    );
    expect(failed.status).toBe(404);
  });
});

describe("visitorFromHeader", () => {
  it("reads a complete visitor and rejects a bad payload", () => {
    expect(
      visitorFromHeader(JSON.stringify({ userId: "u1", username: "tomiwu" })),
    ).toEqual({ id: "u1", username: "tomiwu" });
    expect(visitorFromHeader(null)).toBeNull();
    expect(visitorFromHeader("{")).toBeNull();
    expect(visitorFromHeader(JSON.stringify({ userId: "u1" }))).toBeNull();
  });
});
