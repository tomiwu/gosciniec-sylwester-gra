import { unpackLog } from "../game/input-log";
import {
  likenessFlags,
  replayRound,
  summaryIsConsistent,
} from "../game/replay";

export type VerifyResult = {
  ok: boolean;
  flags: string[];
  replayedScore: number;
};

/** Replay a packed log in process. Postgres does not run this. */
export function verifyPackedLog(score: number, raw: string): VerifyResult {
  const log = unpackLog(raw);
  if (!log) return { ok: false, flags: ["bad_log"], replayedScore: -1 };
  const replayed = replayRound(log.seed, log.steps);
  const flags = [...likenessFlags(log.events, log.capped)];
  const ok =
    replayed.state.score === score &&
    summaryIsConsistent(replayed.summary, score);
  return { ok, flags, replayedScore: replayed.state.score };
}
