import { FEEDBACK } from "../config";
import { createEffects, ageEffects, applyEvents } from "./effects";
import { createGame, stepGame } from "./game";
import type { GameArt } from "./art";
import type { GameInput } from "./input";
import { drawFrame, type Ctx, type Labels } from "./render";
import type { GameState } from "./types";

export interface RoundDeps {
  readonly ctx: Ctx;
  readonly input: Pick<GameInput, "read">;
  readonly requestFrame: (callback: (timeMs: number) => void) => number;
  readonly cancelFrame: (handle: number) => void;
  readonly rand: () => number;
  readonly labels: Labels;
  readonly art?: GameArt | null;
  /** Override the starting state (used by review shots). */
  readonly createState?: () => GameState;
  /** Called once, with the final state, when the round ends. */
  readonly onEnd: (state: GameState) => void;
}

export function poseFromMove(
  dx: number,
  dir: -1 | 0 | 1,
  holdMs: number,
  lastDir: -1 | 0 | 1,
  dtMs: number,
): { dir: -1 | 0 | 1; holdMs: number } {
  if (Math.abs(dx) > 0.5)
    return { dir: dx > 0 ? 1 : -1, holdMs: FEEDBACK.poseHoldMs };
  if (dir !== 0) return { dir, holdMs: FEEDBACK.poseHoldMs };
  const nextHold = Math.max(0, holdMs - dtMs);
  return { dir: nextHold > 0 ? lastDir : 0, holdMs: nextHold };
}

/** Run one round. Returns a function that stops it early. */
export function runRound(deps: RoundDeps): () => void {
  let state = deps.createState?.() ?? createGame();
  let fx = createEffects();
  let lastMs: number | null = null;
  let running = true;
  let handle = 0;
  let catchAgeMs = 10_000;
  let poseDir: -1 | 0 | 1 = 0;
  let poseHoldMs = 0;
  let lastX = state.playerX;

  const frame = (timeMs: number) => {
    const dtMs = lastMs === null ? 0 : timeMs - lastMs;
    lastMs = timeMs;
    const input = deps.input.read();
    state = stepGame(state, dtMs, input, deps.rand);
    fx = ageEffects(applyEvents(fx, state.events), dtMs);
    if (state.events.some((event) => event.kind === "catch")) catchAgeMs = 0;
    else catchAgeMs += dtMs;
    const pose = poseFromMove(
      state.playerX - lastX,
      input.dir,
      poseHoldMs,
      poseDir,
      dtMs,
    );
    poseDir = pose.dir;
    poseHoldMs = pose.holdMs;
    lastX = state.playerX;
    drawFrame(deps.ctx, state, fx, deps.labels, {
      nowMs: timeMs,
      moveDir: poseDir,
      catchAgeMs,
      art: deps.art ?? null,
    });
    if (state.status === "ended") {
      running = false;
      deps.onEnd(state);
      return;
    }
    handle = deps.requestFrame(frame);
  };

  handle = deps.requestFrame(frame);
  return () => {
    if (!running) return;
    running = false;
    deps.cancelFrame(handle);
  };
}
