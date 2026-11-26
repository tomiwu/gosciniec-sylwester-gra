import type { LeaderboardRow, RankingApi } from "./staff-api";

/** `load` = the ranking call failed. `hide` = the hide call failed. */
export type RankingError = "load" | "hide";

/** `hidden` = the nick is hidden. `missing` = no score has this nick. */
export type RankingNotice = {
  kind: "hidden" | "missing";
  nickname: string;
};

export type RankingState = {
  busy: boolean;
  /** True after the first ranking arrived. */
  loaded: boolean;
  rows: LeaderboardRow[];
  /** The nick that waits for the staff confirm, or null. */
  confirm: string | null;
  /** The result of the last hide. */
  notice: RankingNotice | null;
  error: RankingError | null;
};

export const INITIAL_RANKING: RankingState = {
  busy: false,
  loaded: false,
  rows: [],
  confirm: null,
  notice: null,
  error: null,
};

/**
 * Ranking view-model with no DOM. Each change calls render().
 * It talks only to the staff API client. A hide needs a confirm first.
 */
export function createRanking(options: {
  api: RankingApi;
  render: (state: RankingState) => void;
}) {
  const { api, render } = options;
  let state: RankingState = INITIAL_RANKING;
  /** A call that ends after a newer call or a reset must not change the state. */
  let generation = 0;

  function show(next: Partial<RankingState>): void {
    state = { ...state, ...next };
    render(state);
  }

  async function fetchRows(): Promise<Partial<RankingState>> {
    try {
      const rows = await api.leaderboard();
      return { busy: false, loaded: true, rows, error: null };
    } catch {
      return { busy: false, error: "load" };
    }
  }

  async function hideThenFetch(
    nickname: string,
  ): Promise<Partial<RankingState>> {
    let found: boolean;
    try {
      found = await api.hideNickname(nickname);
    } catch {
      return { busy: false, error: "hide" };
    }
    const kind = found ? "hidden" : "missing";
    return { ...(await fetchRows()), notice: { kind, nickname } };
  }

  async function run(
    start: Partial<RankingState>,
    call: () => Promise<Partial<RankingState>>,
  ): Promise<void> {
    generation += 1;
    const mine = generation;
    show({ ...start, busy: true });
    const next = await call();
    if (mine === generation) show(next);
  }

  return {
    load: () => run({}, fetchRows),
    askHide(nickname: string): void {
      show({ confirm: nickname });
    },
    cancelHide(): void {
      show({ confirm: null });
    },
    async confirmHide(): Promise<void> {
      const nickname = state.confirm;
      if (nickname === null || state.busy) return;
      const start = { confirm: null, notice: null, error: null };
      await run(start, () => hideThenFetch(nickname));
    },
    reset(): void {
      generation += 1;
      show(INITIAL_RANKING);
    },
  };
}
