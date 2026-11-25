import { createEffects, ageEffects, applyEvents } from "../game/effects";
import type { GameArt } from "../game/art";
import { createJumpGame, stepJump } from "./game";
import type { JumpInput } from "./input";
import { drawJumpFrame, type Ctx, type JumpLabels } from "./render";
import type { JumpState } from "./types";

export interface JumpRoundDeps {
  readonly ctx: Ctx;
  readonly input: Pick<JumpInput, "read">;
  readonly requestFrame: (callback: (timeMs: number) => void) => number;
  readonly cancelFrame: (handle: number) => void;
  readonly rand: () => number;
  readonly labels: JumpLabels;
  readonly art?: GameArt | null;
  readonly createState?: () => JumpState;
  readonly onEnd: (state: JumpState) => void;
}

export function moveDirFromAxis(axis: number, vx: number): -1 | 0 | 1 {
  if (axis < -0.05 || vx < -40) return -1;
  if (axis > 0.05 || vx > 40) return 1;
  return 0;
}

/** Run one climb round. Returns a function that stops it early. */
export function runJumpRound(deps: JumpRoundDeps): () => void {
  let state = deps.createState?.() ?? createJumpGame(deps.rand);
  let fx = createEffects();
  let lastMs: number | null = null;
  let running = true;
  let handle = 0;

  const frame = (timeMs: number) => {
    const dtMs = lastMs === null ? 0 : timeMs - lastMs;
    lastMs = timeMs;
    const input = deps.input.read();
    state = stepJump(state, dtMs, input, deps.rand);
    fx = ageEffects(applyEvents(fx, state.events), dtMs);
    drawJumpFrame(deps.ctx, state, fx, deps.labels, {
      nowMs: timeMs,
      moveDir: moveDirFromAxis(input.axis, state.vx),
      airborne: state.onFloorId === null,
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
