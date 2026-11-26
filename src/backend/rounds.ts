import type { CatchSummary, RoundRow, RoundStart } from "./types";

type Row = Record<string, unknown>;

function asRow(value: unknown): Row {
  return value && typeof value === "object" ? (value as Row) : {};
}

function pick(row: Row, a: string, b: string): unknown {
  return a in row ? row[a] : row[b];
}

export function toCatchSummary(value: unknown): CatchSummary {
  const row = asRow(value);
  return {
    glass: Number(row.glass ?? 0),
    star: Number(row.star ?? 0),
    clock: Number(row.clock ?? 0),
    hits: Number(row.hits ?? 0),
  };
}

function textOrEmpty(value: unknown): string {
  return String(value || "");
}

function startFields(data: Row): RoundStart | null {
  const id = textOrEmpty(data.round_id);
  const token = textOrEmpty(data.token);
  const seed = Number(data.seed);
  return id && token && Number.isFinite(seed) ? { id, token, seed } : null;
}

export function toRoundStart(row: unknown): RoundStart | null {
  const data = asRow(row);
  return data.error ? null : startFields(data);
}

function flagList(value: unknown): string[] {
  return Array.isArray(value) ? value.map((flag) => String(flag)) : [];
}

function replayFlag(value: unknown): boolean | null {
  return value === null || value === undefined ? null : Boolean(value);
}

export function toRoundRow(value: unknown): RoundRow {
  const row = asRow(value);
  return {
    id: String(row.id || ""),
    nickname: String(row.nickname || ""),
    score: Number(row.score),
    wallMs: Number(pick(row, "wall_ms", "wallMs") || 0),
    startedAt: String(pick(row, "started_at", "startedAt") || ""),
    flags: flagList(row.flags),
    replayOk: replayFlag(pick(row, "replay_ok", "replayOk")),
    summary: toCatchSummary(row.summary),
  };
}
