import { plPanel } from "../i18n/pl";
import { logoutUrl } from "./config";

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch] ?? ch);
}

function page(status: number, heading: string, lines: string[]): Response {
  const body = lines.map((line) => `<p>${line}</p>`).join("\n    ");
  const html = `<!doctype html>
<html lang="pl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>${escapeHtml(plPanel.title)}</title>
  </head>
  <body>
    <h1>${escapeHtml(heading)}</h1>
    ${body}
  </body>
</html>
`;
  return new Response(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function logoutLink(returnTo: string): string {
  return `<a href="${escapeHtml(logoutUrl(returnTo))}">${escapeHtml(plPanel.logout)}</a>`;
}

/** Staff panel shell. The check, list and ranking UI (issues #13 to #15) call `/api/staff/*`. */
export function panelPage(username: string): Response {
  return page(200, plPanel.title, [
    `${escapeHtml(plPanel.signedInAs)} <strong>${escapeHtml(username)}</strong>`,
    logoutLink("/"),
  ]);
}

/** A signed-in Kody user who is not on the staff allow list. */
export function forbiddenPage(username: string): Response {
  return page(403, plPanel.forbidden, [
    `${escapeHtml(plPanel.signedInAs)} <strong>${escapeHtml(username)}</strong>`,
    logoutLink("/panel/"),
  ]);
}
