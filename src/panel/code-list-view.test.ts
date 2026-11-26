import { describe, expect, it } from "vitest";
import { pl } from "../i18n/pl";
import { INITIAL_CODE_LIST, NO_FILTER, type CodeListState } from "./code-list";
import { renderCodeList } from "./code-list-view";
import type { CodeListEntry } from "./staff-api";

const NOW = new Date("2026-12-20T12:00:00.000Z");

const ENTRIES: CodeListEntry[] = [
  {
    code: "SYL-AAA1",
    nickname: "TestPlayer1",
    score: 230,
    kind: "base",
    referrals: 1,
    earnedAt: "2026-11-20T18:30:00.000Z",
    usedAt: null,
  },
  {
    code: "SYL-BBB2",
    nickname: "TestPlayer2",
    score: 250,
    kind: "share",
    referrals: 5,
    earnedAt: "2026-11-25T09:00:00.000Z",
    usedAt: "2026-11-26T10:00:00.000Z",
  },
];

const STATS = { players: 7, codes: 2, shareCodes: 1, redeemed: 1 };

function state(next: Partial<CodeListState>): CodeListState {
  return {
    ...INITIAL_CODE_LIST,
    loaded: true,
    entries: ENTRIES,
    stats: STATS,
    ...next,
  };
}

function tableRows(html: string): string[] {
  return html.match(/<tr data-code="[^"]*"/g) ?? [];
}

function countValue(html: string, label: string): string {
  const re = new RegExp(`<dt>${label}</dt><dd>([^<]*)</dd>`);
  return html.match(re)?.[1] ?? "";
}

describe("renderCodeList", () => {
  it("shows the counts strip with Polish labels", () => {
    const html = renderCodeList(state({}), NOW);
    expect(countValue(html, pl.panelCountPlayers)).toBe("7");
    expect(countValue(html, pl.panelCountIssued)).toBe("2");
    expect(countValue(html, pl.panelCountUsed)).toBe("1");
    expect(countValue(html, pl.panelCountReferrals)).toBe("6");
    expect(pl.panelCountPlayers).toBe("Gracze");
    expect(pl.panelCountIssued).toBe("Kody wydane");
    expect(pl.panelCountUsed).toBe("Kody wykorzystane");
    expect(pl.panelCountReferrals).toBe("Polecenia");
  });

  it("shows a dash in the counts before they load", () => {
    const html = renderCodeList(INITIAL_CODE_LIST, NOW);
    expect(countValue(html, pl.panelCountPlayers)).toBe(pl.panelEmptyValue);
  });

  it("shows the filters with the Polish options", () => {
    const html = renderCodeList(state({}), NOW);
    expect(html).toContain('id="code-list-filter"');
    for (const label of [
      pl.panelFilterAll,
      pl.panelStatusValid,
      pl.panelStatusUsed,
      pl.panelStatusExpired,
      "10% (333 zł)",
      "Bonus (299 zł)",
    ]) {
      expect(html).toContain(`>${label}</option>`);
    }
    expect(html).not.toContain(`>${pl.panelStatusUnknown}</option>`);
    expect(html).toContain('name="from" type="date"');
    expect(html).toContain('name="to" type="date"');
  });

  it("marks the chosen filter values", () => {
    const filter = {
      status: "already_used" as const,
      kind: "share" as const,
      from: "2026-11-21",
      to: "2026-11-30",
    };
    const html = renderCodeList(state({ filter }), NOW);
    expect(html).toContain('<option value="already_used" selected>');
    expect(html).toContain('<option value="share" selected>');
    expect(html).toContain('value="2026-11-21"');
    expect(html).toContain('value="2026-11-30"');
  });

  it("shows code, nick, discount, date earned and status in each row", () => {
    const html = renderCodeList(state({}), NOW);
    for (const head of [
      pl.panelFieldCode,
      pl.panelFieldNick,
      pl.panelFieldDiscount,
      pl.panelFieldEarned,
      pl.panelFieldStatus,
    ]) {
      expect(html).toContain(`<th scope="col">${head}</th>`);
    }
    expect(tableRows(html)).toEqual([
      '<tr data-code="SYL-AAA1"',
      '<tr data-code="SYL-BBB2"',
    ]);
    expect(html).toContain("TestPlayer1");
    expect(html).toContain("10% · 333 zł / os.");
    expect(html).toContain("Bonus za polecenia · 299 zł / os.");
    expect(html).toContain("20.11.2026, 19:30");
    expect(html).toContain(`data-status="valid">${pl.panelStatusValid}`);
    expect(html).toContain(`data-status="already_used">${pl.panelStatusUsed}`);
  });

  it("shows only the codes that match the filter", () => {
    const filter = { ...NO_FILTER, status: "valid" as const };
    const html = renderCodeList(state({ filter }), NOW);
    expect(tableRows(html)).toEqual(['<tr data-code="SYL-AAA1"']);
    expect(html).toContain(`${pl.panelListShown}: 1 / 2`);
  });

  it("shows a message when no code matches the filter", () => {
    const filter = { ...NO_FILTER, status: "expired" as const };
    const html = renderCodeList(state({ filter }), NOW);
    expect(tableRows(html)).toEqual([]);
    expect(html).toContain(pl.panelListNoMatch);
    expect(html).not.toContain("<table");
  });

  it("shows a message when no code is issued yet", () => {
    const empty = { players: 0, codes: 0, shareCodes: 0, redeemed: 0 };
    const html = renderCodeList(state({ entries: [], stats: empty }), NOW);
    expect(html).toContain(pl.panelListEmpty);
    expect(html).not.toContain(pl.panelListNoMatch);
    expect(countValue(html, pl.panelCountReferrals)).toBe("0");
  });

  it("shows loading text before the first list", () => {
    const html = renderCodeList({ ...INITIAL_CODE_LIST, busy: true }, NOW);
    expect(html).toContain(pl.panelListLoading);
    expect(html).not.toContain(pl.panelListEmpty);
  });

  it("shows an error and a refresh button when the load fails", () => {
    const html = renderCodeList(state({ error: true }), NOW);
    expect(html).toContain('role="alert"');
    expect(html).toContain(pl.panelListFailed);
    expect(html).toContain('id="code-list-refresh"');
  });

  it("escapes the nickname and the code", () => {
    const bad: CodeListEntry = {
      ...ENTRIES[0]!,
      code: 'SYL-"<1',
      nickname: "<img src=x>",
    };
    const html = renderCodeList(state({ entries: [bad] }), NOW);
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img src=x&gt;");
    expect(html).toContain('data-code="SYL-&quot;&lt;1"');
  });

  it("shows no device id or other hidden field", () => {
    const leaky = {
      ...ENTRIES[0]!,
      deviceId: "device-test-1",
    } as CodeListEntry;
    const html = renderCodeList(state({ entries: [leaky] }), NOW);
    expect(html).not.toContain("device-test-1");
    expect(html.toLowerCase()).not.toContain("device");
  });
});
