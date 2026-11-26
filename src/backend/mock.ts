import {
  ANTI_CHEAT,
  CODES,
  REWARD,
  isNicknameValid,
  isScoreSane,
} from "../config";
import { summaryIsConsistent } from "../game/replay";
import {
  type RandomInt,
  codeStatus,
  cryptoRandomInt,
  discountFor,
  isDeviceIdValid,
  isExpired,
  makeCode,
  nicknameKey,
  normalizeCode,
  unknownCheck,
} from "./codes";
import type {
  CodeCheck,
  CodeRow,
  DashboardStats,
  DiscountKind,
  RedeemResult,
  ReferralStatus,
  RoundRow,
  RoundStart,
  ScoreBackend,
  ScoreRow,
  StaffBackend,
  SubmitInput,
  SubmitResult,
} from "./types";

type ScoreRecord = {
  nickname: string;
  score: number;
  hidden: boolean;
  /** The first device that saved this nickname owns it. */
  deviceId: string;
  verified: boolean;
};

type RoundRecord = {
  id: string;
  token: string;
  seed: number;
  deviceId: string;
  startedAt: number;
  used: boolean;
  score: number;
  wallMs: number;
  nickname: string;
  inputLog: string;
  flags: string[];
  replayOk: boolean | null;
  summary: { glass: number; star: number; clock: number; hits: number };
};

type CodeRecord = {
  code: string;
  nickname: string;
  nickKey: string;
  deviceId: string;
  score: number;
  kind: DiscountKind;
  earnedAt: string;
  usedAt: string | null;
  note: string | null;
  /** One entry per referred device id. */
  referrals: Set<string>;
  /** Share-link token. It is made on the first referral status call. */
  token: string | null;
};

type State = {
  scores: Map<string, ScoreRecord>;
  codes: Map<string, CodeRecord>;
  tokens: Map<string, CodeRecord>;
  rounds: Map<string, RoundRecord>;
  now: () => Date;
  randomInt: RandomInt;
};

export type MockOptions = {
  now?: () => Date;
  randomInt?: RandomInt;
};

export type MockBackend = ScoreBackend & StaffBackend;

function noCode(): SubmitResult {
  return {
    code: "",
    discountPercent: 0,
    referralProgress: 0,
    referralNeeded: REWARD.referralNeeded,
    accepted: true,
  };
}

function reject(reason: string): SubmitResult {
  return { ...noCode(), accepted: false, reason };
}

function inputError(input: SubmitInput): string | null {
  if (!isNicknameValid(input.nickname)) return "nickname";
  if (!isScoreSane(input.score)) return "score";
  return isDeviceIdValid(input.deviceId) ? null : "device";
}

/** False when another device owns the nickname. Then nothing changes. */
function recordScore(state: State, input: SubmitInput): boolean {
  const key = nicknameKey(input.nickname);
  const previous = state.scores.get(key);
  if (!previous) {
    const nickname = input.nickname.trim();
    const { score, deviceId } = input;
    state.scores.set(key, {
      nickname,
      score,
      hidden: false,
      deviceId,
      verified: true,
    });
    return true;
  }
  if (previous.deviceId !== input.deviceId) return false;
  previous.score = Math.max(previous.score, input.score);
  if (input.roundId) previous.verified = true;
  return true;
}

function isSelfReferral(referrer: CodeRecord, input: SubmitInput): boolean {
  return (
    referrer.nickKey === nicknameKey(input.nickname) ||
    referrer.deviceId === input.deviceId
  );
}

function findReferrer(state: State, input: SubmitInput): CodeRecord | null {
  const referrer = state.codes.get(normalizeCode(input.referralCode ?? ""));
  if (!referrer || isSelfReferral(referrer, input)) return null;
  return referrer;
}

function countReferral(state: State, input: SubmitInput): void {
  const referrer = findReferrer(state, input);
  if (!referrer) return;
  referrer.referrals.add(input.deviceId);
  if (referrer.referrals.size >= REWARD.referralNeeded) referrer.kind = "share";
}

function findByNickname(state: State, nickname: string): CodeRecord | null {
  const key = nicknameKey(nickname);
  for (const record of state.codes.values()) {
    if (record.nickKey === key) return record;
  }
  return null;
}

function addCode(state: State, input: SubmitInput, code: string): CodeRecord {
  const record: CodeRecord = {
    code,
    nickname: input.nickname.trim(),
    nickKey: nicknameKey(input.nickname),
    deviceId: input.deviceId,
    score: input.score,
    kind: "base",
    earnedAt: state.now().toISOString(),
    usedAt: null,
    note: null,
    referrals: new Set(),
    token: null,
  };
  state.codes.set(code, record);
  return record;
}

