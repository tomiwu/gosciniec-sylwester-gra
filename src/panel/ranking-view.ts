import { pl } from "../i18n/pl";
import type { RankingError, RankingNotice, RankingState } from "./ranking";
import type { LeaderboardRow } from "./staff-api";
import { escapeHtml } from "./view";

const ERROR_TEXT: Record<RankingError, string> = {
  load: pl.panelRankingFailed,
  hide: pl.panelRankingHideFailed,
};

function disabled(off: boolean): string {
  return off ? " disabled" : "";
}

function note(text: string): string {
  return `<p class="note">${text}</p>`;
}

function row(entry: LeaderboardRow, place: number, busy: boolean): string {
  const nick = escapeHtml(entry.nickname);
  return `<tr>
      <td>${place}</td>
      <td>${nick}</td>
      <td>${entry.score}</td>
      <td><button type="button" class="btn secondary ranking-hide" data-hide-nick="${nick}"${disabled(busy)}>${pl.panelRankingHide}</button></td>
    </tr>`;
}

function table(state: RankingState): string {
  const heads = [
    pl.panelFieldPlace,
    pl.panelFieldNick,
    pl.panelFieldScore,
    pl.panelFieldAction,
  ].map((h) => `<th scope="col">${h}</th>`);
  const rows = state.rows.map((r, i) => row(r, i + 1, state.busy));
  return `<div class="code-table-wrap"><table class="code-table ranking-table">
    <thead><tr>${heads.join("")}</tr></thead>
    <tbody>${rows.join("")}</tbody>
  </table></div>`;
}

function body(state: RankingState): string {
  if (!state.loaded) return state.busy ? note(pl.panelRankingLoading) : "";
  return state.rows.length === 0 ? note(pl.panelRankingEmpty) : table(state);
}

function confirmBox(state: RankingState): string {
  if (state.confirm === null) return "";
  const off = disabled(state.busy);
  return `<div class="ranking-confirm" role="alertdialog" aria-labelledby="ranking-confirm-text">
    <p id="ranking-confirm-text">${pl.panelRankingConfirm} <strong>${escapeHtml(state.confirm)}</strong></p>
    <div class="actions">
      <button type="button" class="btn" id="ranking-hide-confirm"${off}>${pl.panelRankingConfirmYes}</button>
      <button type="button" class="btn secondary" id="ranking-hide-cancel"${off}>${pl.panelRankingConfirmNo}</button>
    </div>
  </div>`;
}

function noticeText(notice: RankingNotice | null): string {
  if (!notice) return "";
  const nick = `<strong>${escapeHtml(notice.nickname)}</strong>`;
  const text =
    notice.kind === "hidden"
      ? `${pl.panelRankingHidden}: ${nick}. ${pl.panelRankingCodeKept}`
      : `${pl.panelRankingMissing}: ${nick}.`;
  return `<p class="code-done" role="status">${text}</p>`;
}

function errorText(error: RankingError | null): string {
  if (!error) return "";
  return `<p class="code-error" role="alert">${ERROR_TEXT[error]}</p>`;
}

function refreshButton(busy: boolean): string {
  return `<div class="actions">
    <button type="button" class="btn secondary" id="ranking-refresh"${disabled(busy)}>${pl.panelListRefresh}</button>
  </div>`;
}

/** HTML for the staff ranking: the top list, a hide button per row and the confirm. */
export function renderRanking(state: RankingState): string {
  return `<div class="ranking-view">
    ${note(pl.panelRankingHint)}
    ${confirmBox(state)}
    ${noticeText(state.notice)}
    ${errorText(state.error)}
    ${body(state)}
    ${refreshButton(state.busy)}
  </div>`;
}
