import { describe, expect, it } from "vitest";
import { pl } from "../i18n/pl";
import { INITIAL_RANKING, type RankingState } from "./ranking";
import { renderRanking } from "./ranking-view";

const ROWS = [
  { nickname: "BadNick", score: 300 },
  { nickname: "GoodNick", score: 250 },
];

function state(next: Partial<RankingState>): RankingState {
  return { ...INITIAL_RANKING, loaded: true, rows: ROWS, ...next };
}

describe("renderRanking", () => {
  it("shows the place, the nick and the score in the public order", () => {
    const html = renderRanking(state({}));
    expect(html.indexOf("BadNick")).toBeLessThan(html.indexOf("GoodNick"));
    expect(html).toContain("300");
    expect(html).toContain(pl.panelFieldNick);
    expect(html).toContain(pl.panelFieldScore);
  });

  it("has one hide button per row with the nick", () => {
    const html = renderRanking(state({}));
    expect(html.split(pl.panelRankingHide).length - 1).toBe(ROWS.length);
    expect(html).toContain('data-hide-nick="BadNick"');
    expect(html).toContain('data-hide-nick="GoodNick"');
  });

  it("asks for a confirm with hide and cancel buttons", () => {
    const html = renderRanking(state({ confirm: "BadNick" }));
    expect(html).toContain('role="alertdialog"');
    expect(html).toContain(pl.panelRankingConfirm);
    expect(html).toContain(`>${pl.panelRankingConfirmYes}<`);
    expect(html).toContain(`>${pl.panelRankingConfirmNo}<`);
    expect(html).toContain('id="ranking-hide-confirm"');
    expect(html).toContain('id="ranking-hide-cancel"');
  });

  it("shows no confirm when no nick waits", () => {
    expect(renderRanking(state({}))).not.toContain("alertdialog");
  });

  it("says that the nick is hidden and the code still works", () => {
    const notice = { kind: "hidden" as const, nickname: "BadNick" };
    const html = renderRanking(state({ notice, rows: ROWS.slice(1) }));
    expect(html).toContain(pl.panelRankingHidden);
    expect(html).toContain(pl.panelRankingCodeKept);
    expect(html).not.toContain('data-hide-nick="BadNick"');
  });

  it("says when the nick was not found", () => {
    const notice = { kind: "missing" as const, nickname: "NoSuchNick" };
    expect(renderRanking(state({ notice }))).toContain(pl.panelRankingMissing);
  });

  it("shows the load and the hide errors", () => {
    expect(renderRanking(state({ error: "load" }))).toContain(
      pl.panelRankingFailed,
    );
    expect(renderRanking(state({ error: "hide" }))).toContain(
      pl.panelRankingHideFailed,
    );
  });

  it("shows loading, then an empty ranking", () => {
    expect(renderRanking({ ...INITIAL_RANKING, busy: true })).toContain(
      pl.panelRankingLoading,
    );
    expect(renderRanking(INITIAL_RANKING)).not.toContain("<table");
    expect(renderRanking(state({ rows: [] }))).toContain(pl.panelRankingEmpty);
  });

  it("disables the buttons while a call runs", () => {
    const html = renderRanking(state({ busy: true, confirm: "BadNick" }));
    expect(html).not.toMatch(/<button(?![^>]*disabled)[^>]*>/);
  });

  it("escapes the nick in the text and in the button data", () => {
    const rows = [{ nickname: `<b>"x'&`, score: 1 }];
    const html = renderRanking(state({ rows, confirm: `<b>"x'&` }));
    expect(html).not.toContain("<b>");
    expect(html).not.toContain(`"x'`);
    expect(html).toContain("&lt;b&gt;&quot;x&#39;&amp;");
  });
});