function codeResult(record: CodeRecord): SubmitResult {
  return {
    code: record.code,
    discountPercent: discountFor(record.kind).percent,
    referralProgress: record.referrals.size,
    referralNeeded: REWARD.referralNeeded,
    accepted: true,
  };
}

function issue(state: State, input: SubmitInput): SubmitResult {
  const existing = findByNickname(state, input.nickname);
  if (existing) return codeResult(existing);
  if (input.score < REWARD.discountScore) return noCode();
  if (isExpired(state.now())) return reject("expired");
  const isTaken = (code: string) => state.codes.has(code);
  const code = makeCode(input.nickname, isTaken, state.randomInt);
  if (code === null) return reject("code");
  return codeResult(addCode(state, input, code));
}

function startRound(state: State, deviceId: string): RoundStart | null {
  if (!isDeviceIdValid(deviceId)) return null;
  const hourAgo = state.now().getTime() - 60 * 60 * 1000;
  const dayAgo = state.now().getTime() - 24 * 60 * 60 * 1000;
  const mine = [...state.rounds.values()].filter(
    (row) => row.deviceId === deviceId,
  );
  if (
    mine.filter((row) => row.startedAt >= hourAgo).length >=
    ANTI_CHEAT.roundsPerHour
  )
    return null;
  if (
    mine.filter((row) => row.startedAt >= dayAgo).length >=
    ANTI_CHEAT.roundsPerDay
  )
    return null;
  const id = `rnd-${state.rounds.size + 1}`;
  const token = `T${state.rounds.size + 1}`;
  const seed = (state.randomInt(0xfffffffe) + 1) >>> 0;
  state.rounds.set(id, {
    id,
    token,
    seed,
    deviceId,
    startedAt: state.now().getTime(),
    used: false,
    score: 0,
    wallMs: 0,
    nickname: "",
    inputLog: "",
    flags: [],
    replayOk: null,
    summary: { glass: 0, star: 0, clock: 0, hits: 0 },
  });
  return { id, token, seed };
}

function findRound(
  state: State,
  input: SubmitInput,
): RoundRecord | "legacy" | "bad" {
  if (!input.roundId || !input.token) return "legacy";
  const round = state.rounds.get(input.roundId);
  if (!round || !tokenMatches(round, input)) return "bad";
  return round;
}

function tokenMatches(round: RoundRecord, input: SubmitInput): boolean {
  return round.token === input.token && round.deviceId === input.deviceId;
}

function ageError(age: number): string | null {
  if (age < ANTI_CHEAT.minWallMs) return "too_short";
  return age > ANTI_CHEAT.maxAgeMs ? "expired" : null;
}

function payloadError(input: SubmitInput): string | null {
  if (!input.summary || !summaryIsConsistent(input.summary, input.score))
    return "summary";
  return input.score > 0 && !input.inputLog ? "log" : null;
}

function applyRound(round: RoundRecord, input: SubmitInput, age: number): void {
  round.used = true;
  round.score = input.score;
  round.wallMs = input.wallMs ?? age;
  round.nickname = input.nickname.trim();
  round.inputLog = input.inputLog ?? "";
  round.summary = input.summary ?? round.summary;
}

function roundError(
  found: RoundRecord,
  age: number,
  input: SubmitInput,
): string | null {
  if (found.used) return "used";
  return ageError(age) ?? payloadError(input);
}

function submitRound(state: State, input: SubmitInput): SubmitResult | null {
  const found = findRound(state, input);
  if (found === "legacy") return null;
  if (found === "bad") return reject("round");
  const age = state.now().getTime() - found.startedAt;
  const error = roundError(found, age, input);
  if (error) return reject(error);
  applyRound(found, input, age);
  return null;
}

function submit(state: State, input: SubmitInput): SubmitResult {
  const error = inputError(input);
  if (error) return reject(error);
  const roundError = submitRound(state, input);
  if (roundError) return roundError;
  if (!recordScore(state, input)) return reject("nickname_taken");
  countReferral(state, input);
  return issue(state, input);
}

function listTopRounds(state: State, limit: number): RoundRow[] {
  return [...state.rounds.values()]
    .filter((row) => row.used)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((row) => ({
      id: row.id,
      nickname: row.nickname,
      score: row.score,
      wallMs: row.wallMs,
      startedAt: new Date(row.startedAt).toISOString(),
      flags: row.flags,
      replayOk: row.replayOk,
      summary: row.summary,
    }));
}

function toCheck(record: CodeRecord, now: Date): CodeCheck {
  const discount = discountFor(record.kind);
  return {
    code: record.code,
    status: codeStatus(record.usedAt, now),
    nickname: record.nickname,
    kind: record.kind,
    discountPercent: discount.percent,
    pricePerPerson: discount.price,
    earnedAt: record.earnedAt,
    usedAt: record.usedAt,
  };
}

