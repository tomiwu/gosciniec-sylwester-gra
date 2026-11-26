import { pl } from "../i18n/pl";
import { isStaff, type KodySession } from "./auth";
import {
  PANEL_SECTIONS,
  type PanelSection,
  type PanelState,
} from "./controller";

const SECTION_LABELS: Record<PanelSection, string> = {
  check: pl.panelNavCheck,
  list: pl.panelNavList,
  ranking: pl.panelNavRanking,
};

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char);
}

function header(): string {
  return `<h1 class="title">${pl.panelTitle}</h1><p class="subtitle">${pl.hotel}</p>`;
}

function signedInAs(session: KodySession): string {
  return `<p class="note">${pl.panelSignedInAs}: <strong>${escapeHtml(session.username)}</strong></p>`;
}

function logoutButton(): string {
  return `<button type="button" class="btn secondary" id="logout">${pl.panelSignOut}</button>`;
}

function loginView(): string {
  return `<section class="panel" data-screen="login">
    ${header()}
    <p class="how">${pl.panelLoginHint}</p>
    <div class="actions">
      <button type="button" class="btn" id="login">${pl.panelSignIn}</button>
    </div>
  </section>`;
}

function deniedView(session: KodySession): string {
  return `<section class="panel" data-screen="denied">
    ${header()}
    <h2 class="lock">${pl.panelNoAccess}</h2>
    <p class="how">${pl.panelNoAccessHint}</p>
    ${signedInAs(session)}
    <div class="actions">${logoutButton()}</div>
  </section>`;
}

function navButton(section: PanelSection, current: PanelSection): string {
  const mark = section === current ? ' aria-current="page"' : "";
  return `<button type="button" class="btn secondary nav-item" data-section="${section}"${mark}>${SECTION_LABELS[section]}</button>`;
}

type SectionViews = Partial<Record<PanelSection, string>>;

function sectionBody(state: PanelState, views: SectionViews): string {
  return views[state.section] || `<p class="note">${pl.panelSoon}</p>`;
}

function shellView(
  state: PanelState,
  session: KodySession,
  views: SectionViews,
): string {
  const nav = PANEL_SECTIONS.map((s) => navButton(s, state.section)).join("");
  return `<section class="panel staff" data-screen="shell">
    <header class="staff-header">
      ${header()}
      ${signedInAs(session)}
      ${logoutButton()}
    </header>
    <nav class="actions staff-nav" aria-label="${pl.panelTitle}">${nav}</nav>
    <main class="staff-main" data-section="${state.section}">
      <h2 class="subtitle">${SECTION_LABELS[state.section]}</h2>
      ${sectionBody(state, views)}
    </main>
  </section>`;
}

/**
 * HTML for the panel. Only an allow-listed Kody session gets the staff shell.
 * `checkView` is the code-check HTML for the check section, `listView`
 * is the code-list HTML for the list section and `rankingView` is the
 * ranking HTML for the ranking section.
 */
export function renderPanel(
  state: PanelState,
  checkView = "",
  listView = "",
  rankingView = "",
): string {
  const { session } = state;
  if (!session) return loginView();
  if (!isStaff(session, state.allowList)) return deniedView(session);
  const views = { check: checkView, list: listView, ranking: rankingView };
  return shellView(state, session, views);
}
