import { LEADERBOARD, STAFF } from "../config";

/**
 * Staff API client for the panel. The browser calls only the same-origin
 * staff routes. The Kody fetch handler (issue #17) checks the staff session
 * and calls the Supabase RPCs `check_code`, `redeem_code`, `list_codes`,
 * `dashboard_stats`, `leaderboard` and `hide_nickname` on the server.
 * The browser never holds the service role and never calls a staff RPC.
 */
export type CodeStatus = "valid" | "already_used" | "unknown" | "expired";

/** `base` = 10 % (333 zl per person). `share` = share bonus (299 zl per person). */
export type DiscountKind = "base" | "share";

export type CodeCheck = {
  code: string;
  status: CodeStatus;
  nickname: string | null;
  kind: DiscountKind | null;
  earnedAt: string | null;
  usedAt: string | null;
};

/** `check` is the state of the code after the attempt. */
export type RedeemResult = {
  ok: boolean;
  check: CodeCheck;
};

/** One issued code in the staff list (`list_codes` row). No device id. */
export type CodeListEntry = {
  code: string;
  nickname: string;
  score: number;
  kind: DiscountKind;
  /** Players who came with this code's referral link. */
  referrals: number;
  earnedAt: string;
  usedAt: string | null;
};

/** `dashboard_stats`: all players, all codes, share-bonus codes, used codes. */
export type DashboardStats = {
  players: number;
  codes: number;
  shareCodes: number;
  redeemed: number;
};

/** An issued code is never unknown. */
export type ListStatus = Exclude<CodeStatus, "unknown">;

export type CodeCheckApi = {
  checkCode(code: string): Promise<CodeCheck>;
  redeemCode(code: string): Promise<RedeemResult>;
};

export type CodeListApi = {
  /** Every issued code, newest first. */
  listCodes(): Promise<CodeListEntry[]>;
  dashboardStats(): Promise<DashboardStats>;
};

/** One row of the top list: nickname and score only, like the public list. */
export type LeaderboardRow = {
  nickname: string;
  score: number;
};

export type RankingApi = {
  /** The public top list (hidden nicks left out), best score first. */
  leaderboard(): Promise<LeaderboardRow[]>;
  /**
   * Hide a nick from the public top list. The code row stays, so the code
   * still checks and redeems. True when the nick exists (also when it was
   * hidden before), false when no score has this nick.
   */
  hideNickname(nickname: string): Promise<boolean>;
};

export type StaffApi = CodeCheckApi & CodeListApi & RankingApi;

export class StaffApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StaffApiError";
  }
}

const STATUSES: readonly CodeStatus[] = [
  "valid",
  "already_used",
  "unknown",
  "expired",
];

/** Same rule as `check_code`: a used code stays used after the end date. */
export function statusAt(usedAt: string | null, now: Date): ListStatus {
  if (usedAt !== null) return "already_used";
  return now.getTime() >= Date.parse(STAFF.codeExpiresAtIso)
    ? "expired"
    : "valid";
}

/** Trim and upper case, so "  syl-ab2c " is "SYL-AB2C". */
export function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

type Row = Record<string, unknown>;

function asRow(value: unknown): Row {
  if (typeof value === "object" && value !== null) return value as Row;
  throw new StaffApiError("The staff API returned an unexpected body.");
}

function textOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function kindOf(value: unknown): DiscountKind | null {
  return value === "base" || value === "share" ? value : null;
}

function requiredText(value: unknown, field: string): string {
  if (typeof value === "string") return value;
  throw new StaffApiError(`The staff API returned no ${field}.`);
}

function requiredKind(value: unknown): DiscountKind {
  const kind = kindOf(value);
  if (kind === null) throw new StaffApiError("The staff API returned no kind.");
  return kind;
}

function count(value: unknown, field: string): number {
  if (Number.isInteger(value) && (value as number) >= 0) return value as number;
  throw new StaffApiError(`The staff API returned a bad ${field}.`);
}

function statusOf(value: unknown): CodeStatus {
  const status = STATUSES.find((s) => s === value);
  if (!status) throw new StaffApiError("The staff API returned a bad status.");
  return status;
}

/** Map a `check_code` row (snake_case JSON) to a CodeCheck. */
export function parseCheck(value: unknown): CodeCheck {
  const row = asRow(value);
  if (typeof row.code !== "string") {
    throw new StaffApiError("The staff API returned no code.");
  }
  return {
    code: row.code,
    status: statusOf(row.status),
    nickname: textOrNull(row.nickname),
    kind: kindOf(row.kind),
    earnedAt: textOrNull(row.earned_at),
    usedAt: textOrNull(row.used_at),
  };
}

