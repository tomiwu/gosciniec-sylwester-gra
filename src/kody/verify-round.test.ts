import { describe, expect, it } from "vitest";
import { packLog, type StepSample } from "../game/input-log";
import { replayRound } from "../game/replay";
import { verifyPackedLog } from "./verify-round";

describe("verifyPackedLog", () => {
  it("confirms a matching seeded replay and rejects a bad log", () => {
    const seed = 7;
    const steps: StepSample[] = Array.from({ length: 40 }, () => ({
      dt: 50,
      dir: 0 as const,
      dragDx: 0,
    }));
    const score = replayRound(seed, steps).state.score;
    const packed = packLog(seed, steps, [{ t: 200, kind: "pd", x: 80 }]);
    const ok = verifyPackedLog(score, packed);
    expect(ok.ok).toBe(true);
    expect(ok.replayedScore).toBe(score);
    expect(verifyPackedLog(score, "not-json").ok).toBe(false);
  });
});
