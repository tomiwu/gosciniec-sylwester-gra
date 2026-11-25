import {
  FIELD,
  ITEMS,
  JUMP,
  PLAY,
  jumpClock,
  jumpScrollSpeed,
  slowFactor,
  tickRemaining,
} from "../config";
import type { GameEvent } from "../game/types";
import { extendFloors, initialFloors, pruneFloors } from "./floors";
import type { Floor, Hazard, JumpInputState, JumpState, Pickup } from "./types";

const clock = jumpClock();

export function jumpImpulse(vx: number): number {
  const ratio = Math.min(1, Math.abs(vx) / JUMP.runMaxPxPerSec);
  return (
    JUMP.jumpSpeedMinPxPerSec +
    ratio * (JUMP.jumpSpeedMaxPxPerSec - JUMP.jumpSpeedMinPxPerSec)
  );
}

export function wrapX(x: number, width = FIELD.width): number {
  return ((x % width) + width) % width;
}

export function runVelocity(
  vx: number,
  axis: number,
  onFloor: boolean,
  dtMs: number,
): number {
  const dt = dtMs / 1000;
  const control = onFloor ? 1 : JUMP.airControl;
  const max = JUMP.runMaxPxPerSec;
  if (axis === 0) {
    const decel = JUMP.runDecelPxPerSec2 * dt * control;
    if (Math.abs(vx) <= decel) return 0;
    return vx - Math.sign(vx) * decel;
  }
  const next = vx + axis * JUMP.runAccelPxPerSec2 * dt * control;
  return Math.max(-max, Math.min(max, next));
}

export function nextCameraY(
  cameraY: number,
  playerY: number,
  remainingMs: number,
  dtMs: number,
): number {
  const scrolled = cameraY - (jumpScrollSpeed(remainingMs) * dtMs) / 1000;
  const follow = playerY - JUMP.cameraFollowPx;
  return Math.min(scrolled, follow);
}

export function comboBonus(skipped: number, streak: number): number {
  if (skipped <= 0) return 0;
  const mult = Math.min(Math.max(1, streak), JUMP.comboMultCap);
  return JUMP.comboBonus * skipped * mult;
}

export function createJumpGame(rand: () => number = () => 0.5): JumpState {
  const pack = initialFloors(rand);
  const ground = pack.floors[0];
  const x = ground ? ground.x + ground.width / 2 : FIELD.width / 2;
  return {
    status: "playing",
    endReason: null,
    playerX: x,
    playerY: JUMP.groundY,
    vx: 0,
    vy: 0,
    onFloorId: ground ? ground.id : null,
    lastFloorIndex: 0,
    floors: pack.floors,
    pickups: pack.pickups,
    hazards: pack.hazards,
    score: 0,
    streak: 0,
    remainingMs: JUMP.baseDurationMs,
    elapsedRealMs: 0,
    cameraY: 0,
    nextId: pack.nextId,
    events: [],
    jumpBufferMs: 0,
    coyoteMs: ground ? JUMP.coyoteMs : 0,
    invulnMs: 0,
  };
}

function overlapX(left: number, width: number, x: number): boolean {
  const half = JUMP.playerWidthPx / 2;
  return x + half > left && x - half < left + width;
}

function near(ax: number, ay: number, bx: number, by: number, radius: number) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy <= radius * radius;
}

function floorById(floors: readonly Floor[], id: number | null): Floor | null {
  if (id === null) return null;
  return floors.find((floor) => floor.id === id) ?? null;
}

function takeJump(state: JumpState): JumpState {
  const canJump = state.onFloorId !== null || state.coyoteMs > 0;
  if (!canJump || state.jumpBufferMs <= 0) return state;
  return {
    ...state,
    vy: -jumpImpulse(state.vx),
    onFloorId: null,
    coyoteMs: 0,
    jumpBufferMs: 0,
  };
}

