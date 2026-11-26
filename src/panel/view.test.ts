import { describe, expect, it } from "vitest";
import { pl } from "../i18n/pl";
import { escapeHtml, renderPanel } from "./view";

const staff = { userId: "kody-user-1", username: "staff-test" };
const guest = { userId: "kody-user-2", username: "guest-test" };
const allow = ["staff-test"];

describe("renderPanel", () => {
  it("shows only the Kody sign-in on the login screen", () => {
    const html = renderPanel({
      session: null,
      allowList: allow,
      section: "check",
    });
    expect(html).toContain(pl.panelTitle);
    expect(html).toContain(pl.panelSignIn);
    expect(html).toContain('id="login"');
    expect(html).not.toContain("<input");
    expect(html).not.toContain('type="password"');
    expect(html).not.toContain(pl.panelSignOut);
    expect(html).not.toContain(pl.panelNavCheck);
  });

  it("shows no access and logout, but no navigation, to a user who is not staff", () => {
    const html = renderPanel({
      session: guest,
      allowList: allow,
      section: "check",
    });
    expect(html).toContain(pl.panelNoAccess);
    expect(html).toContain('id="logout"');
    expect(html).not.toContain(pl.panelNavCheck);
    expect(html).not.toContain(pl.panelNavList);
    expect(html).not.toContain(pl.panelNavRanking);
    expect(html).not.toContain('data-screen="shell"');
  });

  it("shows the header, the navigation and logout to staff", () => {
    const html = renderPanel({
      session: staff,
      allowList: allow,
      section: "list",
    });
    expect(html).toContain('data-screen="shell"');
    expect(html).toContain(pl.panelTitle);
    expect(html).toContain(pl.panelNavCheck);
    expect(html).toContain(pl.panelNavList);
    expect(html).toContain(pl.panelNavRanking);
    expect(html).toContain(pl.panelSignOut);
    expect(html).toContain("staff-test");
    expect(html).toContain('data-section="list" aria-current="page"');
    expect(html).not.toContain(pl.panelSignIn);
  });

  it("escapes the username", () => {
    const html = renderPanel({
      session: { userId: "x", username: "<b>&\"'" },
      allowList: ["<b>&\"'"],
      section: "check",
    });
    expect(html).not.toContain("<b>&");
    expect(html).toContain("&lt;b&gt;&amp;&quot;&#39;");
  });
});

it("shows a code check and the redeem button for a valid code", () => {
  const html = renderPanel({
    session: staff,
    allowList: allow,
    section: "check",
    check: {
      code: "SYL-SBAA",
      status: "valid",
      nickname: "TEST-NOCNY",
      kind: "base",
      discountPercent: 10,
      pricePerPerson: 333,
      earnedAt: "2026-11-25T21:00:00Z",
      usedAt: null,
    },
  });
  expect(html).toContain("SYL-SBAA");
  expect(html).toContain("TEST-NOCNY");
  expect(html).toContain(pl.panelStatusValid);
  expect(html).toContain(pl.panelRedeem);
  expect(html).toContain(pl.panelDiscountBase);
  expect(html).not.toContain('type="password"');
});

it("shows the code list and the ranking", () => {
  const list = renderPanel({
    session: staff,
    allowList: allow,
    section: "list",
    listKind: "base",
    listUsed: "open",
    stats: { players: 1, codes: 1, shareCodes: 0, redeemed: 0 },
    list: [
      {
        code: "SYL-SBAA",
        nickname: "TEST-NOCNY",
        score: 200,
        kind: "base",
        referrals: 0,
        earnedAt: "2026-11-25T21:00:00Z",
        usedAt: null,
      },
    ],
  });
  expect(list).toContain("SYL-SBAA");
  expect(list).toContain(pl.panelCodesIssued);
  expect(list).toContain('id="filter-kind"');
  const empty = renderPanel({
    session: staff,
    allowList: allow,
    section: "list",
  });
  expect(empty).toContain(pl.panelEmptyList);
  const ranking = renderPanel({
    session: staff,
    allowList: allow,
    section: "ranking",
    ranking: [{ nickname: "TEST-NOCNY", score: 200 }],
    hidePending: "TEST-NOCNY",
  });
  expect(ranking).toContain("TEST-NOCNY");
  expect(ranking).toContain(pl.panelHideConfirm);
  expect(ranking).toContain('id="hide-ok"');
  const emptyRank = renderPanel({
    session: staff,
    allowList: allow,
    section: "ranking",
  });
  expect(emptyRank).toContain(pl.panelEmptyRanking);
  const withRounds = renderPanel({
    session: staff,
    allowList: allow,
    section: "ranking",
    rounds: [
      {
        id: "r1",
        nickname: "Ada",
        score: 200,
        wallMs: 25000,
        startedAt: "2026-11-26T00:00:00Z",
        flags: ["few_events"],
        replayOk: true,
        summary: { glass: 1, star: 0, clock: 0, hits: 0 },
      },
      {
        id: "r2",
        nickname: "Ewa",
        score: 0,
        wallMs: 20000,
        startedAt: "2026-11-26T00:00:00Z",
        flags: [],
        replayOk: false,
        summary: { glass: 0, star: 0, clock: 0, hits: 0 },
      },
      {
        id: "r3",
        nickname: "Jan",
        score: 10,
        wallMs: 21000,
        startedAt: "2026-11-26T00:00:00Z",
        flags: [],
        replayOk: null,
        summary: { glass: 1, star: 0, clock: 0, hits: 0 },
      },
    ],
  });
  expect(withRounds).toContain(pl.panelVerify);
  expect(withRounds).toContain(pl.panelReplayOk);
  expect(withRounds).toContain(pl.panelReplayBad);
  expect(withRounds).toContain(pl.panelReplayPending);
  expect(withRounds).toContain("few_events");
  expect(withRounds).toContain('data-verify="r1"');
});

describe("escapeHtml", () => {
  it("keeps plain text", () => {
    expect(escapeHtml("tomiwu")).toBe("tomiwu");
  });
});
