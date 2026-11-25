import { describe, expect, it } from "vitest";
import {
  CLOCK,
  FIELD,
  ITEMS,
  PLAY,
  slowFactor,
  tempoMultiplier,
} from "../config";
import { createGame, stepGame } from "./game";
import type { GameState, InputState, Item } from "./types";

const idle: InputState = { dir: 0, targetX: null };
const zero = () => 0;

function quiet(patch: Partial<GameState> = {}): GameState {
  return { ...createGame(), spawnTimerMs: 0, ...patch };
}

function itemAtPlayer(state: GameState, kind: Item["kind"], id = 1): Item {
  return { id, kind, x: state.playerX, y: FIELD.playerY };
}

describe("createGame", () => {
  it("starts in the middle with a full clock", () => {
    const state = createGame();
    expect(state).toMatchObject({
      status: "playing",
      endReason: null,
      playerX: FIELD.width / 2,
      score: 0,
      streak: 0,
      remainingMs: CLOCK.baseDurationMs,
      elapsedRealMs: 0,
    });
    expect(state.items).toEqual([]);
  });
});

describe("player movement", () => {
  it("moves with the keyboard at the player speed", () => {
    const state = stepGame(quiet(), 100, { dir: 1, targetX: null }, zero);
    expect(state.playerX).toBeCloseTo(
      FIELD.width / 2 + PLAY.playerSpeedPxPerSec * 0.1,
      6,
    );
    const back = stepGame(quiet(), 100, { dir: -1, targetX: null }, zero);
    expect(back.playerX).toBeLessThan(FIELD.width / 2);
  });

  it("follows a pointer target at once", () => {
    const state = stepGame(quiet(), 16, { dir: 0, targetX: 120 }, zero);
    expect(state.playerX).toBe(120);
  });

  it("stays inside the side margins", () => {
    const left = stepGame(quiet(), 16, { dir: 0, targetX: -50 }, zero);
    expect(left.playerX).toBe(FIELD.edgePx);
    const right = stepGame(quiet(), 16, { dir: 0, targetX: 9999 }, zero);
    expect(right.playerX).toBe(FIELD.width - FIELD.edgePx);
  });
});

describe("items", () => {
  it("spawns an item on the first step and then on the interval", () => {
    const first = stepGame(createGame(), 16, idle, zero);
    expect(first.items).toHaveLength(1);
    let second = first;
    for (let ms = 0; ms < PLAY.spawnEveryMs; ms += 50) {
      second = stepGame(second, 50, idle, () => 0.5);
    }
    expect(second.items).toHaveLength(2);
    expect(second.items[1]?.id).toBe(1);
    expect(second.nextId).toBe(2);
  });

  it("makes items fall and removes them below the field", () => {
    const state = quiet({
      items: [
        { id: 1, kind: "star", x: 10, y: 100 },
        { id: 2, kind: "star", x: 10, y: FIELD.height + FIELD.itemRadiusPx },
      ],
    });
    const next = stepGame(state, 100, idle, zero);
    expect(next.items).toHaveLength(1);
    expect(next.items[0]?.y).toBeCloseTo(100 + PLAY.fallSpeedPxPerSec * 0.1, 6);
  });
});

describe("catching", () => {
  it.each(["glass", "star", "clock"] as const)(
    "scores a %s and raises the streak",
    (kind) => {
      const base = quiet();
      const next = stepGame(
        { ...base, items: [itemAtPlayer(base, kind)] },
        16,
        idle,
        zero,
      );
      expect(next.score).toBe(ITEMS[kind].points);
      expect(next.streak).toBe(1);
      expect(next.items).toEqual([]);
      expect(next.events).toEqual([
        expect.objectContaining({
          kind: "catch",
          item: kind,
          points: ITEMS[kind].points,
          streak: 1,
          factor: slowFactor(1),
        }),
      ]);
    },
  );

  it("adds up a streak of catches in one step", () => {
    const base = quiet();
    const next = stepGame(
      {
        ...base,
        items: [itemAtPlayer(base, "glass", 1), itemAtPlayer(base, "star", 2)],
      },
      16,
      idle,
      zero,
    );
    expect(next.score).toBe(ITEMS.glass.points + ITEMS.star.points);
    expect(next.streak).toBe(2);
  });

  it("does not break the streak when an item is missed", () => {
    const state = quiet({
      streak: 3,
      items: [{ id: 1, kind: "glass", x: 20, y: FIELD.height }],
    });
    const next = stepGame(state, 100, idle, zero);
    expect(next.streak).toBe(3);
    expect(next.items).toHaveLength(0);
  });
});

describe("obstacles", () => {
  it("reset the streak to 0 and keep the score", () => {
    const base = quiet({ streak: 4, score: 80 });
    const next = stepGame(
      { ...base, items: [itemAtPlayer(base, "obstacle")] },
      16,
      idle,
      zero,
    );
    expect(next.streak).toBe(0);
    expect(next.score).toBe(80);
    expect(next.status).toBe("playing");
    expect(next.events).toEqual([expect.objectContaining({ kind: "hit" })]);
  });
});

