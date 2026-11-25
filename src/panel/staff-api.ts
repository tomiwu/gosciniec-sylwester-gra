import { STAFF } from "../config";

/**
 * Staff API client for the panel. The browser calls only the same-origin
 * staff routes. The Kody fetch handler (issue #17) checks the staff session
 * and calls the Supabase RPCs `check_code` and `redeem_code` on the server.
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

export type StaffApi = {
  checkCode(code: string): Promise<CodeCheck>;
  redeemCode(code: string): Promise<RedeemResult>;
};

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

async function post(
  fetchFn: typeof fetch,
  path: string,
  code: string,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetchFn(path, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code: normalizeCode(code) }),
    });
  } catch {
    throw new StaffApiError("The staff API is not available.");
  }
  if (!response.ok) {
    throw new StaffApiError(`The staff API failed (${response.status}).`);
  }
  return readJson(response);
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
  };
}
