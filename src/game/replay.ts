import { ANTI_CHEAT, ITEMS } from "../config";
import { createGame, stepGame } from "./game";
import type { InputLogEvent, StepSample } from "./input-log";
import { createRng } from "./rng";
import type { GameState, ItemKind } from "./types";

export type CatchSummary = {
  glass: number;
  star: number;
  clock: number;
  hits: number;
};

export function emptySummary(): CatchSummary {
  return { glass: 0, star: 0, clock: 0, hits: 0 };
}

export function addEventToSummary(
  summary: CatchSummary,
  kind: "catch" | "hit",
  item?: ItemKind,
): CatchSummary {
  if (kind === "hit") return { ...summary, hits: summary.hits + 1 };
  if (item === "glass" || item === "star" || item === "clock") {
    return { ...summary, [item]: summary[item] + 1 };
  }
  return summary;
}

export function scoreFromSummary(summary: CatchSummary): number {
  return (
    summary.glass * ITEMS.glass.points +
    summary.star * ITEMS.star.points +
    summary.clock * ITEMS.clock.points
  );
}

export function summaryIsConsistent(
  summary: CatchSummary,
  score: number,
): boolean {
  const counts = [summary.glass, summary.star, summary.clock, summary.hits];
  if (counts.some((n) => !Number.isInteger(n) || n < 0)) return false;
  return scoreFromSummary(summary) === score;
}

export type ReplayResult = {
  readonly state: GameState;
  readonly summary: CatchSummary;
};

/** Recompute the score from the server seed and the recorded step samples. */
export function replayRound(
  seed: number,
  steps: readonly StepSample[],
): ReplayResult {
  const rand = createRng(seed);
  let state = createGame();
  let summary = emptySummary();
  for (const step of steps) {
    state = stepGame(
      state,
      step.dt,
      { dir: step.dir, dragDx: step.dragDx },
      rand,
    );
    for (const event of state.events) {
      summary = addEventToSummary(
        summary,
        event.kind,
        event.kind === "catch" ? event.item : undefined,
      );
    }
  }
  return { state, summary };
}

export type LikenessFlag =
  | "few_events"
  | "regular_timing"
  | "no_spread"
  | "fast_start"
  | "log_capped";

function intervalStd(events: readonly InputLogEvent[]): number {
  if (events.length < 3) return Number.POSITIVE_INFINITY;
  const gaps: number[] = [];
  for (let i = 1; i < events.length; i += 1) {
    gaps.push(events[i]!.t - events[i - 1]!.t);
  }
  const mean = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
  const varSum = gaps.reduce((sum, gap) => sum + (gap - mean) ** 2, 0);
  return Math.sqrt(varSum / gaps.length);
}

function xSpread(events: readonly InputLogEvent[]): number {
  const xs = events
    .map((event) => event.x)
    .filter((x): x is number => typeof x === "number");
  if (xs.length === 0) return 0;
  return Math.max(...xs) - Math.min(...xs);
}

/**
 * Human-likeness flags. They never reject a score; staff can still review them.
 */
function capFlag(capped: boolean): LikenessFlag[] {
  return capped ? ["log_capped"] : [];
}

function countFlag(events: readonly InputLogEvent[]): LikenessFlag[] {
  return events.length < ANTI_CHEAT.minEvents ? ["few_events"] : [];
}

function timingFlag(events: readonly InputLogEvent[]): LikenessFlag[] {
  if (events.length < 3) return [];
  return intervalStd(events) < ANTI_CHEAT.minIntervalStdMs
    ? ["regular_timing"]
    : [];
}

function spreadFlag(events: readonly InputLogEvent[]): LikenessFlag[] {
  return xSpread(events) < ANTI_CHEAT.minXSpreadPx ? ["no_spread"] : [];
}

function startFlag(events: readonly InputLogEvent[]): LikenessFlag[] {
  const first = events[0];
  return first && first.t < ANTI_CHEAT.minReactionMs ? ["fast_start"] : [];
}

export function likenessFlags(
  events: readonly InputLogEvent[],
  capped = false,
): LikenessFlag[] {
  return [
    ...capFlag(capped),
    ...countFlag(events),
    ...timingFlag(events),
    ...spreadFlag(events),
    ...startFlag(events),
  ];
}
