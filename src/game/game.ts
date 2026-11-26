import {
  CLOCK,
  DEPTH,
  FIELD,
  ITEMS,
  PLAY,
  slowFactor,
  tempoMultiplier,
  tickRemaining,
} from "../config";
import { placeItem } from "./depth";
import { isCaught, spawnItem } from "./spawn";
import type {
  EndReason,
  GameEvent,
  GameState,
  InputState,
  Item,
} from "./types";

export function createGame(): GameState {
  return {
    status: "playing",
    endReason: null,
    playerX: FIELD.width / 2,
    items: [],
    score: 0,
    streak: 0,
    remainingMs: CLOCK.baseDurationMs,
    elapsedRealMs: 0,
    spawnTimerMs: PLAY.spawnEveryMs,
    nextId: 0,
    events: [],
  };
}

function clampX(x: number): number {
  return Math.min(FIELD.width - FIELD.edgePx, Math.max(FIELD.edgePx, x));
}

function movePlayer(x: number, input: InputState, dtMs: number): number {
  const dragged = x + input.dragDx;
  const walked = dragged + (input.dir * PLAY.playerSpeedPxPerSec * dtMs) / 1000;
  return clampX(walked);
}

function advanceItems(
  items: readonly Item[],
  dtMs: number,
  remainingMs: number,
): Item[] {
  const dz =
    (DEPTH.approachPerSec * tempoMultiplier(remainingMs) * dtMs) / 1000;
  return items
    .map((item) => placeItem({ ...item, z: item.z + dz }))
    .filter((item) => item.z < DEPTH.missZ);
}

function spawnDue(
  state: GameState,
  dtMs: number,
  rand: () => number,
): GameState {
  const items = [...state.items];
  let timer = state.spawnTimerMs + dtMs;
  let nextId = state.nextId;
  const every = PLAY.spawnEveryMs / tempoMultiplier(state.remainingMs);
  while (timer >= every) {
    items.push(spawnItem(nextId, rand));
    nextId += 1;
    timer -= every;
  }
  return { ...state, items, spawnTimerMs: timer, nextId };
}

function resolveCatches(state: GameState): GameState {
  const kept: Item[] = [];
  const events: GameEvent[] = [];
  let { score, streak } = state;
  for (const item of state.items) {
    if (!isCaught(item, state.playerX)) {
      kept.push(item);
    } else if (item.kind === "obstacle") {
      streak = 0;
      events.push({ kind: "hit", x: item.x, y: item.y });
    } else {
      streak += 1;
      const points = ITEMS[item.kind].points;
      score += points;
      events.push({
        kind: "catch",
        item: item.kind,
        x: item.x,
        y: item.y,
        points,
        streak,
        factor: slowFactor(streak),
      });
    }
  }
  return { ...state, items: kept, score, streak, events };
}

function endReasonFor(
  remainingMs: number,
  elapsedMs: number,
): EndReason | null {
  if (remainingMs <= 0) return "midnight";
  return elapsedMs >= CLOCK.maxWallClockMs ? "wallClock" : null;
}

function tickClock(state: GameState, dtMs: number, rawDtMs: number): GameState {
  const remainingMs = tickRemaining(
    state.remainingMs,
    dtMs,
    slowFactor(state.streak),
  );
  const elapsedRealMs = state.elapsedRealMs + rawDtMs;
  const endReason = endReasonFor(remainingMs, elapsedRealMs);
  return {
    ...state,
    remainingMs,
    elapsedRealMs,
    endReason,
    status: endReason === null ? "playing" : "ended",
  };
}

/**
 * Advance the round by one frame.
 * The game moves at most PLAY.maxStepMs per call. The full real time still
 * counts toward the wall-clock cap, so a hidden tab cannot stretch a round.
 */
export function stepGame(
  state: GameState,
  rawDtMs: number,
  input: InputState,
  rand: () => number,
): GameState {
  if (state.status === "ended") return { ...state, events: [] };
  const rawMs = Math.max(0, rawDtMs);
  const dtMs = Math.min(rawMs, PLAY.maxStepMs);
  const moved: GameState = {
    ...state,
    playerX: movePlayer(state.playerX, input, dtMs),
    items: advanceItems(state.items, dtMs, state.remainingMs),
  };
  return tickClock(resolveCatches(spawnDue(moved, dtMs, rand)), dtMs, rawMs);
}
