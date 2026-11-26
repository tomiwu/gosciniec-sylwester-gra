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

  it("shows the code check view in the check section", () => {
    const shell = {
      session: staff,
      allowList: allow,
      section: "check" as const,
    };
    const html = renderPanel(shell, '<form id="code-check-form"></form>');
    expect(html).toContain('<form id="code-check-form"></form>');
    expect(html).not.toContain(pl.panelSoon);
  });

  it("keeps the placeholder in the other sections", () => {
    const html = renderPanel(
      { session: staff, allowList: allow, section: "ranking" },
      '<form id="code-check-form"></form>',
    );
    expect(html).toContain(pl.panelSoon);
    expect(html).not.toContain("code-check-form");
  });

  it("shows the code list view in the list section", () => {
    const shell = {
      session: staff,
      allowList: allow,
      section: "list" as const,
    };
    const html = renderPanel(
      shell,
      '<form id="code-check-form"></form>',
      '<div class="code-list-view"></div>',
    );
    expect(html).toContain('<div class="code-list-view"></div>');
    expect(html).not.toContain("code-check-form");
    expect(html).not.toContain(pl.panelSoon);
  });

  it("shows the ranking view in the ranking section", () => {
    const shell = {
      session: staff,
      allowList: allow,
      section: "ranking" as const,
    };
    const html = renderPanel(
      shell,
      "",
      '<div class="code-list-view"></div>',
      '<div class="ranking-view"></div>',
    );
    expect(html).toContain('<div class="ranking-view"></div>');
    expect(html).not.toContain("code-list-view");
    expect(html).not.toContain(pl.panelSoon);
  });

  it("never shows the ranking view without a staff session", () => {
    const view = '<div class="ranking-view"></div>';
    const login = {
      session: null,
      allowList: allow,
      section: "ranking" as const,
    };
    expect(renderPanel(login, "", "", view)).not.toContain("ranking-view");
    const denied = { ...login, session: guest };
    expect(renderPanel(denied, "", "", view)).not.toContain("ranking-view");
  });

  it("never shows the code list view without a staff session", () => {
    const view = '<div class="code-list-view"></div>';
    const login = { session: null, allowList: allow, section: "list" as const };
    expect(renderPanel(login, "", view)).not.toContain("code-list-view");
    const denied = { ...login, session: guest };
    expect(renderPanel(denied, "", view)).not.toContain("code-list-view");
  });

  it("never shows the code check view without a staff session", () => {
    const view = '<form id="code-check-form"></form>';
    const login = {
      session: null,
      allowList: allow,
      section: "check" as const,
    };
    expect(renderPanel(login, view)).not.toContain("code-check-form");
    const denied = { ...login, session: guest };
    expect(renderPanel(denied, view)).not.toContain("code-check-form");
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

describe("escapeHtml", () => {
  it("keeps plain text", () => {
    expect(escapeHtml("tomiwu")).toBe("tomiwu");
  });
});
