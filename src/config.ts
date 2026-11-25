/**
 * All tunable game values live in this file.
 * Change numbers here. Do not hide constants in other modules.
 */

export const COLORS = {
  bg: "#140f0c",
  /** Official Gościniec Uniejów gold from the campaign logo. */
  gold: "#c9a24d",
  /** Cream from the official NYE posters. */
  cream: "#f3eee6",
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
  fallSpeedPxPerSec: 280,
  /**
   * How much fall speed and spawn rate grow as remaining time falls.
   * At midnight the tempo is 1 + tempoBoost (items fall and spawn faster).
   */
  tempoBoost: 1.25,
  /** One frame never moves the game by more than this. A hidden tab must not skip the round. */
  maxStepMs: 100,
} as const;

/** The play field in logical pixels. The canvas scales it to the screen (portrait, phone first). */
export const FIELD = {
  width: 390,
  height: 844,
  /** Vertical centre of the dancing couple (catch zone). */
  playerY: 740,
  /** The couple and new items stay this far from the side edges. */
  edgePx: 32,
  itemRadiusPx: 22,
} as const;

/** Juicy feedback timings, in milliseconds of real time. */
export const FEEDBACK = {
  popMs: 700,
  popRisePx: 60,
  /** Cream flash on a catch when the streak is at least flashFromStreak. */
  flashMs: 280,
  flashFromStreak: 3,
  /** Gold pulse while the clock runs slower than real time. */
  pulseMs: 900,
  /** Red flash on an obstacle hit. */
  hitMs: 320,
  /** How long the catch pose stays after a catch. */
  catchPoseMs: 420,
  /** How long a left/right dance pose stays after a move. */
  poseHoldMs: 280,
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
  /** Regular ticket price in złoty, per person. Confirmed by Tomasz. */
  price: 370,
  /** 10 % game-code price. Exact value from Tomasz (370 - 10 %). */
  priceWithCode: 333,
  /** Share-bonus price after 5 referrals. Exact value from Tomasz (not 20 % of 370). */
  priceWithShare: 299,
  currency: "zł",
  perPerson: "os.",
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
 * How much faster items fall and spawn as midnight comes closer.
 * At the start of the round the value is 1. At midnight it is 1 + tempoBoost.
 */
export function tempoMultiplier(
  remainingMs: number,
  clock = CLOCK,
  play = PLAY,
): number {
  const base = clock.baseDurationMs;
  const remaining = Math.min(Math.max(0, remainingMs), base);
  const urgency = 1 - remaining / base;
  return 1 + urgency * play.tempoBoost;
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

/**
 * Ticket price after a discount.
 * Uses the exact amounts Tomasz confirmed: 333 zl (10 %) and 299 zl (share bonus).
 */
export function discountedPrice(
  percent: number,
  offer = OFFER,
  reward = REWARD,
): number {
  const p = Number.isFinite(percent) ? Math.max(0, percent) : 0;
  if (p >= reward.referralPercent) return offer.priceWithShare;
  if (p >= reward.basePercent) return offer.priceWithCode;
  return offer.price;
}

/** Polish price line, for example "370 zł / os.". */
export function formatOfferPrice(amount: number, offer = OFFER): string {
  return `${amount} ${offer.currency} / ${offer.perPerson}`;
}

/** Highest score a honest client can reach in one round, plus slack. */
export function maxPossibleScore(
  clock = CLOCK,
  items = ITEMS,
  play = PLAY,
  reward = REWARD,
): number {
  const fastestEvery = play.spawnEveryMs / (1 + play.tempoBoost);
  const maxSpawns = Math.floor(clock.maxWallClockMs / fastestEvery) + 1;
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
