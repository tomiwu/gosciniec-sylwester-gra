import {
  normalizeCode,
  statusAt,
  type CodeCheck,
  type CodeListEntry,
  type DashboardStats,
  type DiscountKind,
  type StaffApi,
} from "./staff-api";

/** One code in the mock store. All data is invented. */
export type MockCode = {
  code: string;
  nickname: string;
  score: number;
  kind: DiscountKind;
  referrals: number;
  earnedAt: string;
  usedAt: string | null;
};

/** Invented codes for local dev and tests. */
export const MOCK_CODES: readonly MockCode[] = [
  {
    code: "SYL-AB2C",
    nickname: "TestPlayer1",
    score: 230,
    kind: "base",
    referrals: 1,
    earnedAt: "2026-11-20T18:30:00.000Z",
    usedAt: null,
  },
  {
    code: "SYL-PX7K",
    nickname: "TestPlayer2",
    score: 265,
    kind: "share",
    referrals: 5,
    earnedAt: "2026-11-21T09:05:00.000Z",
    usedAt: null,
  },
  {
    code: "SYL-USED",
    nickname: "TestPlayer3",
    score: 215,
    kind: "base",
    referrals: 0,
    earnedAt: "2026-11-19T20:00:00.000Z",
    usedAt: "2026-11-24T15:45:00.000Z",
  },
  {
    code: "SYL-QR4M",
    nickname: "TestPlayer4",
    score: 280,
    kind: "share",
    referrals: 6,
    earnedAt: "2026-11-22T21:10:00.000Z",
    usedAt: "2026-11-25T11:20:00.000Z",
  },
];

/** Invented player count for local dev. Not every player earns a code. */
export const MOCK_PLAYERS = 9;

function unknownCheck(code: string): CodeCheck {
  return {
    code,
    status: "unknown",
    nickname: null,
    kind: null,
    earnedAt: null,
    usedAt: null,
  };
}

function toCheck(
  entry: MockCode | undefined,
  code: string,
  now: Date,
): CodeCheck {
  if (!entry) return unknownCheck(code);
  const { nickname, kind, earnedAt, usedAt } = entry;
  const status = statusAt(entry.usedAt, now);
  return { code: entry.code, status, nickname, kind, earnedAt, usedAt };
}

function newestFirst(a: MockCode, b: MockCode): number {
  return b.earnedAt.localeCompare(a.earnedAt) || a.code.localeCompare(b.code);
}

function toEntry(entry: MockCode): CodeListEntry {
  return { ...entry };
}

function statsOf(codes: MockCode[], players: number): DashboardStats {
  return {
    players,
    codes: codes.length,
    shareCodes: codes.filter((c) => c.kind === "share").length,
    redeemed: codes.filter((c) => c.usedAt !== null).length,
  };
}

/**
 * In-memory staff API for local dev (no Kody handler) and tests.
 * It copies the seed list, so each instance has its own state.
 * `players` defaults to one player per code.
 */
export function createMockStaffApi(options: {
  codes: readonly MockCode[];
  now: () => Date;
  players?: number;
}): StaffApi {
  const store = new Map(options.codes.map((c) => [c.code, { ...c }]));
  const players = options.players ?? options.codes.length;

  function check(raw: string): CodeCheck {
    const code = normalizeCode(raw);
    return toCheck(store.get(code), code, options.now());
  }

  return {
    checkCode: (raw) => Promise.resolve(check(raw)),
    redeemCode(raw) {
      const before = check(raw);
      const entry = store.get(before.code);
      if (before.status !== "valid" || !entry) {
        return Promise.resolve({ ok: false, check: before });
      }
      entry.usedAt = options.now().toISOString();
      return Promise.resolve({ ok: true, check: check(raw) });
    },
    listCodes: () =>
      Promise.resolve([...store.values()].sort(newestFirst).map(toEntry)),
    dashboardStats: () =>
      Promise.resolve(statsOf([...store.values()], players)),
  };
}
