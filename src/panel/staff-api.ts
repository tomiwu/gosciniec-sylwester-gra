import { normalizeCode } from "../backend/codes";
import type {
  CodeCheck,
  CodeRow,
  CodeStatus,
  DashboardStats,
  DiscountKind,
  ScoreRow,
  StaffBackend,
} from "../backend/types";
import { BackendError } from "../backend/types";

type Row = Record<string, unknown>;

function asRow(value: unknown): Row {
  if (typeof value === "object" && value !== null) return value as Row;
  throw new BackendError("server", "Unexpected staff response.");
}

function textOrNull(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}

function numberOrNull(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value);
}

export function toCheck(value: unknown): CodeCheck {
  const row = asRow(value);
  return {
    code: String(row.code ?? ""),
    status: row.status as CodeStatus,
    nickname: textOrNull(row.nickname),
    kind: textOrNull(row.kind) as DiscountKind | null,
    discountPercent: Number(row.discount_percent ?? 0),
    pricePerPerson: numberOrNull(row.price_per_person),
    earnedAt: textOrNull(row.earned_at),
    usedAt: textOrNull(row.used_at),
  };
}

export function toCodeRow(value: unknown): CodeRow {
  const row = asRow(value);
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

export function toStats(value: unknown): DashboardStats {
  const row = asRow(value);
  return {
    players: Number(row.players),
    codes: Number(row.codes),
    shareCodes: Number(row.share_codes),
    redeemed: Number(row.redeemed),
  };
}

export function toScoreRow(value: unknown): ScoreRow {
  const row = asRow(value);
  return { nickname: String(row.nickname), score: Number(row.score) };
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.length === 0) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new BackendError("server", "Unexpected staff response.");
  }
}

function rejectStaffStatus(status: number): void {
  if (status === 401 || status === 403) {
    throw new BackendError("forbidden", "Not signed in as staff.");
  }
  if (status >= 400) {
    throw new BackendError("server", "Staff API failed.");
  }
}

async function staffFetch(path: string, init?: RequestInit): Promise<unknown> {
  try {
    const response = await fetch(path, {
      credentials: "same-origin",
      ...init,
      headers: {
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    });
    const body = await readJson(response);
    rejectStaffStatus(response.status);
    return body;
  } catch (error) {
    if (error instanceof BackendError) throw error;
    throw new BackendError("network", "Staff API is offline.");
  }
}

/** Same-origin staff API served by the Kody fetch handler. */
export function createSameOriginStaff(): StaffBackend {
  return {
    async check(code) {
      return toCheck(
        await staffFetch("/api/staff/check", {
          method: "POST",
          body: JSON.stringify({ code: normalizeCode(code) }),
        }),
      );
    },
    async redeem(code, note) {
      const body = asRow(
        await staffFetch("/api/staff/redeem", {
          method: "POST",
          body: JSON.stringify({
            code: normalizeCode(code),
            note: note ?? null,
          }),
        }),
      );
      return { ok: Boolean(body.ok), check: toCheck(body.check) };
    },
    async listCodes(limit, offset) {
      const path = `/api/staff/codes?limit=${limit}&offset=${offset}`;
      const rows = await staffFetch(path);
      if (!Array.isArray(rows)) throw new BackendError("server", "Bad list.");
      return rows.map(toCodeRow);
    },
    async stats() {
      return toStats(await staffFetch("/api/staff/stats"));
    },
    async hideNickname(nickname) {
      const body = await staffFetch("/api/staff/hide-nickname", {
        method: "POST",
        body: JSON.stringify({ nickname }),
      });
      return Boolean(body);
    },
  };
}

export async function fetchStaffRanking(): Promise<ScoreRow[]> {
  const rows = await staffFetch("/api/staff/ranking");
  if (!Array.isArray(rows)) throw new BackendError("server", "Bad ranking.");
  return rows.map(toScoreRow);
}
