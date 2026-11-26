import { describe, expect, it } from "vitest";
import { CLOCK } from "../config";
import {
  poseFromMove,
  poseIdFrom,
  spinAngle,
  stepPoseBlend,
  runRound,
} from "./session";
import { FEEDBACK } from "../config";
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

const idle: InputState = { dir: 0, dragDx: 0 };

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

  it("can pause after the first frame for a review shot", () => {
    const frames = scheduler();
    const ended: GameState[] = [];
    runRound({
      ctx: fakeCtx(),
      input: { read: () => idle },
      requestFrame: frames.requestFrame,
      cancelFrame: frames.cancelFrame,
      rand: () => 0,
      labels: { score: "Wynik", time: "Do północy" },
      pauseAfterFirstFrame: true,
      onEnd: (state) => ended.push(state),
    });
    frames.tick(0);
    expect(frames.pending()).toBe(false);
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
  it("follows a move and returns to idle after a short hold", () => {
    expect(poseFromMove(4, 0, 0, 0, 16)).toEqual({
      dir: 1,
      holdMs: FEEDBACK.poseHoldMs,
    });
    expect(poseFromMove(-4, 0, 0, 0, 16)).toEqual({
      dir: -1,
      holdMs: FEEDBACK.poseHoldMs,
    });
    expect(poseFromMove(0, 1, 0, 0, 16)).toEqual({
      dir: 1,
      holdMs: FEEDBACK.poseHoldMs,
    });
    expect(poseFromMove(0, 0, 50, -1, 20)).toEqual({ dir: -1, holdMs: 30 });
    expect(poseFromMove(0, 0, 20, 1, 40)).toEqual({ dir: 0, holdMs: 0 });
  });
});

describe("poseIdFrom", () => {
  it("picks catch, left, right and idle", () => {
    expect(poseIdFrom(0, 0)).toBe("catch");
    expect(poseIdFrom(-1, 10_000)).toBe("left");
    expect(poseIdFrom(1, 10_000)).toBe("right");
    expect(poseIdFrom(0, 10_000)).toBe("idle");
  });
});

describe("stepPoseBlend", () => {
  it("starts a fade when the pose changes, then completes it", () => {
    const start = stepPoseBlend("idle", "idle", 1, "left", 40);
    expect(start).toEqual({
      pose: "left",
      prevPose: "idle",
      blend: 40 / FEEDBACK.blendMs,
    });
    const mid = stepPoseBlend(
      start.pose,
      start.prevPose,
      start.blend,
      "left",
      40,
    );
    expect(mid.blend).toBeCloseTo(80 / FEEDBACK.blendMs);
    const done = stepPoseBlend("left", "idle", 0.9, "left", 1_000);
    expect(done).toEqual({ pose: "left", prevPose: "idle", blend: 1 });
  });

  it("fades into the catch pose faster", () => {
    const start = stepPoseBlend("idle", "idle", 1, "catch", 45);
    expect(start.blend).toBeCloseTo(45 / FEEDBACK.blendCatchMs);
  });
});

describe("spinAngle", () => {
  it("turns once and then stops", () => {
    expect(spinAngle(-1)).toBe(0);
    expect(spinAngle(0)).toBe(0);
    expect(spinAngle(FEEDBACK.spinMs / 2)).toBeGreaterThan(Math.PI);
    expect(spinAngle(FEEDBACK.spinMs / 2)).toBeLessThan(Math.PI * 2);
    expect(spinAngle(FEEDBACK.spinMs)).toBe(0);
  });
});
