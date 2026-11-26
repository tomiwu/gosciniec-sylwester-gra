import type { BrowserContext, Page, Request, Route } from "@playwright/test";
import { MOCK_SESSION_KEY, type KodySession } from "../src/panel/auth";
import { createMockPromo, type MockCode } from "../src/panel/mock-staff-api";
import type {
  CodeCheck,
  CodeListEntry,
  DashboardStats,
} from "../src/panel/staff-api";

/** Before the end of the promotion (31.12.2026, 23:59:59 Warsaw time). */
export const BEFORE_END = new Date("2026-11-26T12:00:00.000Z");
/** After the end of the promotion: every unused code is expired. */
export const AFTER_END = new Date("2027-01-02T12:00:00.000Z");

export const STAFF_USER: KodySession = {
  userId: "mock-tomiwu",
  username: "tomiwu",
};
export const GUEST_USER: KodySession = {
  userId: "mock-guest-test",
  username: "guest-test",
};

/** Invented codes. SYL-OLD1 is expired when the fake clock is AFTER_END. */
export const SEED_CODES: readonly MockCode[] = [
  {
    code: "SYL-7K2P",
    nickname: "AdaTest",
    score: 245,
    kind: "base",
    referrals: 2,
    earnedAt: "2026-11-20T18:30:00.000Z",
    usedAt: null,
  },
  {
    code: "SYL-9M4Q",
    nickname: "BonusTest",
    score: 270,
    kind: "share",
    referrals: 5,
    earnedAt: "2026-11-22T10:15:00.000Z",
    usedAt: null,
  },
  {
    code: "SYL-USED",
    nickname: "UsedTest",
    score: 215,
    kind: "base",
    referrals: 1,
    earnedAt: "2026-11-18T19:00:00.000Z",
    usedAt: "2026-11-24T15:45:00.000Z",
  },
  {
    code: "SYL-OLD1",
    nickname: "OldTest",
    score: 205,
    kind: "base",
    referrals: 0,
    earnedAt: "2026-11-10T08:00:00.000Z",
    usedAt: null,
  },
];

/** Invented: more players than codes, because not every player earns one. */
export const SEED_PLAYERS = 12;

export type StaffCall = { method: string; path: string; body: unknown };

function checkJson(check: CodeCheck) {
  return {
    code: check.code,
    status: check.status,
    nickname: check.nickname,
    kind: check.kind,
    earned_at: check.earnedAt,
    used_at: check.usedAt,
  };
}

function entryJson(entry: CodeListEntry) {
  return {
    code: entry.code,
    nickname: entry.nickname,
    score: entry.score,
    kind: entry.kind,
    referrals: entry.referrals,
    earned_at: entry.earnedAt,
    used_at: entry.usedAt,
  };
}

function statsJson(stats: DashboardStats) {
  return {
    players: stats.players,
    codes: stats.codes,
    share_codes: stats.shareCodes,
    redeemed: stats.redeemed,
  };
}

function bodyOf(request: Request): Record<string, string> {
  return (request.postDataJSON() ?? {}) as Record<string, string>;
}

function page(url: URL, rows: CodeListEntry[]) {
  const offset = Number(url.searchParams.get("offset") ?? 0);
  const limit = Number(url.searchParams.get("limit") ?? rows.length);
  return rows.slice(offset, offset + limit).map(entryJson);
}

type Handler = (request: Request, url: URL) => Promise<unknown>;

/**
 * Fake of the same-origin staff routes that the Kody fetch handler serves.
 * It keeps one in-memory promotion per test and logs every call.
 * No request leaves the browser.
 */
export function createFakeStaffApi(options: {
  now: Date;
  codes?: readonly MockCode[];
  players?: number;
}) {
  const { staff } = createMockPromo({
    codes: options.codes ?? SEED_CODES,
    players: options.players ?? SEED_PLAYERS,
    now: () => options.now,
  });
  const calls: StaffCall[] = [];

  const handlers: Record<string, Handler> = {
    "POST /api/staff/check": async (r) =>
      checkJson(await staff.checkCode(bodyOf(r).code ?? "")),
    "POST /api/staff/redeem": async (r) => {
      const result = await staff.redeemCode(bodyOf(r).code ?? "");
      return { ok: result.ok, check: checkJson(result.check) };
    },
    "GET /api/staff/codes": async (_r, url) =>
      page(url, await staff.listCodes()),
    "GET /api/staff/stats": async () => statsJson(await staff.dashboardStats()),
    "GET /api/staff/leaderboard": async () => staff.leaderboard(),
    "POST /api/staff/hide-nickname": async (r) =>
      staff.hideNickname(bodyOf(r).nickname ?? ""),
  };

  async function handle(route: Route): Promise<void> {
    const request = route.request();
    const url = new URL(request.url());
    const key = `${request.method()} ${url.pathname}`;
    calls.push({
      method: request.method(),
      path: url.pathname,
      body: request.postDataJSON(),
    });
    const handler = handlers[key];
    if (!handler) {
      await route.fulfill({ status: 404, json: { error: "not found" } });
      return;
    }
    await route.fulfill({ json: await handler(request, url) });
  }

  return {
    calls,
    /** Calls to one staff route, for example "/api/staff/redeem". */
    callsTo: (path: string) => calls.filter((c) => c.path === path),
    install: (target: Page) => target.route("**/api/staff/**", handle),
  };
}

export type FakeStaffApi = ReturnType<typeof createFakeStaffApi>;

/**
 * Abort every request that does not go to the local preview server,
 * and keep the URL so a test can prove it used no network.
 */
export async function blockNetwork(
  context: BrowserContext,
  origin: string,
): Promise<string[]> {
  const blocked: string[] = [];
  await context.route("**/*", async (route) => {
    const url = route.request().url();
    if (url.startsWith(`${origin}/`)) {
      await route.fallback();
      return;
    }
    blocked.push(url);
    await route.abort();
  });
  return blocked;
}

/** A mock Kody session in sessionStorage, as if staff had signed in before. */
export async function seedKodySession(
  target: Page,
  session: KodySession,
): Promise<void> {
  await target.addInitScript(
    ([key, value]) => window.sessionStorage.setItem(key, value),
    [MOCK_SESSION_KEY, JSON.stringify(session)] as const,
  );
}
