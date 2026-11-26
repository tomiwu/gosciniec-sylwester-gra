import { FEEDBACK } from "../config";
import type { GameEvent } from "./types";

export interface Pop {
  readonly x: number;
  readonly y: number;
  readonly points: number;
  readonly ageMs: number;
}

export interface Effects {
  readonly pops: readonly Pop[];
  /** Time left of the cream streak flash. */
  readonly flashMs: number;
  /** Time left of the gold pulse (the clock runs slower). */
  readonly pulseMs: number;
  /** Time left of the red obstacle flash. */
  readonly hitMs: number;
}

export function createEffects(): Effects {
  return { pops: [], flashMs: 0, pulseMs: 0, hitMs: 0 };
}

function applyEvent(fx: Effects, event: GameEvent): Effects {
  if (event.kind === "hit") return { ...fx, hitMs: FEEDBACK.hitMs };
  const pop: Pop = {
    x: event.x,
    y: event.y,
    points: event.points,
    ageMs: 0,
  };
  return {
    ...fx,
    pops: [...fx.pops, pop],
    flashMs:
      event.streak >= FEEDBACK.flashFromStreak ? FEEDBACK.flashMs : fx.flashMs,
    pulseMs: event.factor > 1 ? FEEDBACK.pulseMs : fx.pulseMs,
  };
}

export function applyEvents(
  fx: Effects,
  events: readonly GameEvent[],
): Effects {
  return events.reduce(applyEvent, fx);
}

export function ageEffects(fx: Effects, dtMs: number): Effects {
  const down = (ms: number) => Math.max(0, ms - dtMs);
  return {
    pops: fx.pops
      .map((pop) => ({ ...pop, ageMs: pop.ageMs + dtMs }))
      .filter((pop) => pop.ageMs < FEEDBACK.popMs),
    flashMs: down(fx.flashMs),
    pulseMs: down(fx.pulseMs),
    hitMs: down(fx.hitMs),
  };
}
