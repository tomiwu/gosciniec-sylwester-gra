import { describe, expect, it, vi } from "vitest";
import { createHandler, type HandlerDeps, type KodyUser } from "./handler";
import { SERVICE_ROLE_SECRET } from "./supabase";

const ORIGIN = "https://game.example.test";
const SUPABASE = "https://example-project.supabase.co";
const STAFF: KodyUser = { id: "u-1", username: "tomiwu" };
const GUEST: KodyUser = { id: "u-2", username: "someone-else" };

function setup(user: KodyUser | null, overrides: Partial<HandlerDeps> = {}) {
  const fetchFn = vi.fn<typeof fetch>(
    async () => new Response('{"ok":true}', { status: 200 }),
  );
  const resolveUser = vi.fn(async () => user);
  const handler = createHandler({
    resolveUser,
    fetch: fetchFn,
    allowList: ["tomiwu"],
    supabaseUrl: SUPABASE,
    ...overrides,
  });
  return { handler, fetchFn, resolveUser };
}

function get(path: string): Request {
  return new Request(`${ORIGIN}${path}`);
}

function post(path: string, body: unknown, origin = ORIGIN): Request {
  return new Request(`${ORIGIN}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function lastRpc(fetchFn: ReturnType<typeof setup>["fetchFn"]) {
  const [url, init] = fetchFn.mock.calls.at(-1)!;
  return {
    url,
    body: JSON.parse(String(init?.body)) as unknown,
    headers: new Headers(init?.headers),
  };
}

describe("public game", () => {
  it.each(["/", "/index.html"])(
    "serves %s without a login or Supabase",
    async (path) => {
      const { handler, fetchFn, resolveUser } = setup(null);
      const res = await handler.fetch(get(path));
      expect(res.status).toBe(302);
      expect(res.headers.get("location")).toBe(`${ORIGIN}/_assets/index.html`);
      expect(resolveUser).not.toHaveBeenCalled();
      expect(fetchFn).not.toHaveBeenCalled();
    },
  );

  it("answers 404 for an unknown path", async () => {
    const { handler, fetchFn } = setup(STAFF);
    const res = await handler.fetch(get("/nothing"));
    expect(res.status).toBe(404);
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe("/panel/", () => {
  it("sends a visitor without a session to Sign in with Kody", async () => {
    const { handler, fetchFn } = setup(null);
    const res = await handler.fetch(get("/panel/"));
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(
      `${ORIGIN}/-/auth/login?returnTo=%2Fpanel%2F`,
    );
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("rejects a signed-in user who is not on the staff list", async () => {
    const { handler, fetchFn } = setup(GUEST);
    const res = await handler.fetch(get("/panel"));
    expect(res.status).toBe(403);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("serves the panel to a staff user", async () => {
    const { handler, fetchFn } = setup(STAFF);
    const res = await handler.fetch(get("/panel/"));
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("tomiwu");
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("matches the allow list without regard to letter case", async () => {
    const { handler } = setup({ id: "u-3", username: "TomiWu" });
    const res = await handler.fetch(get("/panel/"));
    expect(res.status).toBe(200);
  });

  it("rejects a non-GET method", async () => {
    const { handler } = setup(STAFF);
    const res = await handler.fetch(post("/panel/", {}));
    expect(res.status).toBe(405);
  });
});

describe("staff API access", () => {
  it("rejects a request without a session and does not call Supabase", async () => {
    const { handler, fetchFn } = setup(null);
    const res = await handler.fetch(post("/api/staff/check", { code: "X" }));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      error: "unauthenticated",
      loginUrl: "/-/auth/login?returnTo=%2Fpanel%2F",
    });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("rejects a non-staff user and does not call Supabase", async () => {
    const { handler, fetchFn } = setup(GUEST);
    const res = await handler.fetch(get("/api/staff/stats"));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "forbidden" });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("rejects everyone when the allow list is empty", async () => {
    const { handler, fetchFn } = setup(STAFF, { allowList: [] });
    const res = await handler.fetch(get("/api/staff/stats"));
    expect(res.status).toBe(403);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it.each(["unknown", "constructor", "__proto__", "toString"])(
    "answers 404 for the unknown staff route %s after the auth check",
    async (name) => {
      const { handler, fetchFn } = setup(STAFF);
      const res = await handler.fetch(get(`/api/staff/${name}`));
      expect(res.status).toBe(404);
      expect(fetchFn).not.toHaveBeenCalled();
    },
  );

  it("answers 405 for a wrong method", async () => {
    const { handler, fetchFn } = setup(STAFF);
    const res = await handler.fetch(get("/api/staff/redeem"));
    expect(res.status).toBe(405);
    expect(res.headers.get("allow")).toBe("POST");
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("rejects a POST from another origin", async () => {
    const { handler, fetchFn } = setup(STAFF);
    const res = await handler.fetch(
      post("/api/staff/redeem", { code: "SYL-ABCD" }, "https://evil.test"),
    );
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "bad_origin" });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("answers 503 when the Supabase URL is not set", async () => {
    const { handler, fetchFn } = setup(STAFF, { supabaseUrl: "" });
    const res = await handler.fetch(get("/api/staff/stats"));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "supabase_not_configured" });
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe("staff API routes reach the fake Supabase", () => {
  it("check sends p_code with the secret placeholder", async () => {
    const { handler, fetchFn } = setup(STAFF);
    const res = await handler.fetch(
      post("/api/staff/check", { code: " SYL-ABCD " }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    const rpc = lastRpc(fetchFn);
    expect(rpc.url).toBe(`${SUPABASE}/rest/v1/rpc/check_code`);
    expect(rpc.body).toEqual({ p_code: "SYL-ABCD" });
    expect(rpc.headers.get("apikey")).toBe(SERVICE_ROLE_SECRET);
  });

  it("redeem sends p_code and the optional note", async () => {
    const { handler, fetchFn } = setup(STAFF);
    await handler.fetch(
      post("/api/staff/redeem", { code: "SYL-ABCD", note: "Table 4" }),
    );
    expect(lastRpc(fetchFn).body).toEqual({
      p_code: "SYL-ABCD",
      p_note: "Table 4",
    });
    await handler.fetch(post("/api/staff/redeem", { code: "SYL-ABCD" }));
    const rpc = lastRpc(fetchFn);
    expect(rpc.url).toBe(`${SUPABASE}/rest/v1/rpc/redeem_code`);
    expect(rpc.body).toEqual({ p_code: "SYL-ABCD", p_note: null });
  });

  it("codes sends the page limits, with defaults and clamps", async () => {
    const { handler, fetchFn } = setup(STAFF);
    await handler.fetch(get("/api/staff/codes"));
    expect(lastRpc(fetchFn).url).toBe(`${SUPABASE}/rest/v1/rpc/list_codes`);
    expect(lastRpc(fetchFn).body).toEqual({ p_limit: 50, p_offset: 0 });
    await handler.fetch(get("/api/staff/codes?limit=20&offset=40"));
    expect(lastRpc(fetchFn).body).toEqual({ p_limit: 20, p_offset: 40 });
    await handler.fetch(get("/api/staff/codes?limit=9999&offset=-3"));
    expect(lastRpc(fetchFn).body).toEqual({ p_limit: 200, p_offset: 0 });
    await handler.fetch(get("/api/staff/codes?limit=abc"));
    expect(lastRpc(fetchFn).body).toEqual({ p_limit: 50, p_offset: 0 });
  });

  it("stats calls dashboard_stats", async () => {
    const { handler, fetchFn } = setup(STAFF);
    await handler.fetch(get("/api/staff/stats"));
    expect(lastRpc(fetchFn).url).toBe(
      `${SUPABASE}/rest/v1/rpc/dashboard_stats`,
    );
    expect(lastRpc(fetchFn).body).toEqual({});
  });

  it("hide-nickname sends p_nickname", async () => {
    const { handler, fetchFn } = setup(STAFF);
    await handler.fetch(
      post("/api/staff/hide-nickname", { nickname: "Player One" }),
    );
    const rpc = lastRpc(fetchFn);
    expect(rpc.url).toBe(`${SUPABASE}/rest/v1/rpc/hide_nickname`);
    expect(rpc.body).toEqual({ p_nickname: "Player One" });
  });

  it("accepts a POST without an Origin header", async () => {
    const { handler, fetchFn } = setup(STAFF);
    const req = new Request(`${ORIGIN}/api/staff/check`, {
      method: "POST",
      body: '{"code":"SYL-ABCD"}',
    });
    const res = await handler.fetch(req);
    expect(res.status).toBe(200);
    expect(fetchFn).toHaveBeenCalledOnce();
  });

  it.each([
    ["/api/staff/check", "{not json"],
    ["/api/staff/check", { code: "" }],
    ["/api/staff/check", { code: 42 }],
    ["/api/staff/check", { code: "X".repeat(33) }],
    ["/api/staff/redeem", { code: "SYL-ABCD", note: 7 }],
    ["/api/staff/redeem", { code: "SYL-ABCD", note: "n".repeat(201) }],
    ["/api/staff/hide-nickname", { nickname: "   " }],
    ["/api/staff/hide-nickname", { nickname: "n".repeat(17) }],
    ["/api/staff/hide-nickname", null],
  ])("rejects bad input for %s (%j)", async (path, body) => {
    const { handler, fetchFn } = setup(STAFF);
    const res = await handler.fetch(post(path, body));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_input" });
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe("defaults", () => {
  it("uses the config allow list and answers 503 while the Supabase URL is unset", async () => {
    const fetchFn = vi.fn<typeof fetch>();
    const handler = createHandler({
      resolveUser: async () => STAFF,
      fetch: fetchFn,
    });
    const res = await handler.fetch(get("/api/staff/stats"));
    expect(res.status).toBe(503);
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