function check(state: State, code: string): CodeCheck {
  const record = state.codes.get(normalizeCode(code));
  return record ? toCheck(record, state.now()) : unknownCheck(code);
}

function redeem(state: State, code: string, note?: string): RedeemResult {
  const before = check(state, code);
  const record = state.codes.get(before.code);
  if (!record || before.status !== "valid") return { ok: false, check: before };
  record.usedAt = state.now().toISOString();
  record.note = note ?? null;
  return { ok: true, check: toCheck(record, state.now()) };
}

function toCodeRow(record: CodeRecord): CodeRow {
  return {
    code: record.code,
    nickname: record.nickname,
    score: record.score,
    kind: record.kind,
    referrals: record.referrals.size,
    earnedAt: record.earnedAt,
    usedAt: record.usedAt,
  };
}

/** Newest code first, like `list_codes` in SQL. */
function listCodes(state: State, limit: number, offset: number): CodeRow[] {
  const newestFirst = [...state.codes.values()].reverse();
  return newestFirst.slice(offset, offset + limit).map(toCodeRow);
}

function stats(state: State): DashboardStats {
  const codes = [...state.codes.values()];
  return {
    players: state.scores.size,
    codes: codes.length,
    shareCodes: codes.filter((c) => c.kind === "share").length,
    redeemed: codes.filter((c) => c.usedAt !== null).length,
  };
}

function hideNickname(state: State, nickname: string): boolean {
  const row = state.scores.get(nicknameKey(nickname));
  if (!row) return false;
  row.hidden = true;
  return true;
}

function top(state: State, limit: number): ScoreRow[] {
  return [...state.scores.values()]
    .filter((row) => !row.hidden && row.verified)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ nickname, score }) => ({ nickname, score }));
}

const TOKEN_ALPHABET = CODES.alphabet;
const TOKEN_LENGTH = 10;

function newToken(state: State): string {
  let token = "";
  for (let i = 0; i < TOKEN_LENGTH; i += 1) {
    token += TOKEN_ALPHABET[state.randomInt(TOKEN_ALPHABET.length)];
  }
  return state.tokens.has(token) ? newToken(state) : token;
}

function tokenFor(state: State, record: CodeRecord): string {
  if (record.token) return record.token;
  const token = newToken(state);
  record.token = token;
  state.tokens.set(token, record);
  return token;
}

function referralStatus(state: State, code: string): ReferralStatus | null {
  const record = state.codes.get(normalizeCode(code));
  if (!record) return null;
  return {
    token: tokenFor(state, record),
    progress: Math.min(record.referrals.size, REWARD.referralNeeded),
    needed: REWARD.referralNeeded,
    discountPercent: discountFor(record.kind).percent,
  };
}

function canCount(record: CodeRecord | undefined, deviceId: string): boolean {
  if (!record || !isDeviceIdValid(deviceId)) return false;
  return record.deviceId !== deviceId && !record.referrals.has(deviceId);
}

function recordReferralFinish(
  state: State,
  token: string,
  deviceId: string,
): boolean {
  const record = state.tokens.get(token.trim().toUpperCase());
  if (!record || !canCount(record, deviceId)) return false;
  record.referrals.add(deviceId);
  if (record.referrals.size >= REWARD.referralNeeded) record.kind = "share";
  return true;
}

/**
 * In-memory backend for local play and for tests. It does not use the network.
 * It follows the same rules as the SQL functions in `supabase/migrations/`.
 */
export function createMockBackend(options: MockOptions = {}): MockBackend {
  const state: State = {
    scores: new Map(),
    codes: new Map(),
    tokens: new Map(),
    rounds: new Map(),
    now: options.now ?? (() => new Date()),
    randomInt: options.randomInt ?? cryptoRandomInt,
  };
  return {
    startRound: async (deviceId) => startRound(state, deviceId),
    submit: async (input) => submit(state, input),
    top: async (limit) => top(state, limit),
    referralStatus: async (code) => referralStatus(state, code),
    recordReferralFinish: async (token, deviceId) =>
      recordReferralFinish(state, token, deviceId),
    check: async (code) => check(state, code),
    redeem: async (code, note) => redeem(state, code, note),
    listCodes: async (limit, offset) => listCodes(state, limit, offset),
    stats: async () => stats(state),
    hideNickname: async (nickname) => hideNickname(state, nickname),
    listTopRounds: async (limit) => listTopRounds(state, limit),
    confirmReplay: async (roundId, ok, flags) => {
      const row = state.rounds.get(roundId);
      if (!row) return false;
      row.replayOk = ok;
      row.flags = [...flags];
      return true;
    },
    getRoundLog: async (roundId) => {
      const row = state.rounds.get(roundId);
      if (!row) return null;
      return { seed: row.seed, inputLog: row.inputLog, score: row.score };
    },
  };
}
