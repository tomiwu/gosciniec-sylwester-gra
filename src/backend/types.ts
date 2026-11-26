/**
 * Pluggable backend. The game and the staff use a local mock until Supabase keys exist.
 * The Supabase SQL functions in `supabase/migrations/` return the same shapes.
 */
export type SubmitInput = {
  nickname: string;
  score: number;
  deviceId: string;
  referralCode?: string;
};

export type SubmitResult = {
  code: string;
  discountPercent: number;
  referralProgress: number;
  referralNeeded: number;
  accepted: boolean;
  reason?: string;
};

/** Public leaderboard row. It never contains a code or a staff status. */
export type ScoreRow = {
  nickname: string;
  score: number;
};

/** Player side: the anon role may call only these. */
export type ScoreBackend = {
  submit(input: SubmitInput): Promise<SubmitResult>;
  top(limit: number): Promise<ScoreRow[]>;
};

export type CodeStatus = "valid" | "already_used" | "unknown" | "expired";

/** `base` = 10 % (333 zl per person). `share` = share bonus (299 zl per person). */
export type DiscountKind = "base" | "share";

export type CodeCheck = {
  code: string;
  status: CodeStatus;
  nickname: string | null;
  kind: DiscountKind | null;
  discountPercent: number;
  pricePerPerson: number | null;
  earnedAt: string | null;
  usedAt: string | null;
};

/** `check` is the state of the code after the attempt. */
export type RedeemResult = {
  ok: boolean;
  check: CodeCheck;
};

export type CodeRow = {
  code: string;
  nickname: string;
  score: number;
  kind: DiscountKind;
  referrals: number;
  earnedAt: string;
  usedAt: string | null;
};

export type DashboardStats = {
  players: number;
  codes: number;
  shareCodes: number;
  redeemed: number;
};

/** Staff side: the authenticated role only. */
export type StaffBackend = {
  check(code: string): Promise<CodeCheck>;
  redeem(code: string, note?: string): Promise<RedeemResult>;
  listCodes(limit: number, offset: number): Promise<CodeRow[]>;
  stats(): Promise<DashboardStats>;
  hideNickname(nickname: string): Promise<boolean>;
};

export type BackendErrorKind = "forbidden" | "network" | "server";

/** Thrown by the Supabase adapter. `forbidden` = RLS or a missing staff login. */
export class BackendError extends Error {
  readonly kind: BackendErrorKind;
  constructor(kind: BackendErrorKind, message: string) {
    super(message);
    this.name = "BackendError";
    this.kind = kind;
  }
}
