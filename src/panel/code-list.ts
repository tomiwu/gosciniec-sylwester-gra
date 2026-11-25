import { STAFF } from "../config";
import {
  statusAt,
  type CodeListApi,
  type CodeListEntry,
  type DashboardStats,
  type DiscountKind,
  type ListStatus,
} from "./staff-api";

export type StatusFilter = "all" | ListStatus;
export type KindFilter = "all" | DiscountKind;

/** `from` and `to` are Warsaw calendar days ("2026-11-20") or "" for no bound. */
export type CodeFilter = {
  status: StatusFilter;
  kind: KindFilter;
  from: string;
  to: string;
};

export const NO_FILTER: CodeFilter = {
  status: "all",
  kind: "all",
  from: "",
  to: "",
};

export const STATUS_FILTERS: readonly StatusFilter[] = [
  "all",
  "valid",
  "already_used",
  "expired",
];

export const KIND_FILTERS: readonly KindFilter[] = ["all", "base", "share"];

export type ListedCode = CodeListEntry & { status: ListStatus };

export type CodeCounts = {
  players: number;
  codesIssued: number;
  codesUsed: number;
  referrals: number;
};

export type CodeListState = {
  busy: boolean;
  /** True after the first list arrived. */
  loaded: boolean;
  entries: CodeListEntry[];
  stats: DashboardStats | null;
  filter: CodeFilter;
  /** True when the last load failed. */
  error: boolean;
};

export const INITIAL_CODE_LIST: CodeListState = {
  busy: false,
  loaded: false,
  entries: [],
  stats: null,
  filter: NO_FILTER,
  error: false,
};

/** en-CA gives the ISO order "2026-11-20". */
const DAY_FORMAT = new Intl.DateTimeFormat("en-CA", {
  timeZone: STAFF.timeZone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** The calendar day in Europe/Warsaw, or "" for a bad date. */
export function warsawDay(iso: string): string {
  const time = Date.parse(iso);
  return Number.isNaN(time) ? "" : DAY_FORMAT.format(time);
}

export function withStatus(
  entries: readonly CodeListEntry[],
  now: Date,
): ListedCode[] {
  return entries.map((e) => ({ ...e, status: statusAt(e.usedAt, now) }));
}

function inDays(day: string, filter: CodeFilter): boolean {
  if (filter.from && day < filter.from) return false;
  return !filter.to || day <= filter.to;
}

function matches(code: ListedCode, filter: CodeFilter): boolean {
  if (filter.status !== "all" && code.status !== filter.status) return false;
  if (filter.kind !== "all" && code.kind !== filter.kind) return false;
  return inDays(warsawDay(code.earnedAt), filter);
}

/** All filters must match. The date range is inclusive. */
export function filterCodes(
  codes: readonly ListedCode[],
  filter: CodeFilter,
): ListedCode[] {
  return codes.filter((c) => matches(c, filter));
}

function pick<T extends string>(options: readonly T[], value: unknown): T {
  return options.find((o) => o === value) ?? (options[0] as T);
}

function day(value: unknown): string {
  return typeof value === "string" && DAY.test(value) ? value : "";
}

/** Read the filter form. A missing or bad value means no filter. */
export function parseFilter(values: Record<string, unknown>): CodeFilter {
  return {
    status: pick(STATUS_FILTERS, values.status),
    kind: pick(KIND_FILTERS, values.kind),
    from: day(values.from),
    to: day(values.to),
  };
}

/** Counts for the whole promotion. Filters do not change them. */
export function countsOf(
  stats: DashboardStats | null,
  entries: readonly CodeListEntry[],
): CodeCounts | null {
  if (!stats) return null;
  return {
    players: stats.players,
    codesIssued: stats.codes,
    codesUsed: stats.redeemed,
    referrals: entries.reduce((sum, e) => sum + e.referrals, 0),
  };
}

/** The codes to show: status at `now`, then the filter. */
export function visibleCodes(state: CodeListState, now: Date): ListedCode[] {
  return filterCodes(withStatus(state.entries, now), state.filter);
}

/**
 * Code-list view-model with no DOM. Each change calls render().
 * It talks only to the staff API client.
 */
export function createCodeList(options: {
  api: CodeListApi;
  render: (state: CodeListState) => void;
}) {
  const { api, render } = options;
  let state: CodeListState = INITIAL_CODE_LIST;

  function show(next: Partial<CodeListState>): void {
    state = { ...state, ...next };
    render(state);
  }

  return {
    async load(): Promise<void> {
      show({ busy: true });
      try {
        const [entries, stats] = await Promise.all([
          api.listCodes(),
          api.dashboardStats(),
        ]);
        show({ busy: false, loaded: true, entries, stats, error: false });
      } catch {
        show({ busy: false, error: true });
      }
    },
    setFilter(filter: CodeFilter): void {
      show({ filter });
    },
    reset(): void {
      show(INITIAL_CODE_LIST);
    },
  };
}
