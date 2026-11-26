import { describe, expect, it } from "vitest";
import { selectBackend } from "./select";

function countingFetch() {
  const urls: string[] = [];
  const fetchFn = (async (input: string | URL | Request) => {
    urls.push(String(input));
    return new Response("[]", { status: 200 });
  }) as typeof fetch;
  return { urls, fetchFn };
}

describe("selectBackend", () => {
  it("uses the mock when no keys are set", async () => {
    const { urls, fetchFn } = countingFetch();
    const selected = selectBackend({}, fetchFn);
    expect(selected.mode).toBe("mock");
    const result = await selected.player.submit({
      nickname: "AdaTest",
      score: 210,
      deviceId: "device-ada",
    });
    const staff = selected.staff("ignored");
    expect((await staff.check(result.code)).status).toBe("valid");
    expect(urls).toEqual([]);
  });

  it("uses the mock when only one key is set or a key is blank", () => {
    const { fetchFn } = countingFetch();
    expect(
      selectBackend({ VITE_SUPABASE_URL: "https://x.example.test" }, fetchFn)
        .mode,
    ).toBe("mock");
    expect(
      selectBackend(
        { VITE_SUPABASE_URL: " ", VITE_SUPABASE_ANON_KEY: "fake-anon-key" },
        fetchFn,
      ).mode,
    ).toBe("mock");
  });

  it("uses Supabase when the URL and the anon key are set", async () => {
    const { urls, fetchFn } = countingFetch();
    const selected = selectBackend(
      {
        VITE_SUPABASE_URL: "https://x.example.test",
        VITE_SUPABASE_ANON_KEY: "fake-anon-key",
      },
      fetchFn,
    );
    expect(selected.mode).toBe("supabase");
    await selected.player.top(3);
    await selected.staff("fake-staff-session").listCodes(3, 0);
    expect(urls).toEqual([
      "https://x.example.test/rest/v1/rpc/leaderboard",
      "https://x.example.test/rest/v1/rpc/list_codes",
    ]);
  });
});
