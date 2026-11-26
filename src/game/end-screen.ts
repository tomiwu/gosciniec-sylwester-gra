import type { ReferralStatus, ScoreRow } from "../backend/types";

/** Referral token shape. It matches the SQL check on `public.referral_links.token`. */
const TOKEN_PATTERN = /^[2-9A-HJ-NP-Z]{10}$/;

/** Query keys that a shared link must not carry (screenshot and test switches). */
const SHARE_DROP_KEYS = ["ref", "shot", "nick", "remain", "slot", "pause"];

export function normalizeToken(raw: string | null | undefined): string | null {
  const token = (raw ?? "").trim().toUpperCase();
  return TOKEN_PATTERN.test(token) ? token : null;
}

/** The referral token from a page query string, or null. */
export function readRefToken(search: string): string | null {
  return normalizeToken(new URLSearchParams(search).get("ref"));
}

/** Game link for sharing. Adds `?ref=<token>` when a token exists. */
export function referralUrl(pageHref: string, token: string | null): string {
  const url = new URL(pageHref);
  for (const key of SHARE_DROP_KEYS) url.searchParams.delete(key);
  url.hash = "";
  if (token) url.searchParams.set("ref", token);
  return url.toString();
}

/** "3/5". The progress never shows more than the target. */
export function progressText(status: ReferralStatus): string {
  const needed = Math.max(1, status.needed);
  const done = Math.min(Math.max(0, Math.floor(status.progress)), needed);
  return `${done}/${needed}`;
}

/** True when the share bonus (299 zl) is active. */
export function isShareBonus(status: ReferralStatus): boolean {
  return status.progress >= status.needed;
}

/** "+48 63 28 88 628" => "tel:+48632888628". */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** Nicknames come from players. Escape them before they go into HTML. */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch] ?? ch);
}

function sameNick(a: string, b: string | null): boolean {
  return b !== null && a.trim().toLowerCase() === b.trim().toLowerCase();
}

function boardRow(row: ScoreRow, place: number, own: boolean): string {
  const mark = own ? ' class="me" aria-current="true"' : "";
  return `<li${mark}><span class="rank">${place}</span><span class="nick">${escapeHtml(row.nickname)}</span><span class="pts">${Math.floor(row.score)}</span></li>`;
}

export type BoardLabels = { title: string; empty: string };

/** Top list as HTML. The row of the player has the class `me`. */
export function leaderboardHtml(
  rows: ScoreRow[],
  ownNick: string | null,
  labels: BoardLabels,
): string {
  const items = rows
    .map((row, i) => boardRow(row, i + 1, sameNick(row.nickname, ownNick)))
    .join("");
  const body = items
    ? `<ol class="board-list">${items}</ol>`
    : `<p class="note">${escapeHtml(labels.empty)}</p>`;
  return `<h3 class="board-title">${escapeHtml(labels.title)}</h3>${body}`;
}

export type ShareData = { title: string; text: string; url: string };

/** The parts of `navigator` that sharing uses. Tests give a fake. */
export type ShareNavigator = {
  share?: (data: ShareData) => Promise<void>;
  clipboard?: { writeText(text: string): Promise<void> };
};

export type ShareOutcome = "shared" | "cancelled" | "copied" | "failed";

function isAbort(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

async function copyLink(
  nav: ShareNavigator,
  url: string,
): Promise<ShareOutcome> {
  if (!nav.clipboard) return "failed";
  try {
    await nav.clipboard.writeText(url);
    return "copied";
  } catch {
    return "failed";
  }
}

/** Web Share API first. Copy the link when share is missing or fails. */
export async function shareLink(
  nav: ShareNavigator,
  data: ShareData,
): Promise<ShareOutcome> {
  if (!nav.share) return copyLink(nav, data.url);
  try {
    await nav.share(data);
    return "shared";
  } catch (error) {
    return isAbort(error) ? "cancelled" : copyLink(nav, data.url);
  }
}

/** Small key-value store. `window.localStorage` fits. */
export type KeyStore = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

const KEYS = {
  ref: "syl-ref",
  refDone: "syl-ref-done",
  code: "syl-code",
  nick: "syl-nick",
} as const;

function read(store: KeyStore, key: string): string | null {
  try {
    return store.getItem(key);
  } catch {
    return null;
  }
}

function write(store: KeyStore, key: string, value: string): void {
  try {
    store.setItem(key, value);
  } catch {
    return;
  }
}

/** Keep the first referral token that this device saw. */
export function rememberRef(store: KeyStore, token: string | null): void {
  if (token && !normalizeToken(read(store, KEYS.ref))) {
    write(store, KEYS.ref, token);
  }
}

/** The token to report after a round, or null when it is missing or already reported. */
export function pendingRef(store: KeyStore): string | null {
  const token = normalizeToken(read(store, KEYS.ref));
  if (!token || read(store, KEYS.refDone) === token) return null;
  return token;
}

export function markRefReported(store: KeyStore, token: string): void {
  write(store, KEYS.refDone, token);
}

export type SavedPlayer = { code: string | null; nick: string | null };

export function savePlayer(store: KeyStore, code: string, nick: string): void {
  write(store, KEYS.code, code);
  write(store, KEYS.nick, nick.trim());
}

export function loadPlayer(store: KeyStore): SavedPlayer {
  return { code: read(store, KEYS.code), nick: read(store, KEYS.nick) };
}
