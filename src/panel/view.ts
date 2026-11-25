import { pl } from "../i18n/pl";
import type { CodeCheck, CodeStatus, DiscountKind } from "../backend/types";
import { isStaff, type KodySession } from "./auth";
import {
  PANEL_SECTIONS,
  visibleCodes,
  type PanelSection,
  type PanelState,
} from "./controller";

const SECTION_LABELS: Record<PanelSection, string> = {
  check: pl.panelNavCheck,
  list: pl.panelNavList,
  ranking: pl.panelNavRanking,
};

const STATUS_LABELS: Record<CodeStatus, string> = {
  valid: pl.panelStatusValid,
  already_used: pl.panelStatusUsed,
  unknown: pl.panelStatusUnknown,
  expired: pl.panelStatusExpired,
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

export function formatDiscount(kind: DiscountKind | null): string {
  if (kind === "share") return pl.panelDiscountShare;
  if (kind === "base") return pl.panelDiscountBase;
  return "—";
}

function formatWhen(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return escapeHtml(value);
  return escapeHtml(
    date.toLocaleString("pl-PL", { dateStyle: "short", timeStyle: "short" }),
  );
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

function errorNote(state: PanelState): string {
  if (!state.checkError) return "";
  return `<p class="note staff-error" role="alert">${escapeHtml(state.checkError)}</p>`;
}

function checkResult(check: CodeCheck): string {
  const canRedeem = check.status === "valid";
  return `<dl class="staff-result" data-status="${check.status}">
    <div><dt>${pl.panelCodeLabel}</dt><dd>${escapeHtml(check.code)}</dd></div>
    <div><dt>${pl.panelStatus}</dt><dd>${STATUS_LABELS[check.status]}</dd></div>
    <div><dt>${pl.panelNick}</dt><dd>${escapeHtml(check.nickname ?? "—")}</dd></div>
    <div><dt>${pl.panelDiscount}</dt><dd>${formatDiscount(check.kind)}</dd></div>
    <div><dt>${pl.panelEarnedAt}</dt><dd>${formatWhen(check.earnedAt)}</dd></div>
  </dl>
  ${
    canRedeem
      ? `<div class="actions"><button type="button" class="btn" id="redeem">${pl.panelRedeem}</button></div>`
      : ""
  }`;
}

function checkView(state: PanelState): string {
  const query = escapeHtml(state.checkQuery ?? "");
  return `<form class="staff-form" id="check-form">
    <label class="staff-label" for="code-input">${pl.panelCodeLabel}</label>
    <input class="staff-input" id="code-input" name="code" type="text" maxlength="16" autocomplete="off" placeholder="${pl.panelCodePlaceholder}" value="${query}" />
    <div class="actions">
      <button type="submit" class="btn" id="check"${state.busy ? " disabled" : ""}>${pl.panelCheckAction}</button>
    </div>
  </form>
  ${state.check ? checkResult(state.check) : ""}
  ${errorNote(state)}`;
}

function listView(state: PanelState): string {
  const stats = state.stats;
  const statsHtml = stats
    ? `<ul class="staff-stats">
        <li>${pl.panelPlayers}: <strong>${stats.players}</strong></li>
        <li>${pl.panelCodesIssued}: <strong>${stats.codes}</strong></li>
        <li>${pl.panelCodesUsed}: <strong>${stats.redeemed}</strong></li>
      </ul>`
    : "";
  const rows = visibleCodes(state);
  const table =
    rows.length === 0
      ? `<p class="note">${pl.panelEmptyList}</p>`
      : `<table class="staff-table">
        <thead><tr>
          <th>${pl.panelCodeLabel}</th>
          <th>${pl.panelNick}</th>
          <th>${pl.panelDiscount}</th>
          <th>${pl.panelStatus}</th>
          <th>${pl.panelEarnedAt}</th>
        </tr></thead>
        <tbody>${rows
          .map(
            (row) => `<tr>
            <td>${escapeHtml(row.code)}</td>
            <td>${escapeHtml(row.nickname)}</td>
            <td>${formatDiscount(row.kind)}</td>
            <td>${row.usedAt ? pl.panelStatusUsed : pl.panelStatusValid}</td>
            <td>${formatWhen(row.earnedAt)}</td>
          </tr>`,
          )
          .join("")}</tbody>
      </table>`;
  const kind = state.listKind ?? "all";
  const used = state.listUsed ?? "all";
  return `${statsHtml}
    <div class="staff-filters">
      <label>${pl.panelFilterKind}
        <select id="filter-kind">
          <option value="all"${kind === "all" ? " selected" : ""}>${pl.panelFilterAll}</option>
          <option value="base"${kind === "base" ? " selected" : ""}>${pl.panelDiscountBase}</option>
          <option value="share"${kind === "share" ? " selected" : ""}>${pl.panelDiscountShare}</option>
        </select>
      </label>
      <label>${pl.panelFilterStatus}
        <select id="filter-used">
          <option value="all"${used === "all" ? " selected" : ""}>${pl.panelFilterAll}</option>
          <option value="open"${used === "open" ? " selected" : ""}>${pl.panelStatusValid}</option>
          <option value="used"${used === "used" ? " selected" : ""}>${pl.panelStatusUsed}</option>
        </select>
      </label>
    </div>
    ${table}
    ${errorNote(state)}`;
}

function rankingView(state: PanelState): string {
  const confirm = state.hidePending
    ? `<p class="note" role="alert">${pl.panelHideConfirm} <strong>${escapeHtml(state.hidePending)}</strong></p>
       <div class="actions">
         <button type="button" class="btn" id="hide-ok">${pl.panelHideOk}</button>
         <button type="button" class="btn secondary" id="hide-cancel">${pl.panelHideCancel}</button>
       </div>`
    : "";
  const rows = state.ranking ?? [];
  const table =
    rows.length === 0
      ? `<p class="note">${pl.panelEmptyRanking}</p>`
      : `<table class="staff-table">
        <thead><tr><th>${pl.panelNick}</th><th>${pl.score}</th><th></th></tr></thead>
        <tbody>${rows
          .map(
            (row) => `<tr>
            <td>${escapeHtml(row.nickname)}</td>
            <td>${row.score}</td>
            <td><button type="button" class="btn secondary" data-hide="${escapeHtml(row.nickname)}">${pl.panelHideNick}</button></td>
          </tr>`,
          )
          .join("")}</tbody>
      </table>`;
  return `${table}${confirm}${errorNote(state)}`;
}

function sectionBody(state: PanelState): string {
  if (state.section === "list") return listView(state);
  if (state.section === "ranking") return rankingView(state);
  return checkView(state);
}

function shellView(state: PanelState, session: KodySession): string {
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
      ${sectionBody(state)}
    </main>
  </section>`;
}

/** HTML for the panel. Only an allow-listed Kody session gets the staff shell. */
export function renderPanel(state: PanelState): string {
  const { session } = state;
  if (!session) return loginView();
  if (!isStaff(session, state.allowList)) return deniedView(session);
  return shellView(state, session);
}
