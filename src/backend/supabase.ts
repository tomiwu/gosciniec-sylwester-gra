import { REWARD } from "../config";
import { normalizeCode } from "./codes";
import {
  BackendError,
  type BackendErrorKind,
  type CodeCheck,
  type CodeRow,
  type CodeStatus,
  type DashboardStats,
  type DiscountKind,
  type ReferralStatus,
  type ScoreBackend,
  type ScoreRow,
  type StaffBackend,
  type SubmitInput,
  type SubmitResult,
} from "./types";

/**
 * Supabase adapter with plain `fetch` (PostgREST RPC). No SDK.
 * The client uses only the public anon key. A staff call also sends the staff session token.
 * Never give this adapter the service role key.
 */
export type SupabaseConfig = {
  url: string;
  anonKey: string;
  fetch: typeof fetch;
};

export type SupabaseStaffConfig = SupabaseConfig & { accessToken: string };

type Row = Record<string, unknown>;

type RpcTarget = SupabaseConfig & { token: string };

function errorKind(status: number, sqlState: unknown): BackendErrorKind {
  const denied = status === 401 || status === 403 || sqlState === "42501";
  return denied ? "forbidden" : "server";
}

async function readError(response: Response): Promise<Row> {
  try {
    return (await response.json()) as Row;
  } catch {
    return { message: `HTTP ${response.status}` };
  }
}

async function send(target: RpcTarget, name: string, args: Row) {
  const base = target.url.replace(/\/+$/, "");
  try {
    return await target.fetch(`${base}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: {
        apikey: target.anonKey,
        Authorization: `Bearer ${target.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
    });
  } catch (error) {
    throw new BackendError("network", `${name}: ${errorText(error)}`);
  }
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function rpc(target: RpcTarget, name: string, args: Row = {}) {
  const response = await send(target, name, args);
  if (response.ok) return (await response.json()) as unknown;
  const body = await readError(response);
  const message = String(body.message ?? `HTTP ${response.status}`);
  throw new BackendError(
    errorKind(response.status, body.code),
    `${name}: ${message}`,
  );
}

function toSubmitResult(row: Row): SubmitResult {
  const result: SubmitResult = {
    accepted: Boolean(row.accepted),
    code: String(row.code),
    discountPercent: Number(row.discount_percent),
    referralProgress: Number(row.referral_progress),
    referralNeeded: Number(row.referral_needed),
  };
  return row.reason ? { ...result, reason: String(row.reason) } : result;
}

function failedSubmit(error: unknown): SubmitResult {
  const kind = error instanceof BackendError ? error.kind : "server";
  return {
    accepted: false,
    reason: kind,
    code: "",
    discountPercent: 0,
    referralProgress: 0,
    referralNeeded: REWARD.referralNeeded,
  };
}

function textOrNull(value: unknown): string | null {
  return value === null ? null : String(value);
}

function numberOrNull(value: unknown): number | null {
  return value === null ? null : Number(value);
}

function toCheck(row: Row): CodeCheck {
  return {
    code: String(row.code),
    status: row.status as CodeStatus,
    nickname: textOrNull(row.nickname),
    kind: textOrNull(row.kind) as DiscountKind | null,
    discountPercent: Number(row.discount_percent),
    pricePerPerson: numberOrNull(row.price_per_person),
    earnedAt: textOrNull(row.earned_at),
    usedAt: textOrNull(row.used_at),
  };
}

function toCodeRow(row: Row): CodeRow {
  return {
    code: String(row.code),
    nickname: String(row.nickname),
    score: Number(row.score),
    kind: row.kind as DiscountKind,
    referrals: Number(row.referrals),
    earnedAt: String(row.earned_at),
    usedAt: textOrNull(row.used_at),
  };
}

function toStats(row: Row): DashboardStats {
  return {
    players: Number(row.players),
    codes: Number(row.codes),
    shareCodes: Number(row.share_codes),
    redeemed: Number(row.redeemed),
  };
}

function toScoreRow(row: Row): ScoreRow {
  return { nickname: String(row.nickname), score: Number(row.score) };
}

function submitArgs(input: SubmitInput): Row {
  return {
    p_nickname: input.nickname,
    p_score: input.score,
    p_device_id: input.deviceId,
    p_referral_code: input.referralCode ?? null,
  };
}

function toReferralStatus(row: unknown): ReferralStatus | null {
  if (row === null || typeof row !== "object") return null;
  const data = row as Row;
  if (typeof data.token !== "string" || data.token === "") return null;
  return {
    token: data.token,
    progress: Number(data.referral_progress),
    needed: Number(data.referral_needed),
    discountPercent: Number(data.discount_percent),
  };
}

/**
 * Player side. Anon may call only `issue_code`, `leaderboard`, `referral_status` and `record_referral_finish`.
 * The referral calls return null or false when the server does not have them yet (older database).
 */
export function createSupabaseBackend(config: SupabaseConfig): ScoreBackend {
  const target: RpcTarget = { ...config, token: config.anonKey };
  return {
    submit: (input) =>
      rpc(target, "issue_code", submitArgs(input)).then(
        (row) => toSubmitResult(row as Row),
        failedSubmit,
      ),
    top: async (limit) => {
      const rows = await rpc(target, "leaderboard", { p_limit: limit });
      return (rows as Row[]).map(toScoreRow);
    },
    referralStatus: (code) =>
      rpc(target, "referral_status", { p_code: normalizeCode(code) }).then(
        toReferralStatus,
        () => null,
      ),
    recordReferralFinish: (token, deviceId) =>
      rpc(target, "record_referral_finish", {
        p_token: token,
        p_device_id: deviceId,
      }).then(
        (counted) => counted === true,
        () => false,
      ),
  };
}

/** Staff side. The SQL functions accept only an authenticated staff user. */
export function createSupabaseStaff(config: SupabaseStaffConfig): StaffBackend {
  const target: RpcTarget = { ...config, token: config.accessToken };
  return {
    check: async (code) =>
      toCheck(
        (await rpc(target, "check_code", {
          p_code: normalizeCode(code),
        })) as Row,
      ),
    redeem: async (code, note) => {
      const args = { p_code: normalizeCode(code), p_note: note ?? null };
      const row = (await rpc(target, "redeem_code", args)) as Row;
      return { ok: Boolean(row.ok), check: toCheck(row.check as Row) };
    },
    listCodes: async (limit, offset) => {
      const args = { p_limit: limit, p_offset: offset };
      return ((await rpc(target, "list_codes", args)) as Row[]).map(toCodeRow);
    },
    stats: async () => toStats((await rpc(target, "dashboard_stats")) as Row),
    hideNickname: async (nickname) =>
      Boolean(await rpc(target, "hide_nickname", { p_nickname: nickname })),
  };
}
