import { describe, expect, it } from "vitest";
import {
  createMemoryStorage,
  createMockKodyAuth,
  isStaff,
  MOCK_SESSION_KEY,
} from "./auth";

const staff = { userId: "kody-user-1", username: "staff-test" };
const guest = { userId: "kody-user-2", username: "guest-test" };

describe("isStaff", () => {
  it("accepts a username or a user id on the allow-list", () => {
    expect(isStaff(staff, ["staff-test"])).toBe(true);
    expect(isStaff(staff, ["kody-user-1"])).toBe(true);
  });

  it("rejects no session and a user who is not on the list", () => {
    expect(isStaff(null, ["staff-test"])).toBe(false);
    expect(isStaff(guest, ["staff-test"])).toBe(false);
    expect(isStaff(staff, [])).toBe(false);
  });

  it("ignores case and spaces in the username only", () => {
    expect(isStaff(staff, [" Staff-Test "])).toBe(true);
    expect(isStaff(staff, ["KODY-USER-1"])).toBe(false);
  });
});

describe("createMockKodyAuth", () => {
  it("has no session before sign-in", async () => {
    const auth = createMockKodyAuth({
      storage: createMemoryStorage(),
      user: staff,
    });
    expect(await auth.restore()).toBeNull();
  });

  it("signs in the mock user and keeps the session in storage", async () => {
    const storage = createMemoryStorage();
    const auth = createMockKodyAuth({ storage, user: staff });
    expect(await auth.signIn()).toEqual(staff);
    expect(storage.getItem(MOCK_SESSION_KEY)).not.toBeNull();
  });

  it("restores the session after a refresh", async () => {
    const storage = createMemoryStorage();
    await createMockKodyAuth({ storage, user: staff }).signIn();
    const afterRefresh = createMockKodyAuth({ storage, user: guest });
    expect(await afterRefresh.restore()).toEqual(staff);
  });

  it("signs in a user who is not staff without a change of identity", async () => {
    const auth = createMockKodyAuth({
      storage: createMemoryStorage(),
      user: guest,
    });
    const session = await auth.signIn();
    expect(session).toEqual(guest);
    expect(isStaff(session, ["staff-test"])).toBe(false);
  });

  it("removes the session on logout", async () => {
    const storage = createMemoryStorage();
    const auth = createMockKodyAuth({ storage, user: staff });
    await auth.signIn();
    await auth.signOut();
    expect(storage.getItem(MOCK_SESSION_KEY)).toBeNull();
    expect(await auth.restore()).toBeNull();
  });

  it("ignores a broken or partial stored session", async () => {
    const storage = createMemoryStorage();
    const auth = createMockKodyAuth({ storage, user: staff });
    storage.setItem(MOCK_SESSION_KEY, "{not json");
    expect(await auth.restore()).toBeNull();
    storage.setItem(MOCK_SESSION_KEY, JSON.stringify({ username: "x" }));
    expect(await auth.restore()).toBeNull();
    storage.setItem(MOCK_SESSION_KEY, "null");
    expect(await auth.restore()).toBeNull();
  });
});

describe("createMemoryStorage", () => {
  it("returns null for a missing key and removes a key", () => {
    const storage = createMemoryStorage();
    expect(storage.getItem("k")).toBeNull();
    storage.setItem("k", "v");
    expect(storage.getItem("k")).toBe("v");
    storage.removeItem("k");
    expect(storage.getItem("k")).toBeNull();
  });
});
