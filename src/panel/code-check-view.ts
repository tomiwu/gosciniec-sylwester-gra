import { pl } from "../i18n/pl";
import {
  canRedeem,
  discountLabel,
  earnedLabel,
  statusLabel,
  type CodeCheckError,
  type CodeCheckState,
} from "./code-check";
import type { CodeCheck } from "./staff-api";
import { escapeHtml } from "./view";

const ERROR_TEXT: Record<CodeCheckError, string> = {
  empty: pl.panelCheckEmpty,
  check: pl.panelCheckFailed,
  redeem: pl.panelRedeemFailed,
};

function disabled(off: boolean): string {
  return off ? " disabled" : "";
}

function form(state: CodeCheckState): string {
  return `<form id="code-check-form" class="code-check" autocomplete="off">
    <label class="note" for="code-input">${pl.panelCodeLabel}</label>
    <input id="code-input" class="code-input" name="code" type="text" value="${escapeHtml(state.code)}" placeholder="SYL-XXXX" maxlength="20" autocapitalize="characters" spellcheck="false" />
    <button type="submit" class="btn"${disabled(state.busy)}>${pl.panelCheckSubmit}</button>
  </form>`;
}

function errorText(error: CodeCheckError | null): string {
  if (!error) return "";
  return `<p class="code-error" role="alert">${ERROR_TEXT[error]}</p>`;
}

function row(label: string, value: string): string {
  return `<dt>${label}</dt><dd>${value}</dd>`;
}

function result(check: CodeCheck): string {
  const nick = check.nickname ?? pl.panelEmptyValue;
  return `<dl class="code-result" data-status="${check.status}">
    ${row(pl.panelFieldCode, escapeHtml(check.code))}
    ${row(pl.panelFieldNick, escapeHtml(nick))}
    ${row(pl.panelFieldDiscount, discountLabel(check.kind))}
    ${row(pl.panelFieldEarned, earnedLabel(check.earnedAt))}
    ${row(pl.panelFieldStatus, `<strong class="code-status">${statusLabel(check.status)}</strong>`)}
  </dl>`;
}

function redeemPart(state: CodeCheckState): string {
  const done = state.redeemed
    ? `<p class="code-done" role="status">${pl.panelRedeemDone}</p>`
    : "";
  return `${done}<div class="actions">
    <button type="button" class="btn" id="redeem"${disabled(!canRedeem(state))}>${pl.panelRedeem}</button>
  </div>
  <p class="note">${pl.panelRedeemHint}</p>`;
}

/** HTML for the code check: the form, the result and the redeem button. */
export function renderCodeCheck(state: CodeCheckState): string {
  const found = state.check ? `${result(state.check)}${redeemPart(state)}` : "";
  return `<div class="code-check-view">${form(state)}${errorText(state.error)}${found}</div>`;
}
