import { describe, expect, it } from "vitest";
import {
  createKodyHostAuth,
  isKodyHost,
  sessionFromMe,
} from "./kody-host-auth";

describe("isKodyHost", () => {
  it("accepts package-app hosts and rejects others", () => {
    expect(isKodyHost("gosciniec-sylwester-gra--tomiwu.kody.run")).toBe(true);
    expect(isKodyHost("example.kody.codes")).toBe(true);
    expect(isKodyHost("tomiwu.github.io")).toBe(false);
    expect(isKodyHost("localhost")).toBe(false);
  });
});

describe("sessionFromMe", () => {
  it("reads nested and flat user objects", () => {
    expect(sessionFromMe({ user: { id: "u1", username: "tomiwu" } })).toEqual({
      userId: "u1",
      username: "tomiwu",
    });
    expect(sessionFromMe({ userId: "u1", username: "tomiwu" })).toEqual({
      userId: "u1",
      username: "tomiwu",
    });
    expect(sessionFromMe({})).toBeNull();
  });
});

describe("createKodyHostAuth", () => {
  it("restores a session from /-/auth/me and sends the user to login", async () => {
    const assigned: string[] = [];
    const auth = createKodyHostAuth({
      fetch: async () =>
        new Response(
          JSON.stringify({ user: { id: "u1", username: "tomiwu" } }),
          {
            status: 200,
          },
        ),
      assign: (url) => assigned.push(url),
    });
    expect(await auth.restore()).toEqual({ userId: "u1", username: "tomiwu" });
    await auth.signIn();
    expect(assigned).toEqual(["/-/auth/login?return_to=/panel/"]);
    await auth.signOut();
    expect(assigned).toEqual([
      "/-/auth/login?return_to=/panel/",
      "/-/auth/logout?return_to=/panel/",
    ]);
  });

  it("returns no session when the me route is not signed in", async () => {
    const auth = createKodyHostAuth({
      fetch: async () => new Response("{}", { status: 401 }),
      assign: () => undefined,
    });
    expect(await auth.restore()).toBeNull();
  });
});
