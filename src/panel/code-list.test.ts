import { describe, expect, it } from "vitest";
import { STAFF } from "../config";
import {
  INITIAL_CODE_LIST,
  NO_FILTER,
  countsOf,
  createCodeList,
  filterCodes,
  parseFilter,
  visibleCodes,
  warsawDay,
  withStatus,
  type CodeListState,
} from "./code-list";
import { createMockStaffApi, type MockCode } from "./mock-staff-api";
import type { CodeListApi, CodeListEntry } from "./staff-api";

const BEFORE_END = new Date("2026-12-20T12:00:00.000Z");
const AFTER_END = new Date(STAFF.codeExpiresAtIso);

function entry(next: Partial<CodeListEntry>): CodeListEntry {
  return {
    code: "SYL-TEST",
    nickname: "TestPlayer",
    score: 210,
    kind: "base",
    referrals: 0,
    earnedAt: "2026-11-20T12:00:00.000Z",
    usedAt: null,
    ...next,
  };
}

/** Invented codes. One is earned at 00:30 on 1 December, Warsaw time. */
const ENTRIES: CodeListEntry[] = [
  entry({ code: "SYL-AAA1", kind: "base", referrals: 1 }),
  entry({
    code: "SYL-BBB2",
    kind: "share",
    referrals: 5,
    earnedAt: "2026-11-25T09:00:00.000Z",
    usedAt: "2026-11-26T10:00:00.000Z",
  }),
  entry({
    code: "SYL-CCC3",
    kind: "share",
    referrals: 6,
    earnedAt: "2026-11-30T23:30:00.000Z",
  }),
  entry({
    code: "SYL-DDD4",
    kind: "base",
    earnedAt: "2026-12-05T08:00:00.000Z",
    usedAt: "2026-12-06T18:00:00.000Z",
  }),
];

function codes(list: { code: string }[]): string[] {
  return list.map((c) => c.code);
}

function filtered(next: Partial<typeof NO_FILTER>, now = BEFORE_END): string[] {
  return codes(
    filterCodes(withStatus(ENTRIES, now), { ...NO_FILTER, ...next }),
  );
}

describe("warsawDay", () => {
  it("gives the calendar day in Europe/Warsaw", () => {
    expect(warsawDay("2026-11-20T12:00:00.000Z")).toBe("2026-11-20");
    expect(warsawDay("2026-11-30T23:30:00.000Z")).toBe("2026-12-01");
    expect(warsawDay("2026-07-01T22:30:00.000Z")).toBe("2026-07-02");
    expect(warsawDay("2026-07-01T21:30:00.000Z")).toBe("2026-07-01");
  });

  it("gives an empty day for a date that is not valid", () => {
    expect(warsawDay("not a date")).toBe("");
  });
});

describe("withStatus", () => {
  it("adds valid, already used or expired at the given time", () => {
    const before = withStatus(ENTRIES, BEFORE_END).map((c) => c.status);
    expect(before).toEqual(["valid", "already_used", "valid", "already_used"]);
    const after = withStatus(ENTRIES, AFTER_END).map((c) => c.status);
    expect(after).toEqual([
      "expired",
      "already_used",
      "expired",
      "already_used",
    ]);
  });
});

describe("filterCodes", () => {
  it("keeps every code with no filter", () => {
    expect(filtered({})).toEqual(codes(ENTRIES));
  });

  it("filters by status", () => {
    expect(filtered({ status: "valid" })).toEqual(["SYL-AAA1", "SYL-CCC3"]);
    expect(filtered({ status: "already_used" })).toEqual([
      "SYL-BBB2",
      "SYL-DDD4",
    ]);
    expect(filtered({ status: "expired" })).toEqual([]);
    expect(filtered({ status: "expired" }, AFTER_END)).toEqual([
      "SYL-AAA1",
      "SYL-CCC3",
    ]);
  });

  it("filters by discount type", () => {
    expect(filtered({ kind: "base" })).toEqual(["SYL-AAA1", "SYL-DDD4"]);
    expect(filtered({ kind: "share" })).toEqual(["SYL-BBB2", "SYL-CCC3"]);
  });

  it("filters by date earned, from and to inclusive, in Warsaw time", () => {
    expect(filtered({ from: "2026-11-25" })).toEqual([
      "SYL-BBB2",
      "SYL-CCC3",
      "SYL-DDD4",
    ]);
    expect(filtered({ to: "2026-11-25" })).toEqual(["SYL-AAA1", "SYL-BBB2"]);
    expect(filtered({ from: "2026-11-25", to: "2026-11-25" })).toEqual([
      "SYL-BBB2",
    ]);
    expect(filtered({ to: "2026-11-30" })).toEqual(["SYL-AAA1", "SYL-BBB2"]);
    expect(filtered({ from: "2026-12-01", to: "2026-12-01" })).toEqual([
      "SYL-CCC3",
    ]);
  });

  it("gives an empty list when from is after to", () => {
    expect(filtered({ from: "2026-12-10", to: "2026-11-01" })).toEqual([]);
  });

  it("combines status, discount type and date", () => {
    expect(
      filtered({ status: "already_used", kind: "share", from: "2026-11-21" }),
    ).toEqual(["SYL-BBB2"]);
    expect(
      filtered({ status: "valid", kind: "share", to: "2026-11-30" }),
    ).toEqual([]);
    expect(
      filtered({ status: "valid", kind: "base", from: "2026-11-01" }),
    ).toEqual(["SYL-AAA1"]);
  });

  it("gives an empty list for no codes", () => {
    expect(filterCodes([], { ...NO_FILTER, status: "valid" })).toEqual([]);
  });
});

