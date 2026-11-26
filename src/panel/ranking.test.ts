import { describe, expect, it } from "vitest";
import { createMockPromo, type MockCode } from "./mock-staff-api";
import { INITIAL_RANKING, createRanking, type RankingState } from "./ranking";
import type { LeaderboardRow, RankingApi } from "./staff-api";

const NOW = new Date("2026-12-20T12:00:00.000Z");

function code(next: Partial<MockCode>): MockCode {
  return {
    code: "SYL-TEST",
    nickname: "TestPlayer",
    score: 210,
    kind: "base",
    referrals: 0,
    earnedAt: "2026-11-20T12:00:00.000Z",
    usedAt: null,
    ...next,
  };
}

/** Invented codes. `BadNick` is the nickname that staff hide. */
const CODES: MockCode[] = [
  code({ code: "SYL-BAD1", nickname: "BadNick", score: 300 }),
  code({ code: "SYL-GUD2", nickname: "GoodNick", score: 250 }),
];

function setup(api?: RankingApi) {
  const promo = createMockPromo({ codes: CODES, now: () => NOW });
  const states: RankingState[] = [];
  const ranking = createRanking({
    api: api ?? promo.staff,
    render: (state) => states.push(state),
  });
  const last = () => states[states.length - 1] ?? INITIAL_RANKING;
  return { ranking, states, last, promo };
}

function nicks(rows: readonly LeaderboardRow[]): string[] {
  return rows.map((r) => r.nickname);
}

/** A staff API where each call can be set to fail. */
function flaky(rows: LeaderboardRow[]) {
  const fail = { list: false, hide: false };
  const api: RankingApi = {
    leaderboard: () =>
      fail.list ? Promise.reject(new Error("down")) : Promise.resolve(rows),
    hideNickname: () =>
      fail.hide ? Promise.reject(new Error("down")) : Promise.resolve(true),
  };
  return { api, fail };
}

describe("createRanking", () => {
  it("loads the ranking from the staff API", async () => {
    const { ranking, states, last } = setup();
    await ranking.load();
    expect(states[0]?.busy).toBe(true);
    expect(last()).toMatchObject({ busy: false, loaded: true, error: null });
    expect(nicks(last().rows)).toEqual(["BadNick", "GoodNick"]);
  });

  it("asks before it hides, and cancel keeps the nick", async () => {
    const { ranking, last, promo } = setup();
    await ranking.load();
    ranking.askHide("BadNick");
    expect(last().confirm).toBe("BadNick");
    ranking.cancelHide();
    expect(last().confirm).toBeNull();
    expect(nicks(await promo.board.top(20))).toContain("BadNick");
  });

  it("hides the nick after the confirm and reloads the list", async () => {
    const { ranking, last, promo } = setup();
    await ranking.load();
    ranking.askHide("BadNick");
    await ranking.confirmHide();
    expect(last()).toMatchObject({ busy: false, confirm: null, error: null });
    expect(last().notice).toEqual({ kind: "hidden", nickname: "BadNick" });
    expect(nicks(last().rows)).toEqual(["GoodNick"]);
    expect(nicks(await promo.board.top(20))).toEqual(["GoodNick"]);
    expect((await promo.staff.checkCode("SYL-BAD1")).status).toBe("valid");
  });

  it("is safe when staff hide the same nick twice", async () => {
    const { ranking, last } = setup();
    ranking.askHide("BadNick");
    await ranking.confirmHide();
    ranking.askHide("BadNick");
    await ranking.confirmHide();
    expect(last().error).toBeNull();
    expect(nicks(last().rows)).toEqual(["GoodNick"]);
  });

  it("says when the server found no such nick", async () => {
    const { ranking, last } = setup();
    ranking.askHide("NoSuchNick");
    await ranking.confirmHide();
    expect(last().notice).toEqual({ kind: "missing", nickname: "NoSuchNick" });
    expect(nicks(last().rows)).toEqual(["BadNick", "GoodNick"]);
  });

  it("does nothing on confirm with no nick to hide", async () => {
    const { ranking, states } = setup();
    await ranking.confirmHide();
    expect(states).toEqual([]);
  });

  it("does not hide a second nick while a call runs", async () => {
    let calls = 0;
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const api: RankingApi = {
      leaderboard: () => Promise.resolve([]),
      hideNickname: () => {
        calls += 1;
        return gate.then(() => true);
      },
    };
    const { ranking } = setup(api);
    ranking.askHide("BadNick");
    const first = ranking.confirmHide();
    ranking.askHide("GoodNick");
    await ranking.confirmHide();
    release();
    await first;
    expect(calls).toBe(1);
  });

  it("shows a hide error and keeps the list when the hide fails", async () => {
    const rows = [{ nickname: "BadNick", score: 300 }];
    const { api, fail } = flaky(rows);
    const { ranking, last } = setup(api);
    await ranking.load();
    fail.hide = true;
    ranking.askHide("BadNick");
    await ranking.confirmHide();
    expect(last()).toMatchObject({ busy: false, error: "hide", notice: null });
    expect(last().rows).toEqual(rows);
  });

  it("shows a load error and keeps the last list when a load fails", async () => {
    const rows = [{ nickname: "GoodNick", score: 250 }];
    const { api, fail } = flaky(rows);
    const { ranking, last } = setup(api);
    await ranking.load();
    fail.list = true;
    await ranking.load();
    expect(last()).toMatchObject({ busy: false, error: "load" });
    expect(last().rows).toEqual(rows);
    fail.list = false;
    await ranking.load();
    expect(last().error).toBeNull();
  });

  it("ignores a load that ends after a reset", async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const api: RankingApi = {
      leaderboard: () => gate.then(() => [{ nickname: "GoodNick", score: 1 }]),
      hideNickname: () => Promise.resolve(true),
    };
    const { ranking, last } = setup(api);
    const loading = ranking.load();
    ranking.reset();
    release();
    await loading;
    expect(last()).toEqual(INITIAL_RANKING);
  });
});
