import { describe, expect, it } from "vitest";
import { escapeHtml, forbiddenPage, panelPage } from "./panel-page";

describe("escapeHtml", () => {
  it("escapes the HTML special characters", () => {
    expect(escapeHtml(`<a href="x">&'</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;",
    );
  });
});

describe("panelPage", () => {
  it("greets the staff user and links the Kody logout route", async () => {
    const res = panelPage("<staff>");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(res.headers.get("cache-control")).toBe("no-store");
    const html = await res.text();
    expect(html).toContain("&lt;staff&gt;");
    expect(html).not.toContain("<staff>");
    expect(html).toContain('href="/-/auth/logout?returnTo=%2F"');
    expect(html).toContain('lang="pl"');
  });
});

describe("forbiddenPage", () => {
  it("answers 403 with a logout link so another user can sign in", async () => {
    const res = forbiddenPage("guest");
    expect(res.status).toBe(403);
    const html = await res.text();
    expect(html).toContain("guest");
    expect(html).toContain("/-/auth/logout?returnTo=");
  });
});
