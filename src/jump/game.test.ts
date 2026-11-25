import { describe, expect, it } from "vitest";
import { FIELD, ITEMS, JUMP, PLAY, slowFactor } from "../config";
import {
  comboBonus,
  createJumpGame,
  jumpImpulse,
  nextCameraY,
  runVelocity,
  stepJump,
  wrapX,
} from "./game";
import type { JumpInputState, JumpState } from "./types";

const still: JumpInputState = { axis: 0, jumpDown: false, jumpPressed: false };
const fixed = () => 0.5;

function run(axis: number, jump = false, hold = jump): JumpInputState {
  return { axis, jumpDown: hold, jumpPressed: jump };
}

function tick(
  state: JumpState,
  input: JumpInputState,
  dtMs: number,
  times = 1,
  rand: () => number = fixed,
): JumpState {
  let next = state;
  for (let i = 0; i < times; i += 1) next = stepJump(next, dtMs, input, rand);
  return next;
}

function floorAt(state: JumpState, index: number) {
  return state.floors.find((floor) => floor.index === index);
}

describe("jumpImpulse", () => {
  it("is the minimum at rest and the maximum at full run speed", () => {
    expect(jumpImpulse(0)).toBe(JUMP.jumpSpeedMinPxPerSec);
    expect(jumpImpulse(JUMP.runMaxPxPerSec)).toBe(JUMP.jumpSpeedMaxPxPerSec);
    expect(jumpImpulse(JUMP.runMaxPxPerSec / 2)).toBeCloseTo(
      (JUMP.jumpSpeedMinPxPerSec + JUMP.jumpSpeedMaxPxPerSec) / 2,
      8,
    );
  });
});

describe("wrapX and runVelocity", () => {
  it("wraps past both edges", () => {
    expect(wrapX(-10)).toBe(FIELD.width - 10);
    expect(wrapX(FIELD.width + 8)).toBe(8);
  });

  it("accelerates toward the axis and slows to a stop", () => {
    const sped = runVelocity(0, 1, true, 200);
    expect(sped).toBeGreaterThan(0);
    expect(sped).toBeLessThanOrEqual(JUMP.runMaxPxPerSec);
    expect(runVelocity(100, 0, true, 1_000)).toBe(0);
    const air = runVelocity(0, 1, false, 200);
    expect(air).toBeLessThan(sped);
  });
});

describe("comboBonus", () => {
  it("is 0 when no floor was skipped and caps the multiplier", () => {
    expect(comboBonus(0, 4)).toBe(0);
    expect(comboBonus(2, 3)).toBe(JUMP.comboBonus * 2 * 3);
    expect(comboBonus(1, 99)).toBe(JUMP.comboBonus * JUMP.comboMultCap);
  });
});

describe("createJumpGame", () => {
  it("puts the couple on the ground floor with a 30 s clock", () => {
    const state = createJumpGame(fixed);
    expect(state.status).toBe("playing");
    expect(state.remainingMs).toBe(JUMP.baseDurationMs);
    expect(state.playerY).toBe(JUMP.groundY);
    expect(state.onFloorId).toBe(state.floors[0]?.id);
    expect(state.score).toBe(0);
    expect(state.streak).toBe(0);
  });
});

describe("stepJump movement and jumps", () => {
  it("runs only while there is a run input", () => {
    const start = createJumpGame(fixed);
    const moved = tick(start, run(1), 50, 6);
    expect(moved.playerX).toBeGreaterThan(start.playerX);
    expect(moved.vx).toBeGreaterThan(0);
    const stopped = tick(moved, still, 200, 8);
    expect(stopped.vx).toBe(0);
  });

  it("jumps higher when the couple already has run speed", () => {
    const start = createJumpGame(fixed);
    const restJump = tick(start, run(0, true), 16);
    const gravityDrop = (JUMP.holdGravityPxPerSec2 * 16) / 1000;
    expect(restJump.vy).toBeCloseTo(
      -JUMP.jumpSpeedMinPxPerSec + gravityDrop,
      6,
    );
    expect(restJump.onFloorId).toBeNull();
    const racing = tick(start, run(1), 50, 20);
    const runJump = tick(racing, run(1, true), 16);
    expect(Math.abs(runJump.vy)).toBeGreaterThan(Math.abs(restJump.vy));
  });

  it("does not jump again in the air without coyote time", () => {
    const start = createJumpGame(fixed);
    const midAir = tick(start, run(0, true), 16);
    const again = tick(
      { ...midAir, coyoteMs: 0, jumpBufferMs: 0 },
      run(0, true),
      16,
    );
    expect(again.vy).toBeGreaterThan(midAir.vy);
  });

  it("still jumps during a short coyote window after walking off a floor", () => {
    const start = createJumpGame(fixed);
    const edge = {
      ...start,
      playerX: (start.floors[0]?.x ?? 0) - 80,
      onFloorId: null,
      coyoteMs: JUMP.coyoteMs,
      vx: 0,
    };
    const hopped = tick(edge, run(0, true), 16);
    expect(hopped.vy).toBeLessThan(0);
  });

  it("rises longer while the jump control is held", () => {
    const start = createJumpGame(fixed);
    const held = tick(
      tick(start, run(0, true, true), 16),
      run(0, false, true),
      80,
    );
    const cut = tick(tick(start, run(0, true, true), 16), still, 80);
    expect(held.playerY).toBeLessThan(cut.playerY);
  });
});

