/** Pluggable score backend. The game uses a local mock until Supabase keys exist. */
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

export type ScoreRow = {
  nickname: string;
  score: number;
  code: string;
};

export type ScoreBackend = {
  submit(input: SubmitInput): Promise<SubmitResult>;
  top(limit: number): Promise<ScoreRow[]>;
};