describe("parseFilter", () => {
  it("reads the form values", () => {
    expect(
      parseFilter({
        status: "expired",
        kind: "share",
        from: "2026-11-01",
        to: "2026-11-30",
      }),
    ).toEqual({
      status: "expired",
      kind: "share",
      from: "2026-11-01",
      to: "2026-11-30",
    });
  });

  it("uses no filter for a missing or unknown value", () => {
    expect(parseFilter({})).toEqual(NO_FILTER);
    expect(
      parseFilter({
        status: "unknown",
        kind: "gold",
        from: "1.11.2026",
        to: "x",
      }),
    ).toEqual(NO_FILTER);
  });
});

describe("countsOf", () => {
  it("shows players, codes issued, codes used and referrals", () => {
    const stats = { players: 12, codes: 4, shareCodes: 2, redeemed: 2 };
    expect(countsOf(stats, ENTRIES)).toEqual({
      players: 12,
      codesIssued: 4,
      codesUsed: 2,
      referrals: 12,
    });
  });

  it("gives zero for an empty promotion", () => {
    const stats = { players: 0, codes: 0, shareCodes: 0, redeemed: 0 };
    expect(countsOf(stats, [])).toEqual({
      players: 0,
      codesIssued: 0,
      codesUsed: 0,
      referrals: 0,
    });
  });

  it("gives no counts before the stats load", () => {
    expect(countsOf(null, ENTRIES)).toBeNull();
  });
});

const MOCK: MockCode[] = [
  {
    code: "SYL-MCK1",
    nickname: "TestPlayer1",
    score: 220,
    kind: "base",
    referrals: 1,
    earnedAt: "2026-11-20T18:30:00.000Z",
    usedAt: null,
  },
  {
    code: "SYL-MCK2",
    nickname: "TestPlayer2",
    score: 260,
    kind: "share",
    referrals: 5,
    earnedAt: "2026-11-22T18:30:00.000Z",
    usedAt: "2026-11-23T10:00:00.000Z",
  },
];

function setup(api?: CodeListApi) {
  const states: CodeListState[] = [];
  const list = createCodeList({
    api: api ?? createMockStaffApi({ codes: MOCK, now: () => BEFORE_END }),
    render: (state) => states.push(state),
  });
  const last = () => states[states.length - 1] ?? INITIAL_CODE_LIST;
  return { list, states, last };
}

describe("createCodeList", () => {
  it("loads the list and the counts from the staff API", async () => {
    const { list, states, last } = setup();
    await list.load();
    expect(states[0]?.busy).toBe(true);
    expect(last().busy).toBe(false);
    expect(last().loaded).toBe(true);
    expect(codes(last().entries)).toEqual(["SYL-MCK2", "SYL-MCK1"]);
    expect(last().stats).toEqual({
      players: 2,
      codes: 2,
      shareCodes: 1,
      redeemed: 1,
    });
    expect(last().error).toBe(false);
  });

  it("changes the visible list with a filter and keeps the counts", async () => {
    const { list, last } = setup();
    await list.load();
    list.setFilter({ ...NO_FILTER, status: "valid" });
    expect(last().filter.status).toBe("valid");
    expect(codes(visibleCodes(last(), BEFORE_END))).toEqual(["SYL-MCK1"]);
    expect(last().stats?.codes).toBe(2);
    list.setFilter(NO_FILTER);
    expect(codes(visibleCodes(last(), BEFORE_END))).toHaveLength(2);
  });

  it("shows an empty list for a promotion with no codes", async () => {
    const empty = createMockStaffApi({ codes: [], now: () => BEFORE_END });
    const { list, last } = setup(empty);
    await list.load();
    expect(last().loaded).toBe(true);
    expect(visibleCodes(last(), BEFORE_END)).toEqual([]);
  });

  it("shows an error and keeps the last list when a call fails", async () => {
    let fail = false;
    const mock = createMockStaffApi({ codes: MOCK, now: () => BEFORE_END });
    const api: CodeListApi = {
      listCodes: () =>
        fail ? Promise.reject(new Error("down")) : mock.listCodes(),
      dashboardStats: mock.dashboardStats,
    };
    const { list, last } = setup(api);
    await list.load();
    fail = true;
    await list.load();
    expect(last().error).toBe(true);
    expect(last().busy).toBe(false);
    expect(last().entries).toHaveLength(2);
    fail = false;
    await list.load();
    expect(last().error).toBe(false);
  });

  it("ignores a load that ends after a reset", async () => {
    const mock = createMockStaffApi({ codes: MOCK, now: () => BEFORE_END });
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const api: CodeListApi = {
      listCodes: () => gate.then(() => mock.listCodes()),
      dashboardStats: mock.dashboardStats,
    };
    const { list, last } = setup(api);
    const loading = list.load();
    list.reset();
    release();
    await loading;
    expect(last()).toEqual(INITIAL_CODE_LIST);
  });

  it("resets to the first state", async () => {
    const { list, last } = setup();
    await list.load();
    list.setFilter({ ...NO_FILTER, kind: "share" });
    list.reset();
    expect(last()).toEqual(INITIAL_CODE_LIST);
  });
});
