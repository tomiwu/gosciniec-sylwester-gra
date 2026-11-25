import { FEEDBACK } from "../config";
import {
  createEffects,
  ageEffects,
  applyEvents,
  type Effects,
} from "./effects";
import { createGame, stepGame } from "./game";
import type { GameArt } from "./art";
import type { GameInput } from "./input";
import { drawFrame, type Ctx, type Labels, type PoseId } from "./render";
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
  /** Override the starting effects (used by review shots). */
  readonly initialEffects?: Effects;
  /** Catch and spin ages at the first frame (used by review shots). */
  readonly seedMotion?: { catchAgeMs: number; spinAgeMs: number };
  /** Draw one frame and stop (used by review shots). */
  readonly pauseAfterFirstFrame?: boolean;
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

export function poseIdFrom(moveDir: -1 | 0 | 1, catchAgeMs: number): PoseId {
  if (catchAgeMs < FEEDBACK.catchPoseMs) return "catch";
  if (moveDir < 0) return "left";
  if (moveDir > 0) return "right";
  return "idle";
}

export function stepPoseBlend(
  pose: PoseId,
  prevPose: PoseId,
  blend: number,
  nextPose: PoseId,
  dtMs: number,
): { pose: PoseId; prevPose: PoseId; blend: number } {
  const fadeMs =
    nextPose === "catch" ? FEEDBACK.blendCatchMs : FEEDBACK.blendMs;
  if (nextPose !== pose) {
    return {
      pose: nextPose,
      prevPose: pose,
      blend: Math.min(1, dtMs / fadeMs),
    };
  }
  return { pose, prevPose, blend: Math.min(1, blend + dtMs / fadeMs) };
}

/** One ease-out turn, or 0 when the spin is over. */
export function spinAngle(spinAgeMs: number): number {
  if (spinAgeMs < 0 || spinAgeMs >= FEEDBACK.spinMs) return 0;
  const t = spinAgeMs / FEEDBACK.spinMs;
  return (1 - (1 - t) * (1 - t)) * Math.PI * 2;
}

/** Run one round. Returns a function that stops it early. */
export function runRound(deps: RoundDeps): () => void {
  let state = deps.createState?.() ?? createGame();
  let fx = deps.initialEffects ?? createEffects();
  let lastMs: number | null = null;
  let running = true;
  let handle = 0;
  let catchAgeMs = deps.seedMotion?.catchAgeMs ?? 10_000;
  let spinAgeMs = deps.seedMotion?.spinAgeMs ?? FEEDBACK.spinMs;
  let poseDir: -1 | 0 | 1 = 0;
  let poseHoldMs = 0;
  let lastX = state.playerX;
  let pose: PoseId = poseIdFrom(0, catchAgeMs);
  let prevPose: PoseId = pose;
  let blend = 1;

  const frame = (timeMs: number) => {
    const dtMs = lastMs === null ? 0 : timeMs - lastMs;
    lastMs = timeMs;
    const input = deps.input.read();
    state = stepGame(state, dtMs, input, deps.rand);
    fx = ageEffects(applyEvents(fx, state.events), dtMs);
    if (state.events.some((event) => event.kind === "catch")) {
      catchAgeMs = 0;
      if (state.streak >= FEEDBACK.spinFromStreak) spinAgeMs = 0;
    } else {
      catchAgeMs += dtMs;
      spinAgeMs += dtMs;
    }
    const next = poseFromMove(
      state.playerX - lastX,
      input.dir,
      poseHoldMs,
      poseDir,
      dtMs,
    );
    poseDir = next.dir;
    poseHoldMs = next.holdMs;
    lastX = state.playerX;
    const stepped = stepPoseBlend(
      pose,
      prevPose,
      blend,
      poseIdFrom(poseDir, catchAgeMs),
      dtMs,
    );
    pose = stepped.pose;
    prevPose = stepped.prevPose;
    blend = stepped.blend;
    drawFrame(deps.ctx, state, fx, deps.labels, {
      nowMs: timeMs,
      moveDir: poseDir,
      catchAgeMs,
      pose,
      prevPose,
      blend,
      lean: pose === "catch" ? 0 : poseDir * 0.14,
      spinRad: spinAngle(spinAgeMs),
      art: deps.art ?? null,
    });
    if (state.status === "ended") {
      running = false;
      deps.onEnd(state);
      return;
    }
    if (deps.pauseAfterFirstFrame) return;
    handle = deps.requestFrame(frame);
  };

  handle = deps.requestFrame(frame);
  return () => {
    if (!running) return;
    running = false;
    deps.cancelFrame(handle);
  };
}
