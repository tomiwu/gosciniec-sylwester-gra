import { describe, expect, it } from "vitest";
import { createJumpGame, stepJump } from "./game";
import { moveDirFromAxis, runJumpRound } from "./session";
import type { Ctx, JumpLabels } from "./render";
import type { JumpInputState } from "./types";

const labels: JumpLabels = {
  score: "Wynik",
  time: "Do północy",
  combo: "Seria",
  faster: "Szybciej",
};

function fakeCtx(): Ctx {
  return new Proxy(
    {},
    {
      get:
        (_target, name) =>
        (..._args: unknown[]) => {
          if (name === "createRadialGradient") return { addColorStop() {} };
          return undefined;
        },
      set: () => true,
    },
  ) as unknown as Ctx;
}

describe("moveDirFromAxis", () => {
  it("follows a clear axis or a real run speed, and is 0 at rest", () => {
    expect(moveDirFromAxis(-0.4, 0)).toBe(-1);
    expect(moveDirFromAxis(0.4, 0)).toBe(1);
    expect(moveDirFromAxis(0, -80)).toBe(-1);
    expect(moveDirFromAxis(0, 80)).toBe(1);
    expect(moveDirFromAxis(0, 0)).toBe(0);
  });
});

describe("runJumpRound", () => {
  it("draws frames and reports the final state at midnight", () => {
    const frames: number[] = [];
    let stopFrame = 0;
    const cancel: number[] = [];
    let endedScore = -1;
    const input = {
      read: (): JumpInputState => ({
        axis: 0,
        jumpDown: false,
        jumpPressed: false,
      }),
    };
    const stop = runJumpRound({
      ctx: fakeCtx(),
      input,
      rand: () => 0.5,
      labels,
      requestFrame: (cb) => {
        frames.push(frames.length);
        if (frames.length < 4) cb(frames.length * 20);
        else stopFrame = frames.length;
        return frames.length;
      },
      cancelFrame: (handle) => {
        cancel.push(handle);
      },
      createState: () => ({
        ...createJumpGame(() => 0.5),
        remainingMs: 8,
      }),
      onEnd: (state) => {
        endedScore = state.score;
        expect(state.status).toBe("ended");
      },
    });
    expect(endedScore).toBeGreaterThanOrEqual(0);
    expect(frames.length).toBeGreaterThan(0);
    stop();
    const idle = runJumpRound({
      ctx: fakeCtx(),
      input,
      rand: () => 0.5,
      labels,
      requestFrame: () => 7,
      cancelFrame: (handle) => {
        cancel.push(handle);
      },
      onEnd: () => {
        endedScore = 999;
      },
    });
    idle();
    expect(cancel).toContain(7);
    expect(stopFrame).toBeGreaterThanOrEqual(0);
    const frozen = stepJump(
      { ...createJumpGame(), status: "ended", endReason: "midnight" },
      16,
      input.read(),
      () => 0.5,
    );
    expect(frozen.events).toEqual([]);
  });
});
