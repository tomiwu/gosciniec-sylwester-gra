import { OFFER, REWARD, STAFF, formatOfferPrice } from "../config";
import { pl } from "../i18n/pl";
import {
  normalizeCode,
  type CodeCheck,
  type CodeStatus,
  type DiscountKind,
  type CodeCheckApi,
} from "./staff-api";

/** `empty` = no code typed. `check` / `redeem` = the staff API call failed. */
export type CodeCheckError = "empty" | "check" | "redeem";

export type CodeCheckState = {
  /** The normalised code that staff entered. */
  code: string;
  busy: boolean;
  check: CodeCheck | null;
  /** True after this view redeemed the code. */
  redeemed: boolean;
  error: CodeCheckError | null;
};

export const INITIAL_CODE_CHECK: CodeCheckState = {
  code: "",
  busy: false,
  check: null,
  redeemed: false,
  error: null,
};

const STATUS_LABELS: Record<CodeStatus, string> = {
  valid: pl.panelStatusValid,
  already_used: pl.panelStatusUsed,
  unknown: pl.panelStatusUnknown,
  expired: pl.panelStatusExpired,
};

const EARNED_FORMAT = new Intl.DateTimeFormat("pl-PL", {
  timeZone: STAFF.timeZone,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function statusLabel(status: CodeStatus): string {
  return STATUS_LABELS[status];
}

/** For example "10% · 333 zł / os." or "Bonus za polecenia · 299 zł / os.". */
export function discountLabel(kind: DiscountKind | null): string {
  if (kind === "share") {
    return `${pl.panelDiscountShare} · ${formatOfferPrice(OFFER.priceWithShare)}`;
  }
  if (kind === "base") {
    return `${REWARD.basePercent}% · ${formatOfferPrice(OFFER.priceWithCode)}`;
  }
  return pl.panelEmptyValue;
}

/** Date and time in Warsaw, for example "20.11.2026, 19:30". */
export function earnedLabel(iso: string | null): string {
  const time = iso === null ? Number.NaN : Date.parse(iso);
  return Number.isNaN(time) ? pl.panelEmptyValue : EARNED_FORMAT.format(time);
}

/** Only a valid code can be redeemed, and only when no call is running. */
export function canRedeem(state: CodeCheckState): boolean {
  return !state.busy && state.check?.status === "valid";
}

/**
 * Code-check view-model with no DOM. Each change calls render().
 * It talks only to the staff API client.
 */
export function createCodeCheck(options: {
  api: CodeCheckApi;
  render: (state: CodeCheckState) => void;
}) {
  const { api, render } = options;
  let state: CodeCheckState = INITIAL_CODE_CHECK;

  function show(next: Partial<CodeCheckState>): void {
    state = { ...state, ...next };
    render(state);
  }

  return {
    async check(input: string): Promise<void> {
      const code = normalizeCode(input);
      if (code.length === 0) {
        show({ ...INITIAL_CODE_CHECK, error: "empty" });
        return;
      }
      show({ ...INITIAL_CODE_CHECK, code, busy: true });
      try {
        show({ busy: false, check: await api.checkCode(code) });
      } catch {
        show({ busy: false, error: "check" });
      }
    },
    async redeem(): Promise<void> {
      if (!canRedeem(state) || !state.check) return;
      show({ busy: true, error: null });
      try {
        const result = await api.redeemCode(state.check.code);
        show({ busy: false, check: result.check, redeemed: result.ok });
      } catch {
        show({ busy: false, error: "redeem" });
      }
    },
    reset(): void {
      show(INITIAL_CODE_CHECK);
    },
  };
}
