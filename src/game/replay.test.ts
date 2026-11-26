import { describe, expect, it } from "vitest";
import { CLOCK } from "../config";
import { createGame, stepGame } from "./game";
import {
  packLog,
  unpackLog,
  type InputLogEvent,
  type StepSample,
} from "./input-log";
import {
  likenessFlags,
  replayRound,
  scoreFromSummary,
  summaryIsConsistent,
} from "./replay";
import { createRng } from "./rng";

function play(seed: number, steps: StepSample[]) {
  const rand = createRng(seed);
  let state = createGame();
  for (const step of steps) {
    state = stepGame(
      state,
      step.dt,
      { dir: step.dir, dragDx: step.dragDx },
      rand,
    );
  }
  return state;
}

describe("replayRound", () => {
  it("recomputes the same score as a live seeded round", () => {
    const seed = 2026;
    const steps: StepSample[] = [];
    // Stand still for the whole base duration, in 50 ms slices.
    const frames = Math.ceil(CLOCK.maxWallClockMs / 50) + 20;
    for (let i = 0; i < frames; i += 1) {
      steps.push({ dt: 50, dir: 0, dragDx: 0 });
    }
    const live = play(seed, steps);
    const replayed = replayRound(seed, steps);
    expect(replayed.state.score).toBe(live.score);
    expect(replayed.state.status).toBe("ended");
    expect(scoreFromSummary(replayed.summary)).toBe(live.score);
    expect(summaryIsConsistent(replayed.summary, live.score)).toBe(true);
  });

  it("does not match when the seed is different", () => {
    const steps: StepSample[] = Array.from({ length: 200 }, () => ({
      dt: 50,
      dir: 1 as const,
      dragDx: 8,
    }));
    expect(replayRound(1, steps).state.score).not.toBe(
      replayRound(2, steps).state.score,
    );
  });
});

describe("packLog", () => {
  it("round-trips steps and events", () => {
    const steps: StepSample[] = [
      { dt: 16, dir: -1, dragDx: 3.2 },
      { dt: 17, dir: 0, dragDx: 0 },
    ];
    const events: InputLogEvent[] = [
      { t: 40, kind: "pd", x: 120 },
      { t: 80, kind: "pm", x: 140 },
      { t: 100, kind: "pu", x: 150 },
      { t: 200, kind: "kd", key: "L" },
    ];
    const packed = packLog(99, steps, events);
    const unpacked = unpackLog(packed);
    expect(unpacked?.seed).toBe(99);
    expect(unpacked?.steps).toEqual([
      { dt: 16, dir: -1, dragDx: 3 },
      { dt: 17, dir: 0, dragDx: 0 },
    ]);
    expect(unpacked?.events).toEqual([
      { t: 40, kind: "pd", x: 120 },
      { t: 80, kind: "pm", x: 140 },
      { t: 100, kind: "pu", x: 150 },
      { t: 200, kind: "kd", key: "L" },
    ]);
  });
});

describe("likenessFlags", () => {
  it("flags a short, regular, narrow log", () => {
    const events: InputLogEvent[] = [
      { t: 10, kind: "pm", x: 100 },
      { t: 20, kind: "pm", x: 101 },
      { t: 30, kind: "pm", x: 100 },
    ];
    const flags = likenessFlags(events, true);
    expect(flags).toContain("few_events");
    expect(flags).toContain("regular_timing");
    expect(flags).toContain("no_spread");
    expect(flags).toContain("fast_start");
    expect(flags).toContain("log_capped");
  });

  it("does not flag a varied human-like log", () => {
    const events: InputLogEvent[] = [
      { t: 180, kind: "pd", x: 80 },
      { t: 260, kind: "pm", x: 140 },
      { t: 410, kind: "pm", x: 200 },
      { t: 700, kind: "pu", x: 210 },
      { t: 1100, kind: "kd", key: "R" },
      { t: 1500, kind: "ku", key: "R" },
      { t: 2100, kind: "pd", x: 60 },
      { t: 2400, kind: "pm", x: 300 },
      { t: 2800, kind: "pu", x: 310 },
    ];
    expect(likenessFlags(events)).toEqual([]);
  });
});

describe("packLog cap and localSeed", () => {
  it("caps a huge pointer-move log", async () => {
    const { packLog, unpackLog } = await import("./input-log");
    const { localSeed } = await import("./rng");
    const events = Array.from({ length: 4000 }, (_, i) => ({
      t: i * 10,
      kind: "pm" as const,
      x: 100 + (i % 80),
    }));
    const packed = packLog(1, [{ dt: 16, dir: 0, dragDx: 0 }], events, 2000);
    expect(packed.length).toBeLessThanOrEqual(2000);
    expect(unpackLog(packed)?.capped).toBe(true);
    expect(unpackLog("{")).toBeNull();
    expect(typeof localSeed()).toBe("number");
  });
});

it("trims key events under a tight cap and rejects a bad packed shape", async () => {
  const { packLog, unpackLog, encodeEvents, encodeSteps } = await import(
    "./input-log"
  );
  const events = Array.from({ length: 800 }, (_, i) => ({
    t: 100 + i * 20,
    kind: "kd" as const,
    key: "L" as const,
  }));
  const packed = packLog(3, [{ dt: 16, dir: 0, dragDx: 0 }], events, 400);
  expect(packed.length).toBeLessThanOrEqual(400);
  const unpacked = unpackLog(packed);
  expect(unpacked?.capped).toBe(true);
  expect((unpacked?.events.length ?? 0) < 800).toBe(true);
  expect(
    unpackLog(JSON.stringify({ v: 2, seed: 1, steps: "", ev: "" })),
  ).toBeNull();
  expect(
    unpackLog(JSON.stringify({ v: 1, seed: 1, steps: 1, ev: "" })),
  ).toBeNull();
  const capped = JSON.stringify({
    v: 1,
    seed: 1,
    steps: encodeSteps([]),
    ev: encodeEvents([]),
    capped: true,
  });
  expect(unpackLog(capped)?.capped).toBe(true);
});
