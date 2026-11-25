import { describe, expect, it } from "vitest";
import { FEEDBACK } from "../config";
import { createEffects } from "./effects";
import { placeItem } from "./depth";
import { createGame } from "./game";
import {
  clockAngles,
  drawFrame,
  formatClock,
  formatFactor,
  type Ctx,
  type Labels,
} from "./render";
import { CLOCK } from "../config";
import type { GameState, ItemKind } from "./types";

const labels: Labels = { score: "Wynik", time: "Do północy" };

function fakeCtx() {
  const calls: string[] = [];
  const texts: string[] = [];
  const sets: Record<string, unknown> = {};
  const ctx = new Proxy(
    {},
    {
      get:
        (_target, name) =>
        (...args: unknown[]) => {
          calls.push(String(name));
          if (name === "fillText") texts.push(String(args[0]));
        },
      set: (_target, name, value) => {
        sets[String(name)] = value;
        return true;
      },
    },
  ) as unknown as Ctx;
  return { ctx, calls, texts, sets };
}

function stateWith(kinds: ItemKind[], patch: Partial<GameState> = {}) {
  return {
    ...createGame(),
    items: kinds.map((kind, id) =>
      placeItem({ id, kind, lane: id, z: 0.4 + id * 0.15 }),
    ),
    ...patch,
  };
}

describe("formatClock", () => {
  it("rounds up to whole seconds as m:ss", () => {
    expect(formatClock(60_000)).toBe("1:00");
    expect(formatClock(59_001)).toBe("1:00");
    expect(formatClock(5_500)).toBe("0:06");
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(-5)).toBe("0:00");
  });
});

describe("formatFactor", () => {
  it("is empty at factor 1 and shows one decimal above", () => {
    expect(formatFactor(1)).toBe("");
    expect(formatFactor(2.25)).toBe("×2.3");
    expect(formatFactor(6)).toBe("×6.0");
  });
});

describe("clockAngles", () => {
  it("starts at 11:00 and ends at midnight", () => {
    const start = clockAngles(CLOCK.baseDurationMs);
    const end = clockAngles(0);
    expect(start.hour).toBeCloseTo((11 / 12) * Math.PI * 2 - Math.PI / 2, 8);
    expect(start.minute).toBeCloseTo(-Math.PI / 2, 8);
    expect(end.hour).toBeCloseTo(-Math.PI / 2, 8);
    expect(end.minute).toBeCloseTo(-Math.PI / 2, 8);
  });

  it("puts the minute hand at 6 at half time", () => {
    const mid = clockAngles(CLOCK.baseDurationMs / 2);
    expect(mid.minute).toBeCloseTo(Math.PI / 2, 8);
  });
});

describe("drawFrame", () => {
  it("paints the background and the couple", () => {
    const { ctx, calls } = fakeCtx();
    drawFrame(ctx, createGame(), createEffects(), labels);
    expect(calls).toContain("fillRect");
    expect(calls).toContain("ellipse");
  });

  it("draws every item kind", () => {
    const { ctx, calls } = fakeCtx();
    const kinds: ItemKind[] = ["glass", "star", "clock", "obstacle"];
    drawFrame(ctx, stateWith(kinds), createEffects(), labels);
    expect(calls.filter((c) => c === "fill").length).toBeGreaterThan(
      kinds.length,
    );
    expect(calls).toContain("lineTo");
  });

  it("shows the score and the streak factor, not a digital timer", () => {
    const { ctx, texts } = fakeCtx();
    drawFrame(
      ctx,
      stateWith([], { score: 45, remainingMs: 30_000, streak: 2 }),
      createEffects(),
      labels,
    );
    expect(texts).toContain("Wynik: 45");
    expect(texts).toContain("×1.6");
    expect(texts.some((line) => line.includes("Do północy"))).toBe(false);
    expect(texts.some((line) => /\d:\d\d/.test(line))).toBe(false);
  });

  it("does not show a factor at streak 0", () => {
    const { ctx, texts } = fakeCtx();
    drawFrame(ctx, stateWith([]), createEffects(), labels);
    expect(texts.some((t) => t.startsWith("×"))).toBe(false);
  });

  it("draws pops and the three overlays while they last", () => {
    const quiet = fakeCtx();
    drawFrame(quiet.ctx, createGame(), createEffects(), labels);
    const busy = fakeCtx();
    drawFrame(
      busy.ctx,
      createGame(),
      {
        pops: [{ x: 100, y: 300, points: 15, ageMs: FEEDBACK.popMs / 2 }],
        sparks: [],
        flashMs: FEEDBACK.flashMs,
        pulseMs: FEEDBACK.pulseMs,
        hitMs: FEEDBACK.hitMs,
      },
      labels,
    );
    expect(busy.texts).toContain("+15");
    expect(busy.calls.filter((c) => c === "strokeRect")).toHaveLength(1);
    expect(busy.calls.filter((c) => c === "fillRect").length).toBe(
      quiet.calls.filter((c) => c === "fillRect").length + 2,
    );
  });
});

