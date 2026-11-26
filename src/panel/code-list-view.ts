import { OFFER, REWARD } from "../config";
import { pl } from "../i18n/pl";
import { discountLabel, earnedLabel, statusLabel } from "./code-check";
import {
  KIND_FILTERS,
  STATUS_FILTERS,
  countsOf,
  visibleCodes,
  type CodeCounts,
  type CodeFilter,
  type CodeListState,
  type KindFilter,
  type ListedCode,
  type StatusFilter,
} from "./code-list";
import { escapeHtml } from "./view";

function statusFilterLabel(value: StatusFilter): string {
  return value === "all" ? pl.panelFilterAll : statusLabel(value);
}

const KIND_FILTER_LABELS: Record<KindFilter, string> = {
  all: pl.panelFilterAll,
  base: `${REWARD.basePercent}% (${OFFER.priceWithCode} ${OFFER.currency})`,
  share: `${pl.panelFilterBonus} (${OFFER.priceWithShare} ${OFFER.currency})`,
};

function count(label: string, value: number | undefined): string {
  const text = value === undefined ? pl.panelEmptyValue : String(value);
  return `<div class="code-count"><dt>${label}</dt><dd>${text}</dd></div>`;
}

function countsStrip(counts: CodeCounts | null): string {
  return `<dl class="code-counts" aria-label="${pl.panelCountsLabel}">
    ${count(pl.panelCountPlayers, counts?.players)}
    ${count(pl.panelCountIssued, counts?.codesIssued)}
    ${count(pl.panelCountUsed, counts?.codesUsed)}
    ${count(pl.panelCountReferrals, counts?.referrals)}
  </dl>`;
}

function options<T extends string>(
  values: readonly T[],
  current: T,
  label: (value: T) => string,
): string {
  return values
    .map((v) => {
      const mark = v === current ? " selected" : "";
      return `<option value="${v}"${mark}>${label(v)}</option>`;
    })
    .join("");
}

function dateField(name: "from" | "to", label: string, value: string): string {
  return `<label class="filter-field">${label}
      <input name="${name}" type="date" value="${escapeHtml(value)}" />
    </label>`;
}

function filterForm(filter: CodeFilter): string {
  const status = options(STATUS_FILTERS, filter.status, statusFilterLabel);
  const kind = options(KIND_FILTERS, filter.kind, (k) => KIND_FILTER_LABELS[k]);
  return `<form id="code-list-filter" class="code-filter" autocomplete="off">
    <label class="filter-field">${pl.panelFilterStatus}
      <select name="status">${status}</select>
    </label>
    <label class="filter-field">${pl.panelFilterKind}
      <select name="kind">${kind}</select>
    </label>
    ${dateField("from", pl.panelFilterFrom, filter.from)}
    ${dateField("to", pl.panelFilterTo, filter.to)}
  </form>`;
}

function row(code: ListedCode): string {
  return `<tr data-code="${escapeHtml(code.code)}">
      <td class="code-cell">${escapeHtml(code.code)}</td>
      <td>${escapeHtml(code.nickname)}</td>
      <td>${discountLabel(code.kind)}</td>
      <td>${earnedLabel(code.earnedAt)}</td>
      <td class="code-status" data-status="${code.status}">${statusLabel(code.status)}</td>
    </tr>`;
}

function table(codes: ListedCode[]): string {
  const heads = [
    pl.panelFieldCode,
    pl.panelFieldNick,
    pl.panelFieldDiscount,
    pl.panelFieldEarned,
    pl.panelFieldStatus,
  ].map((h) => `<th scope="col">${h}</th>`);
  return `<div class="code-table-wrap"><table class="code-table">
    <thead><tr>${heads.join("")}</tr></thead>
    <tbody>${codes.map(row).join("")}</tbody>
  </table></div>`;
}

function note(text: string): string {
  return `<p class="note">${text}</p>`;
}

function listBody(state: CodeListState, now: Date): string {
  if (!state.loaded) return state.busy ? note(pl.panelListLoading) : "";
  if (state.entries.length === 0) return note(pl.panelListEmpty);
  const codes = visibleCodes(state, now);
  const shown = note(
    `${pl.panelListShown}: ${codes.length} / ${state.entries.length}`,
  );
  return codes.length === 0
    ? `${shown}${note(pl.panelListNoMatch)}`
    : `${shown}${table(codes)}`;
}

function errorText(error: boolean): string {
  return error
    ? `<p class="code-error" role="alert">${pl.panelListFailed}</p>`
    : "";
}

function refreshButton(busy: boolean): string {
  const off = busy ? " disabled" : "";
  return `<div class="actions">
    <button type="button" class="btn secondary" id="code-list-refresh"${off}>${pl.panelListRefresh}</button>
  </div>`;
}

/**
 * HTML for the code list: the counts, the filters and the table.
 * `now` decides valid or expired. No device id or hidden field is shown.
 */
export function renderCodeList(state: CodeListState, now: Date): string {
  return `<div class="code-list-view">
    ${countsStrip(countsOf(state.stats, state.entries))}
    ${filterForm(state.filter)}
    ${errorText(state.error)}
    ${listBody(state, now)}
    ${refreshButton(state.busy)}
  </div>`;
}
