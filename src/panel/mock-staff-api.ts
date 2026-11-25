import { STAFF } from "../config";
import {
  normalizeCode,
  type CodeCheck,
  type CodeStatus,
  type DiscountKind,
  type StaffApi,
} from "./staff-api";

/** One code in the mock store. All data is invented. */
export type MockCode = {
  code: string;
  nickname: string;
  kind: DiscountKind;
  earnedAt: string;
  usedAt: string | null;
};

/** Invented codes for local dev and tests. */
export const MOCK_CODES: readonly MockCode[] = [
  {
    code: "SYL-AB2C",
    nickname: "TestPlayer1",
    kind: "base",
    earnedAt: "2026-11-20T18:30:00.000Z",
    usedAt: null,
  },
  {
    code: "SYL-PX7K",
    nickname: "TestPlayer2",
    kind: "share",
    earnedAt: "2026-11-21T09:05:00.000Z",
    usedAt: null,
  },
  {
    code: "SYL-USED",
    nickname: "TestPlayer3",
    kind: "base",
    earnedAt: "2026-11-19T20:00:00.000Z",
    usedAt: "2026-11-24T15:45:00.000Z",
  },
];

/** Same rule as `check_code`: a used code stays used after the end date. */
function statusOf(entry: MockCode, now: Date): CodeStatus {
  if (entry.usedAt !== null) return "already_used";
  return now.getTime() >= Date.parse(STAFF.codeExpiresAtIso)
    ? "expired"
    : "valid";
}

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
  const status = statusOf(entry, now);
  return { code: entry.code, status, nickname, kind, earnedAt, usedAt };
}

/**
 * In-memory staff API for local dev (no Kody handler) and tests.
 * It copies the seed list, so each instance has its own state.
 */
export function createMockStaffApi(options: {
  codes: readonly MockCode[];
  now: () => Date;
}): StaffApi {
  const store = new Map(options.codes.map((c) => [c.code, { ...c }]));

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
  };
}
