import { describe, expect, it } from "vitest";
import { pl } from "../i18n/pl";
import { INITIAL_CODE_CHECK, type CodeCheckState } from "./code-check";
import { renderCodeCheck } from "./code-check-view";
import type { CodeCheck } from "./staff-api";

const VALID: CodeCheck = {
  code: "SYL-AB2C",
  status: "valid",
  nickname: "TestPlayer1",
  kind: "share",
  earnedAt: "2026-11-20T18:30:00.000Z",
  usedAt: null,
};

function state(next: Partial<CodeCheckState>): CodeCheckState {
  return { ...INITIAL_CODE_CHECK, ...next };
}

function redeemButton(html: string): string {
  return html.match(/<button[^>]*id="redeem"[^>]*>/)?.[0] ?? "";
}

describe("renderCodeCheck", () => {
  it("shows the code form and no result at first", () => {
    const html = renderCodeCheck(INITIAL_CODE_CHECK);
    expect(html).toContain('id="code-check-form"');
    expect(html).toContain('name="code"');
    expect(html).toContain('placeholder="SYL-XXXX"');
    expect(html).toContain(pl.panelCheckSubmit);
    expect(html).not.toContain('id="redeem"');
    expect(html).not.toContain('role="alert"');
  });

  it("shows nickname, discount, date and status for a valid code", () => {
    const html = renderCodeCheck(state({ code: "SYL-AB2C", check: VALID }));
    expect(html).toContain('value="SYL-AB2C"');
    expect(html).toContain(pl.panelFieldNick);
    expect(html).toContain("TestPlayer1");
    expect(html).toContain(pl.panelFieldDiscount);
    expect(html).toContain("Bonus za polecenia · 299 zł / os.");
    expect(html).toContain(pl.panelFieldEarned);
    expect(html).toContain("20.11.2026, 19:30");
    expect(html).toContain('data-status="valid"');
    expect(html).toContain(pl.panelStatusValid);
    expect(html).toContain(pl.panelRedeem);
    expect(redeemButton(html)).not.toContain("disabled");
  });

  it("disables the redeem button for a used, unknown or expired code", () => {
    for (const status of ["already_used", "unknown", "expired"] as const) {
      const html = renderCodeCheck(state({ check: { ...VALID, status } }));
      expect(redeemButton(html)).toContain("disabled");
    }
  });

  it("disables both buttons while a call runs", () => {
    const html = renderCodeCheck(state({ check: VALID, busy: true }));
    expect(redeemButton(html)).toContain("disabled");
    expect(html).toMatch(/<button type="submit"[^>]*disabled/);
  });

  it("confirms a redeem with the used status", () => {
    const html = renderCodeCheck(
      state({ check: { ...VALID, status: "already_used" }, redeemed: true }),
    );
    expect(html).toContain(pl.panelStatusUsed);
    expect(html).toContain(pl.panelRedeemDone);
  });

  it("shows a dash for the fields of an unknown code", () => {
    const html = renderCodeCheck(
      state({
        check: {
          ...VALID,
          status: "unknown",
          nickname: null,
          kind: null,
          earnedAt: null,
        },
      }),
    );
    expect(html).toContain(pl.panelStatusUnknown);
    expect(html.split(pl.panelEmptyValue).length - 1).toBe(3);
  });

  it("shows calm error text", () => {
    expect(renderCodeCheck(state({ error: "empty" }))).toContain(
      pl.panelCheckEmpty,
    );
    expect(renderCodeCheck(state({ error: "check" }))).toContain(
      pl.panelCheckFailed,
    );
    expect(renderCodeCheck(state({ error: "redeem" }))).toContain(
      pl.panelRedeemFailed,
    );
  });

  it("escapes the nickname and the typed code", () => {
    const html = renderCodeCheck(
      state({
        code: '"><b>',
        check: { ...VALID, nickname: "<img src=x>" },
      }),
    );
    expect(html).not.toContain("<img");
    expect(html).not.toContain('"><b>');
    expect(html).toContain("&lt;img src=x&gt;");
  });
});
