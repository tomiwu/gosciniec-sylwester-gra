import { describe, expect, it, vi } from "vitest";
import type { KodyUser } from "./handler";

const resolveUser = vi.fn(async (): Promise<KodyUser | null> => null);
const createPackageAppAuth = vi.fn(() => ({ resolveUser }));

vi.mock("kody:@kentcdodds/package-app-kit/auth", () => ({
  createPackageAppAuth,
}));

vi.mock("./config", async (importOriginal) => {
  const real = await importOriginal<typeof import("./config")>();
  return {
    ...real,
    KODY_APP: {
      ...real.KODY_APP,
      supabaseUrl: "https://example-project.supabase.co",
    },
  };
});

const STATS = "https://game.example.test/api/staff/stats";

describe("Kody entry", () => {
  it("wires Sign in with Kody with the package name", async () => {
    const { default: app } = await import("./entry");
    expect(createPackageAppAuth).toHaveBeenCalledWith({
      packageName: "gosciniec-sylwester-gra",
    });
    const res = await app.fetch(new Request(STATS));
    expect(res.status).toBe(401);
    expect(resolveUser).toHaveBeenCalledOnce();
  });

  it("sends staff RPCs through the global fetch", async () => {
    const fakeFetch = vi.fn<typeof fetch>(async () => new Response("{}"));
    vi.stubGlobal("fetch", fakeFetch);
    const { default: app } = await import("./entry");
    resolveUser.mockResolvedValueOnce({ id: "u-1", username: "tomiwu" });
    const res = await app.fetch(new Request(STATS));
    vi.unstubAllGlobals();
    expect(res.status).toBe(200);
    expect(fakeFetch.mock.calls[0]?.[0]).toBe(
      "https://example-project.supabase.co/rest/v1/rpc/dashboard_stats",
    );
  });
});
