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
  /** Game time from start to midnight, in milliseconds, at factor 1 (~25 s). */
  baseDurationMs: 25_000,
  /** slowFactor = min(maxFactor, minFactor * streakRatio ** streak). */
  streakRatio: 1.5,
  minFactor: 1,
  /**
   * Cap so a good streak ends near 40 s (25 s * 1.6).
   * 1.5 ** 1 is 1.5; 1.5 ** 2 is 2.25, so the cap applies from streak 2.
   */
  maxFactor: 1.6,
  /** Hard stop in real time. A long streak must not run past about 40 s. */
  maxWallClockMs: 42_000,
} as const;

export const ITEMS = {
  glass: { points: 10, spawnWeight: 4 },
  star: { points: 15, spawnWeight: 3 },
  clock: { points: 20, spawnWeight: 2 },
  obstacle: { points: 0, spawnWeight: 2 },
} as const;

export const PLAY = {
  spawnEveryMs: 600,
  playerSpeedPxPerSec: 420,
  catchRadiusPx: 56,
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

/** Pseudo-3D floor: items come from the vanishing point toward the couple. */
export const DEPTH = {
  /** Same x as the clock centre. */
  vanishX: 195,
  /** Same y as the clock centre, so the hall leads into the clock. */
  vanishY: 298,
  /** Where the visible floor begins, just under the clock ring. */
  horizonY: 470,
  lanes: 5,
  spawnZ: 0.08,
  catchZ: 1,
  catchMinZ: 0.86,
  catchMaxZ: 1.08,
  missZ: 1.16,
  /** Depth units per second at tempo 1. Travel 0.08 → 1 takes about 1.4 s. */
  approachPerSec: 0.65,
  itemSizeFar: 24,
  itemSizeNear: 68,
  easeY: 1.25,
  easeScale: 1.15,
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
  /** Short hold so a drag does not flicker, then idle when the pointer stops. */
  poseHoldMs: 80,
  /** Cross-fade between dance poses. */
  blendMs: 160,
  /** Faster fade into the catch pose. */
  blendCatchMs: 90,
  /** One spin after a catch when the streak is at least spinFromStreak. */
  spinMs: 520,
  spinFromStreak: 2,
  /** Life of a catch sparkle particle. */
  sparkMs: 520,
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

/** Discount code rules. Keep in sync with `supabase/migrations/`. */
export const CODES = {
  /**
   * First instant when a code is expired: 1 January 2027 00:00 Europe/Warsaw (CET, UTC+1).
   * A code is valid until 31 December 2026, 23:59:59 Warsaw time.
   */
  expiresAtIso: "2026-12-31T23:00:00.000Z",
  suffixLength: 4,
  /** 32 characters, no 0, 1, I or O, so staff can read a code aloud. */
  alphabet: "23456789ABCDEFGHJKLMNPQRSTUVWXYZ",
  /** Attempts to find a free suffix that is not a slice of the nickname. */
  maxAttempts: 20,
  /** A device id longer than this is rejected. */
  deviceIdMaxLength: 100,
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
  /** Reception phone in the header of https://gosciniecuniejow.pl/ (read 25 Nov 2026). */
  reservationPhone: "+48 63 28 88 628",
  email: "gosciniecuniejow@gmail.com",
  /** Replace this URL when Tomasz gives the booking page. */
  bookingUrl: "mailto:gosciniecuniejow@gmail.com",
} as const;

export const LEADERBOARD = {
  topN: 20,
} as const;

/** Server-side anti-cheat. Keep in sync with `supabase/migrations/`. */
export const ANTI_CHEAT = {
  /**
   * Shortest honest wall time, in milliseconds.
   * A round is about 25 s at factor 1 (`CLOCK.baseDurationMs`). Slack is 5 s.
   */
  minWallMs: 20_000,
  /** Longest time from start_round to submit, in milliseconds (3 minutes). */
  maxAgeMs: 180_000,
  roundsPerHour: 20,
  roundsPerDay: 60,
  /** Cap for the packed input log, in bytes. */
  logMaxBytes: 16_384,
  /** Human-likeness flags only (they do not reject a score). */
  minEvents: 8,
  minXSpreadPx: 20,
  /** Flag when the standard deviation of event intervals is below this. */
  minIntervalStdMs: 8,
  minReactionMs: 80,
} as const;

/** Staff panel at /panel/. Sign-in is with Kody. */
export const STAFF = {
  /** Kody usernames or Kody user ids that can use the panel. Tomasz adds reception accounts. */
  allowList: ["tomiwu"],
  /** Local dev only: the mock Kody user. Set another user with ?kodyUser=<name>. */
  mockUsername: "tomiwu",
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
