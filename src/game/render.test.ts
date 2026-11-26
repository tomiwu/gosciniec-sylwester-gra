import { describe, expect, it } from "vitest";
import { FEEDBACK } from "../config";
import { createEffects } from "./effects";
import { createGame } from "./game";
import {
  drawFrame,
  formatClock,
  formatFactor,
  type Ctx,
  type Labels,
} from "./render";
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
    items: kinds.map((kind, id) => ({ id, kind, x: 50 + id * 40, y: 200 })),
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

  it("shows the score and the clock in Polish labels", () => {
    const { ctx, texts } = fakeCtx();
    drawFrame(
      ctx,
      stateWith([], { score: 45, remainingMs: 30_000, streak: 2 }),
      createEffects(),
      labels,
    );
    expect(texts).toContain("Wynik: 45");
    expect(texts).toContain("Do północy: 0:30");
    expect(texts).toContain("×2.3");
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
