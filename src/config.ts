/**
 * All tunable game values live in this file.
 * Change numbers here. Do not hide constants in other modules.
 */

export const COLORS = {
  bg: "#140f0c",
  gold: "#d4af37",
  cream: "#f6f0e4",
  red: "#e10600",
  dark: "#0b0a09",
} as const;

/** Game-clock slow-down. Factor 1 = real time. A higher factor makes midnight come later. */
export const CLOCK = {
  /** Game time from start to midnight, in milliseconds, at factor 1. */
  baseDurationMs: 60_000,
  /** slowFactor = min(maxFactor, minFactor * streakRatio ** streak). */
  streakRatio: 1.5,
  minFactor: 1,
  /** Cap so a round stays short. 1.5 ** 5 is about 7.59, so 6 is near a streak of 5. */
  maxFactor: 6,
  /** Hard stop in real time. A long streak must not make a round last many minutes. */
  maxWallClockMs: 90_000,
} as const;

export const ITEMS = {
  glass: { points: 10, spawnWeight: 4 },
  star: { points: 15, spawnWeight: 3 },
  clock: { points: 20, spawnWeight: 2 },
  obstacle: { points: 0, spawnWeight: 2 },
} as const;

export const PLAY = {
  spawnEveryMs: 700,
  playerSpeedPxPerSec: 420,
  catchRadiusPx: 56,
} as const;

export const REWARD = {
  /** Score that unlocks the 10 % discount code. */
  discountScore: 200,
  basePercent: 10,
  referralPercent: 20,
  referralNeeded: 5,
  nicknameMaxLength: 16,
  codePrefix: "SYL-",
  /** Reject a score above this value (sanity check). See maxPossibleScore(). */
  scoreSlack: 50,
} as const;

export const OFFER = {
  title: "Sylwester 2026/2027",
  subtitle: "Oferta dla par",
  priceWas: 740,
  priceNow: 599,
  currency: "zł",
  eventStart: "31.12.2026, godz. 20:00",
  dj: "DJ Letsky",
  address: "ul. Sienkiewicza 137, 99-210 Uniejów",
  phones: ["63 28 88 410", "602 260 965"],
  email: "gosciniecuniejow@gmail.com",
  /** Replace this URL when Tomasz gives the booking page. */
  bookingUrl: "mailto:gosciniecuniejow@gmail.com",
} as const;

export const LEADERBOARD = {
  topN: 20,
} as const;

/**
 * Return the clock slow factor for a catch streak.
 * streak 0 => minFactor (usually 1).
 * The factor grows as streakRatio ** streak, and then the cap applies.
 */
export function slowFactor(streak: number, clock = CLOCK): number {
  const safe = Number.isFinite(streak) ? Math.max(0, Math.floor(streak)) : 0;
  const raw = clock.minFactor * clock.streakRatio ** safe;
  return Math.min(clock.maxFactor, raw);
}

/**
 * Reduce remaining game time.
 * A factor above 1 makes the remaining time fall more slowly.
 */
export function tickRemaining(
  remainingMs: number,
  dtMs: number,
  factor: number,
): number {
  if (dtMs <= 0) {
    return Math.max(0, remainingMs);
  }
  const safeFactor = Math.max(1, factor);
  return Math.max(0, remainingMs - dtMs / safeFactor);
}

/** Highest score a honest client can reach in one round, plus slack. */
export function maxPossibleScore(
  clock = CLOCK,
  items = ITEMS,
  play = PLAY,
  reward = REWARD,
): number {
  const maxSpawns = Math.floor(clock.maxWallClockMs / play.spawnEveryMs) + 1;
  const bestPoints = Math.max(
    items.glass.points,
    items.star.points,
    items.clock.points,
  );
  return maxSpawns * bestPoints + reward.scoreSlack;
}

export function isScoreSane(score: number): boolean {
  return Number.isInteger(score) && score >= 0 && score <= maxPossibleScore();
}

export function isNicknameValid(
  name: string,
  max = REWARD.nicknameMaxLength,
): boolean {
  const trimmed = name.trim();
  return (
    trimmed.length >= 1 && trimmed.length <= max && !/\s{2,}/.test(trimmed)
  );
}