function integrate(state: JumpState, input: JumpInputState, dtMs: number) {
  const onFloor = state.onFloorId !== null;
  const vx = runVelocity(state.vx, input.axis, onFloor, dtMs);
  const rising = state.vy < 0;
  const gravity =
    input.jumpDown && rising
      ? JUMP.holdGravityPxPerSec2
      : JUMP.gravityPxPerSec2;
  const vy = onFloor ? 0 : state.vy + (gravity * dtMs) / 1000;
  return {
    ...state,
    vx,
    vy,
    playerX: wrapX(state.playerX + (vx * dtMs) / 1000),
    playerY: state.playerY + (vy * dtMs) / 1000,
  };
}

function awardLand(state: JumpState, floor: Floor): JumpState {
  if (floor.index <= state.lastFloorIndex) {
    return { ...state, onFloorId: floor.id, playerY: floor.y, vy: 0 };
  }
  const skipped = floor.index - state.lastFloorIndex - 1;
  const climbed = floor.index - state.lastFloorIndex;
  const streak = skipped > 0 ? state.streak + skipped : 0;
  const bonus = comboBonus(skipped, streak);
  const points = climbed * JUMP.floorPoints + bonus;
  const events: GameEvent[] =
    bonus > 0
      ? [
          {
            kind: "catch",
            item: "star",
            x: state.playerX,
            y: floor.y,
            points: bonus,
            streak,
            factor: slowFactor(streak),
          },
        ]
      : [];
  return {
    ...state,
    onFloorId: floor.id,
    playerY: floor.y,
    vy: 0,
    lastFloorIndex: floor.index,
    streak,
    score: state.score + points,
    events: [...state.events, ...events],
  };
}

function crossesFloor(prevY: number, state: JumpState, floor: Floor): boolean {
  return (
    prevY <= floor.y &&
    state.playerY >= floor.y &&
    overlapX(floor.x, floor.width, state.playerX)
  );
}

function findLanding(prevY: number, state: JumpState): Floor | null {
  if (state.vy < 0) return null;
  return (
    state.floors.find((floor) => crossesFloor(prevY, state, floor)) ?? null
  );
}

function settleOnFloor(prevY: number, moved: JumpState): JumpState {
  const floor = findLanding(prevY, moved);
  const landed = floor
    ? awardLand(moved, floor)
    : { ...moved, onFloorId: null };
  const stillOn = floorById(landed.floors, landed.onFloorId);
  if (!stillOn) return landed;
  if (overlapX(stillOn.x, stillOn.width, landed.playerX)) {
    return { ...landed, playerY: stillOn.y, vy: 0 };
  }
  return { ...landed, onFloorId: null };
}

function collectPickups(state: JumpState): JumpState {
  const kept: Pickup[] = [];
  const events: GameEvent[] = [...state.events];
  let score = state.score;
  for (const item of state.pickups) {
    if (
      !near(
        state.playerX,
        state.playerY - 36,
        item.x,
        item.y,
        JUMP.pickupRadiusPx,
      )
    ) {
      kept.push(item);
      continue;
    }
    const points = ITEMS[item.kind].points;
    score += points;
    events.push({
      kind: "catch",
      item: item.kind,
      x: item.x,
      y: item.y,
      points,
      streak: state.streak,
      factor: slowFactor(state.streak),
    });
  }
  return { ...state, pickups: kept, score, events };
}

function hitHazard(state: JumpState, hazard: Hazard): JumpState {
  if (state.invulnMs > 0) return state;
  return {
    ...state,
    streak: 0,
    vy: -JUMP.hitBouncePxPerSec,
    onFloorId: null,
    coyoteMs: 0,
    invulnMs: JUMP.invulnMs,
    events: [...state.events, { kind: "hit", x: hazard.x, y: hazard.y }],
  };
}

function resolveHazards(state: JumpState): JumpState {
  if (state.invulnMs > 0) return state;
  for (const hazard of state.hazards) {
    if (
      near(
        state.playerX,
        state.playerY - 24,
        hazard.x,
        hazard.y,
        JUMP.hazardRadiusPx,
      )
    ) {
      return hitHazard(state, hazard);
    }
  }
  return state;
}

