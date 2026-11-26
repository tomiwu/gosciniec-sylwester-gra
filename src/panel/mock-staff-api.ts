import { LEADERBOARD } from "../config";
import {
  normalizeCode,
  statusAt,
  type CodeCheck,
  type CodeListEntry,
  type DashboardStats,
  type DiscountKind,
  type LeaderboardRow,
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

/** Same match as `hide_nickname` in SQL: no case, no outer spaces. */
function nicknameKey(nickname: string): string {
  return nickname.trim().toLowerCase();
}

/** Best score first. A tie goes to the earlier score, like `leaderboard` in SQL. */
function bestFirst(a: MockCode, b: MockCode): number {
  return b.score - a.score || a.earnedAt.localeCompare(b.earnedAt);
}

function toRow(entry: MockCode): LeaderboardRow {
  return { nickname: entry.nickname, score: entry.score };
}

/** The public player side. It can only read the top list. */
export type MockPublicBoard = {
  top(limit: number): Promise<LeaderboardRow[]>;
};

/**
 * In-memory promotion for local dev (no Kody handler) and tests: the staff
 * API and the public top list share one store.
 * It copies the seed list, so each instance has its own state.
 * `players` defaults to one player per code.
 * A hidden nick goes into a hide set. The code row stays.
 */
export function createMockPromo(options: {
  codes: readonly MockCode[];
  now: () => Date;
  players?: number;
}): { staff: StaffApi; board: MockPublicBoard } {
  const store = new Map(options.codes.map((c) => [c.code, { ...c }]));
  const players = options.players ?? options.codes.length;
  const hidden = new Set<string>();

  function check(raw: string): CodeCheck {
    const code = normalizeCode(raw);
    return toCheck(store.get(code), code, options.now());
  }

  function top(limit: number): LeaderboardRow[] {
    return [...store.values()]
      .filter((c) => !hidden.has(nicknameKey(c.nickname)))
      .sort(bestFirst)
      .slice(0, Math.max(0, limit))
      .map(toRow);
  }

  function hide(nickname: string): boolean {
    const key = nicknameKey(nickname);
    const found = [...store.values()].some(
      (c) => nicknameKey(c.nickname) === key,
    );
    if (found) hidden.add(key);
    return found;
  }

  const staff: StaffApi = {
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
    leaderboard: () => Promise.resolve(top(LEADERBOARD.topN)),
    hideNickname: (nickname) => Promise.resolve(hide(nickname)),
  };
  return { staff, board: { top: (limit) => Promise.resolve(top(limit)) } };
}

/** The staff side of a new mock promotion. */
export function createMockStaffApi(
  options: Parameters<typeof createMockPromo>[0],
): StaffApi {
  return createMockPromo(options).staff;
}
