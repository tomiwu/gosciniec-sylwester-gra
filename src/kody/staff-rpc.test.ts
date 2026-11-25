import { describe, expect, it, vi } from "vitest";
import {
  SERVICE_ROLE_PLACEHOLDER,
  STAFF_HOST,
  callStaffRpc,
  staffRpcHeaders,
  staffRpcUrl,
} from "./staff-rpc";

describe("callStaffRpc", () => {
  it("posts to the approved host with the secret placeholder, never a live key", async () => {
    const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe(
        "https://csyrndeuldzbbkizmcav.supabase.co/rest/v1/rpc/check_code",
      );
      expect(new URL(url).host).toBe(STAFF_HOST);
      const headers = new Headers(init?.headers);
      expect(headers.get("Authorization")).toBe(
        `Bearer ${SERVICE_ROLE_PLACEHOLDER}`,
      );
      expect(headers.get("apikey")).toBe(SERVICE_ROLE_PLACEHOLDER);
      expect(init?.body).not.toMatch(/sb_/);
      return new Response(
        JSON.stringify({ status: "valid", code: "SYL-TEST" }),
        {
          status: 200,
        },
      );
    });

    const result = await callStaffRpc(
      "check_code",
      { p_code: "SYL-TEST" },
      { fetch: fetchFn as unknown as typeof fetch },
    );
    expect(result).toEqual({
      ok: true,
      status: 200,
      body: { status: "valid", code: "SYL-TEST" },
    });
  });

  it("keeps a non-JSON error body as an object", async () => {
    const fetchFn = vi.fn(async () => new Response("boom", { status: 500 }));
    const result = await callStaffRpc("redeem_code", {}, { fetch: fetchFn });
    expect(result.ok).toBe(false);
    expect(result.body).toEqual({ error: "boom" });
  });
});

describe("staffRpc helpers", () => {
  it("builds the RPC URL and headers", () => {
    expect(staffRpcUrl("dashboard_stats")).toContain("/rpc/dashboard_stats");
    const headers = new Headers(
      staffRpcHeaders("{{secret:supabaseServiceRole}}"),
    );
    expect(headers.get("apikey")).toBe(SERVICE_ROLE_PLACEHOLDER);
  });
});
