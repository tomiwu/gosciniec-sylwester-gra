import { FEEDBACK } from "../config";
import type { GameEvent } from "./types";

export interface Pop {
  readonly x: number;
  readonly y: number;
  readonly points: number;
  readonly ageMs: number;
}

export interface Spark {
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  readonly ageMs: number;
  readonly lifeMs: number;
  readonly size: number;
  readonly hue: "gold" | "cream";
}

export interface Effects {
  readonly pops: readonly Pop[];
  readonly sparks: readonly Spark[];
  /** Time left of the cream streak flash. */
  readonly flashMs: number;
  /** Time left of the gold pulse (the clock runs slower). */
  readonly pulseMs: number;
  /** Time left of the red obstacle flash. */
  readonly hitMs: number;
}

const SPARK_COUNT = 12;

/** Gold and cream sparkles that burst from a catch. */
export function catchSparks(x: number, y: number): Spark[] {
  return Array.from({ length: SPARK_COUNT }, (_, i) => {
    const angle = (Math.PI * 2 * i) / SPARK_COUNT - Math.PI / 2;
    const speed = 90 + (i % 3) * 40;
    return {
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 40,
      ageMs: 0,
      lifeMs: FEEDBACK.sparkMs + (i % 3) * 50,
      size: 2 + (i % 3),
      hue: i % 2 === 0 ? "gold" : "cream",
    } as const;
  });
}

export function createEffects(): Effects {
  return { pops: [], sparks: [], flashMs: 0, pulseMs: 0, hitMs: 0 };
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
    sparks: [...fx.sparks, ...catchSparks(event.x, event.y)],
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

function stepSpark(spark: Spark, dtMs: number): Spark {
  const sec = dtMs / 1000;
  return {
    ...spark,
    x: spark.x + spark.vx * sec,
    y: spark.y + spark.vy * sec,
    vy: spark.vy + 180 * sec,
    ageMs: spark.ageMs + dtMs,
  };
}

export function ageEffects(fx: Effects, dtMs: number): Effects {
  const down = (ms: number) => Math.max(0, ms - dtMs);
  return {
    pops: fx.pops
      .map((pop) => ({ ...pop, ageMs: pop.ageMs + dtMs }))
      .filter((pop) => pop.ageMs < FEEDBACK.popMs),
    sparks: fx.sparks
      .map((spark) => stepSpark(spark, dtMs))
      .filter((spark) => spark.ageMs < spark.lifeMs),
    flashMs: down(fx.flashMs),
    pulseMs: down(fx.pulseMs),
    hitMs: down(fx.hitMs),
  };
}
