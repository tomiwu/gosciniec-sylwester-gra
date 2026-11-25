import { describe, expect, it } from "vitest";
import { createMemoryStorage, createMockKodyAuth } from "./auth";
import { createPanel, isPanelSection, type PanelState } from "./controller";
import type { KodySession, StaffAuth } from "./auth";

const staff = { userId: "kody-user-1", username: "staff-test" };
const guest = { userId: "kody-user-2", username: "guest-test" };

function setup(user: KodySession, storage = createMemoryStorage()) {
  const states: PanelState[] = [];
  const auth = createMockKodyAuth({ storage, user });
  const panel = createPanel({
    auth,
    allowList: ["staff-test"],
    render: (state) => states.push(state),
  });
  return { panel, states, storage };
}

function last(states: PanelState[]): PanelState | undefined {
  return states[states.length - 1];
}

describe("createPanel", () => {
  it("renders the login state when no session exists", async () => {
    const { panel, states } = setup(staff);
    await panel.start();
    expect(last(states)).toEqual({
      session: null,
      allowList: ["staff-test"],
      section: "check",
    });
  });

  it("renders the staff session after sign-in and selects a section", async () => {
    const { panel, states } = setup(staff);
    await panel.start();
    await panel.signIn();
    expect(last(states)?.session).toEqual(staff);
    panel.select("ranking");
    expect(last(states)?.section).toBe("ranking");
  });

  it("restores the session on start and clears it on logout", async () => {
    const storage = createMemoryStorage();
    await setup(staff, storage).panel.signIn();
    const { panel, states } = setup(staff, storage);
    await panel.start();
    expect(last(states)?.session).toEqual(staff);
    await panel.signOut();
    expect(last(states)?.session).toBeNull();
    expect(last(states)?.section).toBe("check");
  });

  it("keeps the session of a user who is not staff, for the no-access view", async () => {
    const { panel, states } = setup(guest);
    await panel.signIn();
    expect(last(states)?.session).toEqual(guest);
  });

  it("falls back to the login state when the auth call fails", async () => {
    const states: PanelState[] = [];
    const failing: StaffAuth = {
      restore: () => Promise.reject(new Error("offline")),
      signIn: () => Promise.reject(new Error("offline")),
      signOut: () => Promise.reject(new Error("offline")),
    };
    const panel = createPanel({
      auth: failing,
      allowList: ["staff-test"],
      render: (state) => states.push(state),
    });
    await panel.start();
    expect(last(states)?.session).toBeNull();
    await panel.signIn();
    expect(last(states)?.session).toBeNull();
    await panel.signOut();
    expect(last(states)?.session).toBeNull();
  });
});

describe("isPanelSection", () => {
  it("accepts only the known sections", () => {
    expect(isPanelSection("ranking")).toBe(true);
    expect(isPanelSection("admin")).toBe(false);
    expect(isPanelSection(undefined)).toBe(false);
  });
});