/** Map a `list_codes` row (snake_case JSON). Other fields are dropped. */
export function parseListEntry(value: unknown): CodeListEntry {
  const row = asRow(value);
  return {
    code: requiredText(row.code, "code"),
    nickname: requiredText(row.nickname, "nickname"),
    score: count(row.score, "score"),
    kind: requiredKind(row.kind),
    referrals: count(row.referrals, "referral count"),
    earnedAt: requiredText(row.earned_at, "date earned"),
    usedAt: textOrNull(row.used_at),
  };
}

function arrayOf(value: unknown, what: string): unknown[] {
  if (Array.isArray(value)) return value;
  throw new StaffApiError(`The staff API returned no ${what}.`);
}

function parseList(value: unknown): CodeListEntry[] {
  return arrayOf(value, "code list").map(parseListEntry);
}

/** Map a `leaderboard` row. Other fields are dropped. */
export function parseLeaderboardRow(value: unknown): LeaderboardRow {
  const row = asRow(value);
  return {
    nickname: requiredText(row.nickname, "nickname"),
    score: count(row.score, "score"),
  };
}

function parseHidden(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  throw new StaffApiError("The staff API returned a bad hide result.");
}

/** Map the `dashboard_stats` body (snake_case JSON). */
export function parseStats(value: unknown): DashboardStats {
  const row = asRow(value);
  return {
    players: count(row.players, "player count"),
    codes: count(row.codes, "code count"),
    shareCodes: count(row.share_codes, "share code count"),
    redeemed: count(row.redeemed, "used code count"),
  };
}

function parseRedeem(value: unknown): RedeemResult {
  const row = asRow(value);
  return { ok: row.ok === true, check: parseCheck(row.check) };
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return (await response.json()) as unknown;
  } catch {
    throw new StaffApiError("The staff API returned a body that is not JSON.");
  }
}

function requestInit(body: unknown): RequestInit {
  if (body === undefined) {
    return {
      method: "GET",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    };
  }
  return {
    method: "POST",
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  };
}

/** GET when there is no body, else POST the body as JSON. */
async function send(
  fetchFn: typeof fetch,
  path: string,
  body?: unknown,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetchFn(path, requestInit(body));
  } catch {
    throw new StaffApiError("The staff API is not available.");
  }
  if (!response.ok) {
    throw new StaffApiError(`The staff API failed (${response.status}).`);
  }
  return readJson(response);
}

function post(fetchFn: typeof fetch, path: string, code: string) {
  return send(fetchFn, path, { code: normalizeCode(code) });
}

function listUrl(offset: number): string {
  return `${STAFF.api.listPath}?limit=${STAFF.api.listPageSize}&offset=${offset}`;
}

/** Read pages until a short page, or until the page limit. */
async function listAll(fetchFn: typeof fetch): Promise<CodeListEntry[]> {
  const all: CodeListEntry[] = [];
  const size = STAFF.api.listPageSize;
  for (let page = 0; page < STAFF.api.listMaxPages; page += 1) {
    const rows = parseList(await send(fetchFn, listUrl(page * size)));
    all.push(...rows);
    if (rows.length < size) break;
  }
  return all;
}

/** Client for the same-origin staff routes. Tests give a fake `fetch`. */
export function createHttpStaffApi(fetchFn: typeof fetch): StaffApi {
  return {
    async checkCode(code) {
      return parseCheck(await post(fetchFn, STAFF.api.checkPath, code));
    },
    async redeemCode(code) {
      return parseRedeem(await post(fetchFn, STAFF.api.redeemPath, code));
    },
    listCodes: () => listAll(fetchFn),
    async dashboardStats() {
      return parseStats(await send(fetchFn, STAFF.api.statsPath));
    },
    async leaderboard() {
      const url = `${STAFF.api.leaderboardPath}?limit=${LEADERBOARD.topN}`;
      const rows = arrayOf(await send(fetchFn, url), "ranking");
      return rows.map(parseLeaderboardRow);
    },
    async hideNickname(nickname) {
      const body = { nickname: nickname.trim() };
      return parseHidden(await send(fetchFn, STAFF.api.hidePath, body));
    },
  };
}