describe("landing and combos", () => {
  it("lands on a floor while falling and can skip floors for a combo", () => {
    const start = createJumpGame(fixed);
    const third = floorAt(start, 3);
    expect(third).toBeTruthy();
    const mid = {
      ...start,
      playerX: third!.x + third!.width / 2,
      playerY: third!.y - 12,
      vy: 200,
      onFloorId: null,
      lastFloorIndex: 0,
      pickups: [],
      hazards: [],
    };
    const landed = tick(mid, still, 80);
    expect(landed.onFloorId).toBe(third!.id);
    expect(landed.lastFloorIndex).toBe(3);
    expect(landed.streak).toBe(2);
    expect(landed.score).toBe(3 * JUMP.floorPoints + comboBonus(2, 2));
    expect(landed.events.some((event) => event.kind === "catch")).toBe(true);
  });

  it("resets the combo when the next floor is not skipped", () => {
    const start = createJumpGame(fixed);
    const first = floorAt(start, 1);
    const mid = {
      ...start,
      playerX: first!.x + first!.width / 2,
      playerY: first!.y - 10,
      vy: 200,
      onFloorId: null,
      lastFloorIndex: 0,
      streak: 4,
    };
    const landed = tick(mid, still, 80);
    expect(landed.streak).toBe(0);
    expect(landed.score).toBe(start.score + JUMP.floorPoints);
  });

  it("does not land when the couple is still rising", () => {
    const start = createJumpGame(fixed);
    const first = floorAt(start, 1);
    const up = {
      ...start,
      playerX: first!.x + first!.width / 2,
      playerY: first!.y + 8,
      vy: -400,
      onFloorId: null,
    };
    const next = tick(up, still, 16);
    expect(next.onFloorId).toBeNull();
  });
});

describe("pickups, hazards and falls", () => {
  it("collects a nearby glass and adds its points", () => {
    const start = createJumpGame(fixed);
    const withGlass: JumpState = {
      ...start,
      pickups: [
        {
          id: 900,
          kind: "glass",
          x: start.playerX,
          y: start.playerY - 36,
          floorId: start.onFloorId ?? 1,
        },
      ],
    };
    const got = tick(withGlass, still, 16);
    expect(got.score).toBe(start.score + ITEMS.glass.points);
    expect(got.pickups).toHaveLength(0);
  });

  it("resets the combo on a hazard and bounces the couple", () => {
    const start = createJumpGame(fixed);
    const hit = tick(
      {
        ...start,
        streak: 3,
        invulnMs: 0,
        hazards: [
          {
            id: 901,
            x: start.playerX,
            y: start.playerY - 20,
            floorId: start.onFloorId ?? 1,
          },
        ],
      },
      still,
      16,
    );
    expect(hit.streak).toBe(0);
    expect(hit.vy).toBeLessThan(0);
    expect(hit.events.some((event) => event.kind === "hit")).toBe(true);
    const again = tick(hit, still, 16);
    expect(again.streak).toBe(0);
    expect(again.events).toHaveLength(0);
  });

  it("respawns on a visible floor after a fall and clears the combo", () => {
    const start = createJumpGame(fixed);
    const fallen = tick(
      {
        ...start,
        playerY: start.cameraY + FIELD.height + JUMP.fallMarginPx + 40,
        vy: 300,
        onFloorId: null,
        streak: 5,
      },
      still,
      16,
    );
    expect(fallen.streak).toBe(0);
    expect(fallen.playerY).toBeLessThanOrEqual(
      fallen.cameraY + FIELD.height + JUMP.fallMarginPx,
    );
    expect(fallen.onFloorId).not.toBeNull();
  });

  it("leaves the couple in place when a fall has no floor to land on", () => {
    const start = createJumpGame(fixed);
    const y = start.cameraY + FIELD.height + JUMP.fallMarginPx + 40;
    const stuck = tick(
      { ...start, floors: [], playerY: y, vy: 300, onFloorId: null },
      still,
      16,
    );
    expect(stuck.playerY).toBeGreaterThan(y);
    expect(stuck.onFloorId).toBeNull();
  });
});

describe("clock, camera and end of the round", () => {
  it("slows the midnight clock when a combo is active", () => {
    const start = { ...createJumpGame(fixed), streak: 4 };
    const next = tick(start, still, 1_000);
    const expected = PLAY.maxStepMs / slowFactor(4);
    expect(start.remainingMs - next.remainingMs).toBeCloseTo(expected, 6);
  });

  it("scrolls the camera up and faster as midnight comes closer", () => {
    const early = nextCameraY(0, JUMP.groundY, JUMP.baseDurationMs, 1_000);
    const late = nextCameraY(0, JUMP.groundY, 0, 1_000);
    expect(early).toBeLessThan(0);
    expect(late).toBeLessThan(early);
    const follow = nextCameraY(0, -200, JUMP.baseDurationMs, 16);
    expect(follow).toBeLessThanOrEqual(-200 - JUMP.cameraFollowPx);
  });

  it("ends the round at midnight", () => {
    const start = { ...createJumpGame(fixed), remainingMs: 10 };
    const ended = tick(start, still, 50);
    expect(ended.status).toBe("ended");
    expect(ended.endReason).toBe("midnight");
    expect(tick(ended, run(1, true), 50).events).toEqual([]);
  });

  it("ends the round at the wall-clock cap", () => {
    const start = {
      ...createJumpGame(fixed),
      remainingMs: 20_000,
      elapsedRealMs: JUMP.maxWallClockMs - 10,
    };
    const ended = tick(start, still, 20);
    expect(ended.status).toBe("ended");
    expect(ended.endReason).toBe("wallClock");
  });

  it("does not let a long hidden-tab step skip past the cap logic", () => {
    const start = createJumpGame(fixed);
    const next = tick(start, still, PLAY.maxStepMs * 8);
    expect(next.elapsedRealMs).toBe(PLAY.maxStepMs * 8);
    expect(start.remainingMs - next.remainingMs).toBe(PLAY.maxStepMs);
  });
});
