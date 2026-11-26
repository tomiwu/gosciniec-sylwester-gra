import { describe, expect, it } from "vitest";
import { toCatchSummary, toRoundRow, toRoundStart } from "./rounds";

describe("round mappers", () => {
  it("reads a start_round payload and rejects an error payload", () => {
    expect(toRoundStart({ round_id: "r1", token: "ABCD", seed: 9 })).toEqual({
      id: "r1",
      token: "ABCD",
      seed: 9,
    });
    expect(toRoundStart({ error: "limit" })).toBeNull();
    expect(toRoundStart(null)).toBeNull();
  });

  it("reads a staff round row with flags and a missing replay result", () => {
    const row = toRoundRow({
      id: "r1",
      nickname: "Ada",
      score: 200,
      wall_ms: 25000,
      started_at: "2026-11-26T00:00:00Z",
      flags: ["few_events"],
      replay_ok: null,
      summary: { glass: 2, star: 0, clock: 1, hits: 0 },
    });
    expect(row.wallMs).toBe(25000);
    expect(row.flags).toEqual(["few_events"]);
    expect(row.replayOk).toBeNull();
    expect(toCatchSummary(row.summary)).toEqual({
      glass: 2,
      star: 0,
      clock: 1,
      hits: 0,
    });
  });
});

it("reads camelCase aliases and empty payloads", () => {
  const row = toRoundRow({
    id: "r2",
    nickname: "Ewa",
    score: 1,
    wallMs: 21000,
    startedAt: "t",
    replayOk: false,
  });
  expect(row.wallMs).toBe(21000);
  expect(row.replayOk).toBe(false);
  expect(row.flags).toEqual([]);
  expect(toRoundStart({ round_id: "", token: "T", seed: 1 })).toBeNull();
});
