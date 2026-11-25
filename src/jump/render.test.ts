import { describe, expect, it } from "vitest";
import { FEEDBACK, JUMP } from "../config";
import type { GameArt } from "../game/art";
import { createEffects } from "../game/effects";
import { formatClock } from "../game/render";
import { clockSize, drawJumpFrame, type Ctx, type JumpLabels } from "./render";
import { createJumpGame } from "./game";
import type { JumpState } from "./types";

const labels: JumpLabels = {
  score: "Wynik",
  time: "Do północy",
  combo: "Seria",
  faster: "Szybciej",
};

function fakeCtx() {
  const calls: string[] = [];
  const texts: string[] = [];
  const ctx = new Proxy(
    {},
    {
      get:
        (_target, name) =>
        (...args: unknown[]) => {
          calls.push(String(name));
          if (name === "fillText") texts.push(String(args[0]));
          if (name === "createRadialGradient") {
            return { addColorStop() {} };
          }
          return undefined;
        },
      set: () => true,
    },
  ) as unknown as Ctx;
  return { ctx, calls, texts };
}

function richState(): JumpState {
  const base = createJumpGame(() => 0.35);
  const floor =
    base.floors.find((item) => item.kind === "tray") ?? base.floors[1];
  const lamp =
    base.floors.find((item) => item.kind === "chandelier") ?? base.floors[2];
  return {
    ...base,
    remainingMs: 8_000,
    score: 160,
    streak: 3,
    playerX: 180,
    playerY: (floor?.y ?? 500) - 10,
    cameraY: (floor?.y ?? 500) - 500,
    pickups: [
      { id: 1, kind: "glass", x: 80, y: (floor?.y ?? 500) - 30, floorId: 1 },
      { id: 2, kind: "star", x: 140, y: (floor?.y ?? 500) - 40, floorId: 1 },
      { id: 3, kind: "clock", x: 200, y: (floor?.y ?? 500) - 40, floorId: 1 },
    ],
    hazards: [{ id: 4, x: 240, y: (lamp?.y ?? 400) - 20, floorId: 2 }],
  };
}

describe("clockSize", () => {
  it("grows as midnight comes closer", () => {
    expect(clockSize(JUMP.baseDurationMs)).toBe(210);
    expect(clockSize(0)).toBe(300);
    expect(clockSize(JUMP.baseDurationMs / 2)).toBe(255);
  });
});

describe("drawJumpFrame", () => {
  it("draws the score, combo, and faster cue late in a round", () => {
    const { ctx, texts, calls } = fakeCtx();
    drawJumpFrame(ctx, richState(), createEffects(), labels, { nowMs: 1_200 });
    expect(texts.some((text) => text.includes("Wynik: 160"))).toBe(true);
    expect(texts.some((text) => text.includes("Seria 3"))).toBe(true);
    expect(texts).toContain("Szybciej");
    expect(texts).toContain(formatClock(8_000));
    expect(calls).toContain("fillRect");
  });

  it("draws a fallback couple and pops when art is missing", () => {
    const { ctx, calls, texts } = fakeCtx();
    const fx = {
      ...createEffects(),
      pops: [{ x: 100, y: 200, points: 40, ageMs: 0 }],
      flashMs: FEEDBACK.flashMs,
      hitMs: FEEDBACK.hitMs,
      pulseMs: FEEDBACK.pulseMs,
    };
    drawJumpFrame(ctx, createJumpGame(), fx, labels, { nowMs: 0, art: null });
    expect(texts.some((text) => text.includes("+40"))).toBe(true);
    expect(calls).toContain("ellipse");
    expect(calls).toContain("strokeRect");
  });

  it("draws campaign art poses for run and jump", () => {
    const img = { width: 80, height: 120 } as CanvasImageSource & {
      width: number;
      height: number;
    };
    const art = {
      skyline: img,
      clockRing: img,
      coupleIdle: img,
      coupleLeft: img,
      coupleRight: img,
      coupleCatch: img,
      itemGlass: img,
      itemStar: img,
      itemClock: img,
      itemObstacle: img,
    } as unknown as GameArt;
    const { ctx, calls } = fakeCtx();
    drawJumpFrame(ctx, richState(), createEffects(), labels, {
      nowMs: 400,
      moveDir: -1,
      airborne: false,
      art,
    });
    drawJumpFrame(ctx, richState(), createEffects(), labels, {
      nowMs: 400,
      moveDir: 1,
      airborne: true,
      art,
    });
    expect(calls.filter((name) => name === "drawImage").length).toBeGreaterThan(
      3,
    );
  });
});