describe("clock", () => {
  it("runs at real speed without a streak", () => {
    const next = stepGame(quiet(), 100, idle, zero);
    expect(next.remainingMs).toBeCloseTo(CLOCK.baseDurationMs - 100, 6);
  });

  it("slows down with the streak as 1.5 ** streak", () => {
    const next = stepGame(quiet({ streak: 2 }), 100, idle, zero);
    expect(next.remainingMs).toBeCloseTo(CLOCK.baseDurationMs - 100 / 2.25, 6);
  });

  it("slows down at once when a catch raises the streak", () => {
    const base = quiet();
    const next = stepGame(
      { ...base, items: [itemAtPlayer(base, "glass")] },
      100,
      idle,
      zero,
    );
    expect(next.remainingMs).toBeCloseTo(CLOCK.baseDurationMs - 100 / 1.5, 6);
  });

  it("applies the cap to a long streak", () => {
    const next = stepGame(quiet({ streak: 50 }), 100, idle, zero);
    expect(next.remainingMs).toBeCloseTo(
      CLOCK.baseDurationMs - 100 / CLOCK.maxFactor,
      6,
    );
  });
});

describe("end of the round", () => {
  it("ends at midnight", () => {
    const next = stepGame(quiet({ remainingMs: 10 }), 16, idle, zero);
    expect(next.status).toBe("ended");
    expect(next.endReason).toBe("midnight");
    expect(next.remainingMs).toBe(0);
  });

  it("ends at the wall-clock cap even with a long streak", () => {
    const state = quiet({ streak: 50, elapsedRealMs: 89_950 });
    const next = stepGame(state, 100, idle, zero);
    expect(next.status).toBe("ended");
    expect(next.endReason).toBe("wallClock");
    expect(next.remainingMs).toBeGreaterThan(0);
  });

  it("counts a long hidden-tab gap as real time but moves the game one step", () => {
    const next = stepGame(quiet(), 1_000_000, idle, zero);
    expect(next.status).toBe("ended");
    expect(next.endReason).toBe("wallClock");
    expect(next.remainingMs).toBe(CLOCK.baseDurationMs - PLAY.maxStepMs);
  });

  it("never lasts more than the wall-clock cap with a capped streak", () => {
    let state = quiet({ streak: 50 });
    const dt = 16;
    let steps = 0;
    while (state.status === "playing" && steps < 100_000) {
      state = { ...stepGame(state, dt, idle, zero), streak: 50 };
      steps += 1;
    }
    expect(state.endReason).toBe("wallClock");
    expect(state.elapsedRealMs).toBeLessThanOrEqual(CLOCK.maxWallClockMs + dt);
  });

  it("ends after about 60 s of game time at factor 1", () => {
    let state = createGame();
    const dt = 50;
    while (state.status === "playing") {
      state = stepGame(state, dt, { dir: 0, targetX: 5000 }, () => 0.99);
      state = { ...state, streak: 0 };
    }
    expect(state.endReason).toBe("midnight");
    expect(state.elapsedRealMs).toBeCloseTo(CLOCK.baseDurationMs, -2);
  });

  it("freezes an ended round", () => {
    const ended = stepGame(quiet({ remainingMs: 1 }), 16, idle, zero);
    const again = stepGame(ended, 16, { dir: 1, targetX: null }, zero);
    expect(again).toEqual({ ...ended, events: [] });
  });
});

describe("tempo as time runs down", () => {
  it("makes items fall faster when less time remains", () => {
    const late = quiet({
      remainingMs: 0,
      items: [{ id: 1, kind: "star", x: 10, y: 100 }],
    });
    const next = stepGame(late, 100, idle, zero);
    expect(next.items[0]?.y).toBeCloseTo(
      100 + PLAY.fallSpeedPxPerSec * tempoMultiplier(0) * 0.1,
      6,
    );
  });

  it("keeps the start-of-round fall speed at the base rate", () => {
    const state = quiet({
      items: [{ id: 1, kind: "star", x: 10, y: 100 }],
    });
    const next = stepGame(state, 100, idle, zero);
    expect(next.items[0]?.y).toBeCloseTo(100 + PLAY.fallSpeedPxPerSec * 0.1, 6);
  });

  it("spawns sooner when less time remains", () => {
    const remaining = 1_000;
    const late = quiet({ remainingMs: remaining, spawnTimerMs: 0 });
    const every = PLAY.spawnEveryMs / tempoMultiplier(remaining);
    expect(every).toBeLessThan(PLAY.spawnEveryMs);
    let state = late;
    let elapsed = 0;
    while (elapsed < every + 40 && state.items.length === 0) {
      state = stepGame(state, 50, idle, zero);
      elapsed += 50;
    }
    expect(state.items.length).toBeGreaterThanOrEqual(1);
    expect(elapsed).toBeLessThan(PLAY.spawnEveryMs);
  });
});
