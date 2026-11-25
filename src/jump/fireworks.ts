import { COLORS } from "../config";

export interface Spark {
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  readonly ageMs: number;
  readonly lifeMs: number;
  readonly color: string;
}

export function makeBurst(
  x: number,
  y: number,
  rand: () => number,
  count = 18,
): Spark[] {
  const colors = [COLORS.gold, COLORS.cream, "#e8d196", "#f6e7b2"];
  const sparks: Spark[] = [];
  for (let i = 0; i < count; i += 1) {
    const angle = (Math.PI * 2 * i) / count + rand() * 0.2;
    const speed = 40 + rand() * 120;
    sparks.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      ageMs: 0,
      lifeMs: 700 + rand() * 500,
      color: colors[Math.floor(rand() * colors.length)] ?? COLORS.gold,
    });
  }
  return sparks;
}

export function stepSparks(sparks: readonly Spark[], dtMs: number): Spark[] {
  const dt = dtMs / 1000;
  return sparks
    .map((spark) => ({
      ...spark,
      x: spark.x + spark.vx * dt,
      y: spark.y + spark.vy * dt + 40 * dt,
      vy: spark.vy + 90 * dt,
      ageMs: spark.ageMs + dtMs,
    }))
    .filter((spark) => spark.ageMs < spark.lifeMs);
}

export function burstOrigin(
  width: number,
  height: number,
  rand: () => number,
): { x: number; y: number } {
  return {
    x: width * (0.15 + rand() * 0.7),
    y: height * (0.12 + rand() * 0.35),
  };
}