function lowestVisibleFloor(state: JumpState): Floor | null {
  const bottom = state.cameraY + FIELD.height;
  const visible = state.floors.filter(
    (floor) => floor.y >= state.cameraY && floor.y <= bottom,
  );
  if (visible.length === 0) return state.floors[0] ?? null;
  return visible.reduce((a, b) => (a.y > b.y ? a : b));
}

function respawn(state: JumpState): JumpState {
  const floor = lowestVisibleFloor(state);
  if (!floor) return state;
  return {
    ...state,
    playerX: floor.x + floor.width / 2,
    playerY: floor.y,
    vx: 0,
    vy: 0,
    onFloorId: floor.id,
    streak: 0,
    coyoteMs: JUMP.coyoteMs,
    invulnMs: JUMP.invulnMs,
    events: [
      ...state.events,
      { kind: "hit", x: floor.x + floor.width / 2, y: floor.y },
    ],
  };
}

function fellOff(state: JumpState): boolean {
  return state.playerY > state.cameraY + FIELD.height + JUMP.fallMarginPx;
}

function stepWorld(state: JumpState, rand: () => number, cameraY: number) {
  const grown = extendFloors(
    {
      floors: [...state.floors],
      pickups: [...state.pickups],
      hazards: [...state.hazards],
      nextId: state.nextId,
    },
    cameraY,
    rand,
  );
  const trimmed = pruneFloors(grown, cameraY);
  return {
    ...state,
    floors: trimmed.floors,
    pickups: trimmed.pickups,
    hazards: trimmed.hazards,
    nextId: trimmed.nextId,
    cameraY,
  };
}

function nextBuffer(state: JumpState, pressed: boolean, dtMs: number): number {
  return pressed ? JUMP.jumpBufferMs : Math.max(0, state.jumpBufferMs - dtMs);
}

function nextCoyote(state: JumpState, dtMs: number): number {
  if (state.onFloorId !== null) return JUMP.coyoteMs;
  return Math.max(0, state.coyoteMs - dtMs);
}

function endReasonFor(
  remainingMs: number,
  elapsedMs: number,
): JumpState["endReason"] {
  if (remainingMs <= 0) return "midnight";
  return elapsedMs >= clock.maxWallClockMs ? "wallClock" : null;
}

function tickTimers(
  state: JumpState,
  input: JumpInputState,
  dtMs: number,
  rawMs: number,
): JumpState {
  const remainingMs = tickRemaining(
    state.remainingMs,
    dtMs,
    slowFactor(state.streak),
  );
  const elapsedRealMs = state.elapsedRealMs + rawMs;
  const endReason = endReasonFor(remainingMs, elapsedRealMs);
  return {
    ...state,
    jumpBufferMs: nextBuffer(state, input.jumpPressed, dtMs),
    coyoteMs: nextCoyote(state, dtMs),
    invulnMs: Math.max(0, state.invulnMs - dtMs),
    remainingMs,
    elapsedRealMs,
    endReason,
    status: endReason === null ? "playing" : "ended",
  };
}

/**
 * Advance the climb by one frame.
 * The game moves at most PLAY.maxStepMs per call. The full real time still
 * counts toward the wall-clock cap.
 */
export function stepJump(
  state: JumpState,
  rawDtMs: number,
  input: JumpInputState,
  rand: () => number,
): JumpState {
  if (state.status === "ended") return { ...state, events: [] };
  const rawMs = Math.max(0, rawDtMs);
  const dtMs = Math.min(rawMs, PLAY.maxStepMs);
  const timed = tickTimers({ ...state, events: [] }, input, dtMs, rawMs);
  const launched = takeJump(timed);
  const grounded = settleOnFloor(
    launched.playerY,
    integrate(launched, input, dtMs),
  );
  const picked = resolveHazards(collectPickups(grounded));
  const recovered = fellOff(picked) ? respawn(picked) : picked;
  return stepWorld(
    recovered,
    rand,
    nextCameraY(
      recovered.cameraY,
      recovered.playerY,
      recovered.remainingMs,
      dtMs,
    ),
  );
}
