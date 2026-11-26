import { describe, expect, it } from "vitest";
import { ANTI_CHEAT } from "../config";
import { createMockBackend } from "./mock";

const summary = { glass: 0, star: 0, clock: 0, hits: 0 };

describe("mock start_round and issue_round_score", () => {
  it("accepts a consistent delayed submit and lists the round", async () => {
    let now = new Date("2026-11-26T12:00:00Z");
    const api = createMockBackend({ now: () => now });
    const started = await api.startRound("dev-1");
    expect(started?.token).toBeTruthy();
    now = new Date(now.getTime() + ANTI_CHEAT.minWallMs + 1000);
    const result = await api.submit({
      nickname: "Ada",
      score: 0,
      deviceId: "dev-1",
      roundId: started!.id,
      token: started!.token,
      seed: started!.seed,
      summary,
      inputLog: '{"v":1,"seed":1,"steps":"50,0,0","ev":""}',
      wallMs: ANTI_CHEAT.minWallMs + 1000,
    });
    expect(result.accepted).toBe(true);
    const rounds = await api.listTopRounds(5);
    expect(rounds[0]?.nickname).toBe("Ada");
    const log = await api.getRoundLog(started!.id);
    expect(log?.seed).toBe(started!.seed);
    expect(await api.confirmReplay(started!.id, true, [])).toBe(true);
  });

  it("rejects a short or inconsistent round", async () => {
    const now = new Date("2026-11-26T12:00:00Z");
    const api = createMockBackend({ now: () => now });
    const started = await api.startRound("dev-1");
    const short = await api.submit({
      nickname: "Ada",
      score: 0,
      deviceId: "dev-1",
      roundId: started!.id,
      token: started!.token,
      summary,
      inputLog: "{}",
      wallMs: 100,
    });
    expect(short.reason).toBe("too_short");
    expect(await api.startRound("")).toBeNull();
  });
});

describe("mock round reject paths", () => {
  it("rejects a used, expired, bad-token, inconsistent, or log-less score", async () => {
    let now = new Date("2026-11-26T12:00:00Z");
    const api = createMockBackend({ now: () => now });
    const started = await api.startRound("dev-1");
    now = new Date(now.getTime() + ANTI_CHEAT.minWallMs + 1000);
    const first = await api.submit({
      nickname: "Ada",
      score: 0,
      deviceId: "dev-1",
      roundId: started!.id,
      token: started!.token,
      summary,
      inputLog: "{}",
      wallMs: ANTI_CHEAT.minWallMs + 1000,
    });
    expect(first.accepted).toBe(true);
    const used = await api.submit({
      nickname: "Ada",
      score: 0,
      deviceId: "dev-1",
      roundId: started!.id,
      token: started!.token,
      summary,
      inputLog: "{}",
    });
    expect(used.reason).toBe("used");

    const other = await api.startRound("dev-2");
    const bad = await api.submit({
      nickname: "Ewa",
      score: 0,
      deviceId: "dev-2",
      roundId: other!.id,
      token: "nope",
      summary,
      inputLog: "{}",
    });
    expect(bad.reason).toBe("round");

    now = new Date(now.getTime() + ANTI_CHEAT.maxAgeMs + 1000);
    const late = await api.startRound("dev-3");
    // start at the new 'now', then jump past max age
    now = new Date(now.getTime() + ANTI_CHEAT.maxAgeMs + 1);
    const expired = await api.submit({
      nickname: "Jan",
      score: 0,
      deviceId: "dev-3",
      roundId: late!.id,
      token: late!.token,
      summary,
      inputLog: "{}",
    });
    expect(expired.reason).toBe("expired");

    const fresh = await api.startRound("dev-4");
    now = new Date(now.getTime() + ANTI_CHEAT.minWallMs + 1000);
    const badSummary = await api.submit({
      nickname: "Ola",
      score: 100,
      deviceId: "dev-4",
      roundId: fresh!.id,
      token: fresh!.token,
      summary,
      inputLog: "{}",
    });
    expect(badSummary.reason).toBe("summary");

    const noLogStart = await api.startRound("dev-5");
    now = new Date(now.getTime() + ANTI_CHEAT.minWallMs + 1000);
    const noLog = await api.submit({
      nickname: "Piotr",
      score: 10,
      deviceId: "dev-5",
      roundId: noLogStart!.id,
      token: noLogStart!.token,
      summary: { glass: 1, star: 0, clock: 0, hits: 0 },
    });
    expect(noLog.reason).toBe("log");
  });
});