function stubImg(width = 80, height = 120) {
  return { width, height } as HTMLImageElement;
}

function stubArt() {
  return {
    skyline: stubImg(720, 1280),
    clockRing: stubImg(720, 720),
    coupleIdle: stubImg(80, 120),
    coupleLeft: stubImg(80, 120),
    coupleRight: stubImg(80, 120),
    coupleCatch: stubImg(80, 120),
    itemGlass: stubImg(64, 90),
    itemStar: stubImg(80, 80),
    itemClock: stubImg(60, 90),
    itemObstacle: stubImg(80, 80),
  };
}

describe("drawFrame with art", () => {
  it("draws the skyline, the clock ring and the couple", () => {
    const { ctx, calls } = fakeCtx();
    drawFrame(ctx, createGame(), createEffects(), labels, {
      nowMs: 1_000,
      art: stubArt(),
    });
    expect(calls.filter((name) => name === "drawImage").length).toBeGreaterThan(
      2,
    );
  });

  it("draws item sprites when art is present", () => {
    const { ctx, calls } = fakeCtx();
    const kinds: ItemKind[] = ["glass", "star", "clock", "obstacle"];
    const before = fakeCtx();
    drawFrame(before.ctx, stateWith([]), createEffects(), labels, {
      art: stubArt(),
    });
    drawFrame(ctx, stateWith(kinds), createEffects(), labels, {
      art: stubArt(),
    });
    expect(calls.filter((name) => name === "drawImage").length).toBe(
      before.calls.filter((name) => name === "drawImage").length + kinds.length,
    );
  });

  it("draws sparkles around a catch", () => {
    const { ctx, calls } = fakeCtx();
    drawFrame(
      ctx,
      createGame(),
      {
        ...createEffects(),
        sparks: [
          {
            x: 100,
            y: 200,
            vx: 10,
            vy: -20,
            ageMs: 80,
            lifeMs: FEEDBACK.sparkMs,
            size: 3,
            hue: "gold",
          },
        ],
      },
      labels,
    );
    expect(calls).toContain("translate");
    expect(calls).toContain("fill");
  });

  it("cross-fades between couple poses", () => {
    const { ctx, calls } = fakeCtx();
    drawFrame(ctx, createGame(), createEffects(), labels, {
      nowMs: 800,
      art: stubArt(),
      pose: "left",
      prevPose: "idle",
      blend: 0.4,
      lean: -0.14,
      spinRad: 0.5,
    });
    // skyline + clock ring + previous pose + current pose
    expect(calls.filter((name) => name === "drawImage").length).toBeGreaterThan(
      3,
    );
  });

  it("uses the left, right and catch poses", () => {
    const art = stubArt();
    for (const view of [
      { moveDir: -1 as const, catchAgeMs: 10_000 },
      { moveDir: 1 as const, catchAgeMs: 10_000 },
      { moveDir: 0 as const, catchAgeMs: 0 },
    ]) {
      const { ctx, calls } = fakeCtx();
      drawFrame(ctx, createGame(), createEffects(), labels, {
        nowMs: 800,
        art,
        ...view,
      });
      expect(calls).toContain("drawImage");
    }
  });
});
