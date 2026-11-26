import { describe, expect, it } from "vitest";
import { createMemoryStorage, createMockKodyAuth } from "./auth";
import {
  createPanel,
  isPanelSection,
  visibleCodes,
  type PanelState,
} from "./controller";
import type { KodySession, StaffAuth } from "./auth";
import type { CodeCheck, StaffBackend } from "../backend/types";

const staff = { userId: "kody-user-1", username: "staff-test" };
const guest = { userId: "kody-user-2", username: "guest-test" };

const valid: CodeCheck = {
  code: "SYL-SBAA",
  status: "valid",
  nickname: "TEST-NOCNY",
  kind: "base",
  discountPercent: 10,
  pricePerPerson: 333,
  earnedAt: "2026-11-25T21:00:00Z",
  usedAt: null,
};

function fakeStaff(overrides: Partial<StaffBackend> = {}): StaffBackend {
  return {
    check: async () => valid,
    redeem: async () => ({
      ok: true,
      check: {
        ...valid,
        status: "already_used",
        usedAt: "2026-11-25T22:00:00Z",
      },
    }),
    listCodes: async () => [
      {
        code: "SYL-SBAA",
        nickname: "TEST-NOCNY",
        score: 200,
        kind: "base",
        referrals: 0,
        earnedAt: "2026-11-25T21:00:00Z",
        usedAt: null,
      },
    ],
    stats: async () => ({ players: 1, codes: 1, shareCodes: 0, redeemed: 0 }),
    hideNickname: async () => true,
    ...overrides,
  };
}

function setup(
  user: KodySession,
  storage = createMemoryStorage(),
  staffApi?: StaffBackend,
) {
  const states: PanelState[] = [];
  const auth = createMockKodyAuth({ storage, user });
  const options: Parameters<typeof createPanel>[0] = {
    auth,
    allowList: ["staff-test"],
    render: (state) => states.push(state),
    ranking: async () => [{ nickname: "TEST-NOCNY", score: 200 }],
  };
  if (staffApi) options.staff = staffApi;
  const panel = createPanel(options);
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

  it("shows a code check and then marks the code as used", async () => {
    const { panel, states } = setup(staff, createMemoryStorage(), fakeStaff());
    await panel.signIn();
    await panel.check("syl-sbaa");
    expect(last(states)?.check).toEqual(valid);
    await panel.redeem();
    expect(last(states)?.check?.status).toBe("already_used");
  });

  it("loads the list when the list section opens", async () => {
    const { panel, states } = setup(staff, createMemoryStorage(), fakeStaff());
    await panel.signIn();
    await panel.select("list");
    expect(last(states)?.list?.[0]?.code).toBe("SYL-SBAA");
    expect(last(states)?.stats?.codes).toBe(1);
  });
});

describe("isPanelSection", () => {
  it("accepts only the known sections", () => {
    expect(isPanelSection("ranking")).toBe(true);
    expect(isPanelSection("admin")).toBe(false);
    expect(isPanelSection(undefined)).toBe(false);
  });
});

describe("visibleCodes", () => {
  it("filters by kind and used state", () => {
    const list = [
      {
        code: "SYL-AAAA",
        nickname: "A",
        score: 1,
        kind: "base" as const,
        referrals: 0,
        earnedAt: "2026-11-25T21:00:00Z",
        usedAt: null,
      },
      {
        code: "SYL-BBBB",
        nickname: "B",
        score: 2,
        kind: "share" as const,
        referrals: 5,
        earnedAt: "2026-11-25T21:00:00Z",
        usedAt: "2026-11-25T22:00:00Z",
      },
    ];
    expect(
      visibleCodes({
        session: null,
        allowList: [],
        section: "list",
        list,
        listKind: "share",
      }),
    ).toHaveLength(1);
    expect(
      visibleCodes({
        session: null,
        allowList: [],
        section: "list",
        list,
        listUsed: "open",
      })[0]?.code,
    ).toBe("SYL-AAAA");
  });
});
