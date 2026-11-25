import { describe, expect, it, vi } from "vitest";
import { SERVICE_ROLE_PLACEHOLDER } from "./staff-rpc";
import { handleRequest, type AppUser, type HandleDeps } from "./handle";

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

  it("calls check_code with the service-role placeholder when staff is signed in", async () => {
    const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toContain("/rpc/check_code");
      const headers = new Headers(init?.headers);
      expect(headers.get("apikey")).toBe(SERVICE_ROLE_PLACEHOLDER);
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
