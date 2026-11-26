import { CLOCK } from "../config";

/** Equal remaining-time slots for the Uniejow backdrop sequence. */
export const VIEWS = {
  count: 5,
  /**
   * Cross-fade length as a fraction of the full clock.
   * 0.04 is 1 s of game time at factor 1, or 20 % of one slot.
   */
  fade: 0.04,
} as const;

export type ViewFade = {
  readonly from: number;
  readonly to: number;
  readonly mix: number;
};

function fadePair(
  slot: number,
  count: number,
  elapsed: number,
  fadeStart: number,
  fadeMs: number,
): ViewFade {
  if (slot >= count - 1 || elapsed < fadeStart) {
    return { from: slot, to: slot, mix: 1 };
  }
  const mix = Math.min(1, (elapsed - fadeStart) / Math.max(fadeMs, 1));
  if (mix < 1) return { from: slot, to: slot + 1, mix };
  return { from: slot + 1, to: slot + 1, mix: 1 };
}

/**
 * Pick the backdrop pair from remaining game time.
 * Every player sees all views in one round. Streak only stretches wall-clock time.
 * mix is 0 at the start of a fade and 1 when the next view is fully on.
 */
export function viewCrossfade(
  remainingMs: number,
  base: number = CLOCK.baseDurationMs,
  count: number = VIEWS.count,
  fade: number = VIEWS.fade,
): ViewFade {
  const safeCount = Math.max(1, Math.floor(count));
  const safeBase = Math.max(1, base);
  const remaining = Math.min(Math.max(0, remainingMs), safeBase);
  const elapsed = safeBase - remaining;
  const slotMs = safeBase / safeCount;
  const fadeMs = Math.min(slotMs * 0.5, Math.max(0, fade) * safeBase);
  const slot = Math.min(safeCount - 1, Math.floor(elapsed / slotMs));
  return fadePair(
    slot,
    safeCount,
    elapsed,
    (slot + 1) * slotMs - fadeMs,
    fadeMs,
  );
}

/** Remaining game time at the middle of a slot, for review shots. */
export function remainingForSlot(
  slot: number,
  base: number = CLOCK.baseDurationMs,
  count: number = VIEWS.count,
): number {
  const safeCount = Math.max(1, Math.floor(count));
  const index = Math.min(safeCount - 1, Math.max(0, Math.floor(slot)));
  const progress = (index + 0.5) / safeCount;
  return Math.round((1 - progress) * base);
}
