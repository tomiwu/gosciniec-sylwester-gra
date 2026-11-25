import { describe, expect, it, vi } from "vitest";
import {
  SERVICE_ROLE_SECRET,
  callStaffRpc,
  isApprovedSupabaseUrl,
  rpcUrl,
} from "./supabase";

const BASE = "https://example-project.supabase.co";

function fakeFetch(response: Response | Error) {
  return vi.fn<typeof fetch>(async () => {
    if (response instanceof Error) throw response;
    return response;
  });
}

describe("isApprovedSupabaseUrl", () => {
  it("accepts an https Supabase project URL", () => {
    expect(isApprovedSupabaseUrl(BASE)).toBe(true);
    expect(isApprovedSupabaseUrl(`${BASE}/`)).toBe(true);
  });

  it("rejects an empty value, another host, http, or a path", () => {
    expect(isApprovedSupabaseUrl("")).toBe(false);
    expect(isApprovedSupabaseUrl("not a url")).toBe(false);
    expect(isApprovedSupabaseUrl("https://example.com")).toBe(false);
    expect(isApprovedSupabaseUrl("https://supabase.co.example.com")).toBe(
      false,
    );
    expect(isApprovedSupabaseUrl("http://example-project.supabase.co")).toBe(
      false,
    );
    expect(isApprovedSupabaseUrl(`${BASE}/rest/v1`)).toBe(false);
  });
});

describe("rpcUrl", () => {
  it("builds the PostgREST RPC URL", () => {
    expect(rpcUrl(`${BASE}/`, "check_code")).toBe(
      `${BASE}/rest/v1/rpc/check_code`,
    );
  });
});

describe("callStaffRpc", () => {
  it("posts the args with the secret placeholder, never a value", async () => {
    const fetchFn = fakeFetch(new Response('{"status":"valid"}'));
    const res = await callStaffRpc(fetchFn, BASE, "check_code", {
      p_code: "SYL-ABCD",
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "valid" });
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe(`${BASE}/rest/v1/rpc/check_code`);
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe('{"p_code":"SYL-ABCD"}');
    const headers = new Headers(init?.headers);
    expect(SERVICE_ROLE_SECRET).toBe("{{secret:supabaseServiceRole}}");
    expect(headers.get("apikey")).toBe(SERVICE_ROLE_SECRET);
    expect(headers.get("authorization")).toBe(`Bearer ${SERVICE_ROLE_SECRET}`);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("passes the Supabase status and body through", async () => {
    const fetchFn = fakeFetch(
      new Response('{"message":"bad"}', { status: 400 }),
    );
    const res = await callStaffRpc(fetchFn, BASE, "redeem_code", {});
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ message: "bad" });
  });

  it("answers 502 when Supabase cannot be reached", async () => {
    const fetchFn = fakeFetch(new Error("offline"));
    const res = await callStaffRpc(fetchFn, BASE, "dashboard_stats", {});
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "supabase_unreachable" });
  });
});
