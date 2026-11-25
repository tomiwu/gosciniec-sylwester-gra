import { createEffects, ageEffects, applyEvents } from "./effects";
import { createGame, stepGame } from "./game";
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
  /** Called once, with the final state, when the round ends. */
  readonly onEnd: (state: GameState) => void;
}

/** Run one round. Returns a function that stops it early. */
export function runRound(deps: RoundDeps): () => void {
  let state = createGame();
  let fx = createEffects();
  let lastMs: number | null = null;
  let running = true;
  let handle = 0;

  const frame = (timeMs: number) => {
    const dtMs = lastMs === null ? 0 : timeMs - lastMs;
    lastMs = timeMs;
    state = stepGame(state, dtMs, deps.input.read(), deps.rand);
    fx = ageEffects(applyEvents(fx, state.events), dtMs);
    drawFrame(deps.ctx, state, fx, deps.labels);
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
