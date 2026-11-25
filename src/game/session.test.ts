import { describe, expect, it } from "vitest";
import { CLOCK } from "../config";
import { poseFromMove, runRound } from "./session";
import type { Ctx } from "./render";
import type { GameState, InputState } from "./types";

function fakeCtx(): Ctx {
  return new Proxy({}, { get: () => () => undefined, set: () => true }) as Ctx;
}

function scheduler() {
  let callback: ((t: number) => void) | null = null;
  let nextHandle = 0;
  const cancelled: number[] = [];
  return {
    requestFrame: (cb: (t: number) => void) => {
      callback = cb;
      nextHandle += 1;
      return nextHandle;
    },
    cancelFrame: (handle: number) => {
      cancelled.push(handle);
      callback = null;
    },
    tick: (t: number) => {
      const cb = callback;
      callback = null;
      cb?.(t);
    },
    pending: () => callback !== null,
    cancelled,
  };
}

const idle: InputState = { dir: 0, targetX: null };

function start() {
  const frames = scheduler();
  const ended: GameState[] = [];
  const stop = runRound({
    ctx: fakeCtx(),
    input: { read: () => idle },
    requestFrame: frames.requestFrame,
    cancelFrame: frames.cancelFrame,
    rand: () => 0,
    labels: { score: "Wynik", time: "Do północy" },
    onEnd: (state) => ended.push(state),
  });
  return { frames, ended, stop };
}

describe("runRound", () => {
  it("schedules frames until the round ends and reports the final state", () => {
    const { frames, ended } = start();
    expect(frames.pending()).toBe(true);
    frames.tick(1000);
    frames.tick(1016);
    expect(ended).toEqual([]);
    expect(frames.pending()).toBe(true);
    frames.tick(1016 + CLOCK.maxWallClockMs + 1);
    expect(ended).toHaveLength(1);
    expect(ended[0]).toMatchObject({ status: "ended", endReason: "wallClock" });
    expect(frames.pending()).toBe(false);
  });

  it("stops without reporting when the caller stops it", () => {
    const { frames, ended, stop } = start();
    stop();
    expect(frames.cancelled).toHaveLength(1);
    expect(frames.pending()).toBe(false);
    stop();
    expect(frames.cancelled).toHaveLength(1);
    expect(ended).toEqual([]);
  });

  it("does not cancel after the round has ended", () => {
    const { frames, stop } = start();
    frames.tick(0);
    frames.tick(CLOCK.maxWallClockMs * 2);
    stop();
    expect(frames.cancelled).toEqual([]);
  });
});

describe("poseFromMove", () => {
  it("follows a move and then returns to idle after the hold", () => {
    expect(poseFromMove(4, 0, 0, 0, 16)).toEqual({ dir: 1, holdMs: 280 });
    expect(poseFromMove(-4, 0, 0, 0, 16)).toEqual({ dir: -1, holdMs: 280 });
    expect(poseFromMove(0, 1, 0, 0, 16)).toEqual({ dir: 1, holdMs: 280 });
    expect(poseFromMove(0, 0, 100, -1, 40)).toEqual({ dir: -1, holdMs: 60 });
    expect(poseFromMove(0, 0, 20, 1, 40)).toEqual({ dir: 0, holdMs: 0 });
  });
});
