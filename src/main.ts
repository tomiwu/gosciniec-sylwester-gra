import {
  FEEDBACK,
  FIELD,
  LEADERBOARD,
  OFFER,
  REWARD,
  formatOfferPrice,
} from "./config";
import { catchSparks, createEffects, type Effects } from "./game/effects";
import { selectBackend } from "./backend/select";
import { logoUrl, loadArt, type GameArt } from "./game/art";
import { placeItem } from "./game/depth";
import { createGame } from "./game/game";
import { clientToFieldX, createInput } from "./game/input";
import { runRound } from "./game/session";
import { remainingForSlot } from "./game/views";
import {
  escapeHtml,
  isShareBonus,
  leaderboardHtml,
  loadPlayer,
  markRefReported,
  pendingRef,
  progressText,
  readRefToken,
  referralUrl,
  rememberRef,
  savePlayer,
  shareLink,
  telHref,
  type KeyStore,
  type ShareNavigator,
} from "./game/end-screen";
import type { ReferralStatus, ScoreRow, SubmitResult } from "./backend/types";
import type { GameState } from "./game/types";
import { pl } from "./i18n/pl";
import "./styles.css";

const root = document.querySelector("#app");
if (!(root instanceof HTMLElement)) {
  throw new Error("The #app root is missing.");
}
const app: HTMLElement = root;

const bookHref = OFFER.bookingUrl;
/** The mock unless VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set. */
const backend = selectBackend(import.meta.env, (input, init) =>
  window.fetch(input, init),
).player;
const params = new URLSearchParams(window.location.search);
let stopRound: (() => void) | null = null;
let art: GameArt | null = null;

function deviceId(): string {
  const key = "syl-device";
  try {
    const stored = window.localStorage.getItem(key);
    if (stored) return stored;
    const id = window.crypto.randomUUID();
    window.localStorage.setItem(key, id);
    return id;
  } catch {
    return "local";
  }
}

function brandLogo(): string {
  return `<p class="logo"><img class="brand" src="${logoUrl()}" alt="${pl.hotel}" /></p>`;
}

function showStart(): void {
  app.innerHTML = `
  <section class="panel" data-screen="start">
    ${brandLogo()}
    <h1 class="title">${pl.title}</h1>
    <p class="year">${pl.year}</p>
    <p class="subtitle">${pl.subtitle}</p>
    <p class="event">${pl.eventWhen}</p>
    <p class="price">${formatOfferPrice(OFFER.price)}</p>
    <p class="how">${pl.howTo}</p>
    <div class="actions">
      <button type="button" class="btn" id="play">${pl.play}</button>
      <a class="btn secondary" id="book" href="${bookHref}">${pl.book}</a>
    </div>
    <p class="note">${pl.localOnly}</p>
    <p class="credits">${pl.photoCredits}</p>
  </section>
`;
  document.querySelector("#play")?.addEventListener("click", () => {
    void startGame();
  });
}

function shotRemainingMs(): number {
  const remainRaw = params.get("remain");
  if (remainRaw !== null && remainRaw !== "") {
    const remain = Number(remainRaw);
    if (Number.isFinite(remain)) return remain;
  }
  const slotRaw = params.get("slot");
  if (slotRaw !== null && slotRaw !== "") {
    const slot = Number(slotRaw);
    if (Number.isFinite(slot)) return remainingForSlot(slot);
  }
  return 18_000;
}

function midShotState(): GameState {
  const base = createGame();
  return {
    ...base,
    remainingMs: shotRemainingMs(),
    score: 120,
    streak: 3,
    spawnTimerMs: 0,
    items: [
      placeItem({ id: 1, kind: "glass", lane: 0, z: 0.72 }),
      placeItem({ id: 2, kind: "star", lane: 3, z: 0.48 }),
      placeItem({ id: 3, kind: "clock", lane: 4, z: 0.28 }),
      placeItem({ id: 4, kind: "obstacle", lane: 1, z: 0.34 }),
    ],
    nextId: 5,
  };
}

function endShotState(): GameState {
  return {
    ...createGame(),
    status: "ended",
    endReason: "midnight",
    remainingMs: 0,
    score: 240,
    streak: 4,
  };
}

function offerCard(percent: number): string {
  const regular = `${pl.priceRegular}: ${formatOfferPrice(OFFER.price)}`;
  const withCode = `${pl.priceWithCode} 10%: ${formatOfferPrice(OFFER.priceWithCode)}`;
  const withShare = `${pl.priceWithShare}: ${formatOfferPrice(OFFER.priceWithShare)}`;
  const lock = percent <= 0 ? `<p class="lock">${pl.discountLocked}</p>` : "";
  return `<div class="offer-card">
    <p class="offer-title">${pl.title} ${pl.year}</p>
    <p class="offer-meta">${pl.eventWhen}</p>
    <p class="offer-meta">${pl.dj}</p>
    <p class="offer-meta">${pl.address}</p>
    <div class="offer-prices">
      <p class="price-base">${regular}</p>
      <p class="price-deal">${withCode}</p>
      <p class="price-share">${withShare}</p>
    </div>
    ${lock}
  </div>`;
}

function playShotEffects(): Effects {
  return {
    ...createEffects(),
    pops: [{ x: 210, y: 560, points: 15, ageMs: 90 }],
    sparks: catchSparks(200, 580).map((spark, i) => ({
      ...spark,
      ageMs: 40 + i * 6,
    })),
    pulseMs: Math.round(FEEDBACK.pulseMs * 0.7),
  };
}

function bindClaim(state: GameState): void {
  const form = document.querySelector("#claim");
  const input = document.querySelector("#nick");
  if (
    !(form instanceof HTMLFormElement) ||
    !(input instanceof HTMLInputElement)
  ) {
    return;
  }
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void redeem(state, input.value, form);
  });
}

function storage(): KeyStore {
  try {
    return window.localStorage;
  } catch {
    return { getItem: () => null, setItem: () => undefined };
  }
}

function showCode(result: SubmitResult, nickname: string): void {
  const codeBox = document.querySelector("#code-box");
  if (!codeBox) return;
  const label =
    result.discountPercent === REWARD.referralPercent
      ? pl.discountReferral
      : pl.discountUnlocked;
  codeBox.innerHTML = `<p class="code">${pl.yourCode}: <strong>${escapeHtml(result.code)}</strong></p><p class="note">${label} · ${pl.playingAs} ${escapeHtml(nickname.trim())}</p>`;
}

async function redeem(
  state: GameState,
  nickname: string,
  form?: HTMLFormElement | null,
): Promise<void> {
  const result = await backend.submit({
    nickname,
    score: state.score,
    deviceId: deviceId(),
  });
  if (result.accepted && result.code) {
    savePlayer(storage(), result.code, nickname);
    form?.classList.add("is-hidden");
    showCode(result, nickname);
    void showReferral(result.code);
  } else if (form) {
    const codeBox = document.querySelector("#code-box");
    if (codeBox) codeBox.innerHTML = `<p class="lock">${pl.discountLocked}</p>`;
  }
  void showBoard();
}

function referralDots(done: number, needed: number): string {
  let dots = "";
  for (let i = 0; i < needed; i += 1) {
    dots += `<span class="dot${i < done ? " on" : ""}"></span>`;
  }
  return `<span class="dots" aria-hidden="true">${dots}</span>`;
}

function referralProgress(status: ReferralStatus | null): string {
  if (!status) return `<p class="note">${pl.referNoServer}</p>`;
  const done = Math.min(status.progress, status.needed);
  const line = isShareBonus(status) ? pl.referBonus : pl.referHow;
  return `<p class="refer-how">${line}</p>
    <p class="refer-progress">${referralDots(done, status.needed)}<span>${pl.referralProgress}: <strong>${progressText(status)}</strong></span></p>`;
}

async function showReferral(code: string): Promise<void> {
  const box = document.querySelector("#refer");
  if (!box) return;
  const status = await backend.referralStatus(code);
  const url = referralUrl(window.location.href, status?.token ?? null);
  box.innerHTML = `<p class="refer-title">${pl.referTitle}</p>
    ${referralProgress(status)}
    <button type="button" class="btn secondary" id="share">${pl.referShare}</button>
    <p class="note refer-msg" id="share-msg" role="status"></p>`;
  box.classList.remove("is-hidden");
  document.querySelector("#share")?.addEventListener("click", () => {
    void onShare(url);
  });
}

async function onShare(url: string): Promise<void> {
  const outcome = await shareLink(navigator as ShareNavigator, {
    title: `${pl.hotel} · ${pl.title} ${pl.year}`,
    text: pl.shareMessage,
    url,
  });
  const msg = document.querySelector("#share-msg");
  if (!msg) return;
  if (outcome === "copied") msg.textContent = pl.referCopied;
  if (outcome === "failed") {
    msg.innerHTML = `${pl.referManual}<input class="share-url" readonly value="${escapeHtml(url)}" />`;
    const field = msg.querySelector("input");
    field?.addEventListener("focus", () => field.select());
  }
}

async function showBoard(): Promise<void> {
  const box = document.querySelector("#board");
  if (!box) return;
  let rows: ScoreRow[] = [];
  try {
    rows = await backend.top(LEADERBOARD.topN);
  } catch {
    rows = [];
  }
  box.innerHTML = leaderboardHtml(rows, loadPlayer(storage()).nick, {
    title: pl.leaderboard,
    empty: pl.boardEmpty,
  });
}

function reportReferral(): void {
  const store = storage();
  const token = pendingRef(store);
  if (!token) return;
  void backend.recordReferralFinish(token, deviceId()).then((counted) => {
    if (counted) markRefReported(store, token);
  });
}

function claimForm(): string {
  return `<form class="claim" id="claim">
        <input id="nick" name="nick" maxlength="16" autocomplete="nickname" required placeholder="${pl.enterName}" />
        <button type="submit" class="btn" id="claim-btn">${pl.getCode}</button>
      </form>`;
}

function showResult(state: GameState): void {
  const unlocked = state.score >= REWARD.discountScore;
  const saved = loadPlayer(storage());
  const known = Boolean(saved.code && saved.nick);
  const percent = unlocked || known ? REWARD.basePercent : 0;
  const phone = OFFER.reservationPhone;
  app.innerHTML = `
  <section class="panel" data-screen="end">
    ${brandLogo()}
    <h2 class="title">${pl.midnight}</h2>
    <p class="price">${pl.score}: ${state.score}</p>
    <p class="ornament">✦</p>
    ${offerCard(percent)}
    ${unlocked && !known ? claimForm() : ""}
    <div id="code-box"></div>
    <div class="refer is-hidden" id="refer"></div>
    <div class="actions">
      <a class="btn call" id="call" href="${telHref(phone)}">${pl.callBook}<span class="call-number">${phone}</span></a>
      <a class="btn secondary" id="book" href="${bookHref}">${pl.book}</a>
      <button type="button" class="btn secondary" id="play">${pl.playAgain}</button>
    </div>
    <div class="board" id="board"></div>
    <p class="credits">${pl.photoCredits}</p>
  </section>
`;
  document.querySelector("#play")?.addEventListener("click", () => {
    void startGame();
  });
  reportReferral();
  if (known && saved.nick) {
    void redeem(state, saved.nick);
  } else {
    if (unlocked) bindClaim(state);
    void showBoard();
  }
  const shotNick = params.get("nick");
  if (unlocked && !known && params.get("shot") === "end" && shotNick) {
    const input = document.querySelector("#nick");
    if (input instanceof HTMLInputElement) input.value = shotNick;
    const shotForm = document.querySelector("#claim");
    void redeem(
      state,
      shotNick,
      shotForm instanceof HTMLFormElement ? shotForm : null,
    );
  }
}

/** Start one round. Issue #3 can call this from its own button. */
export async function startGame(): Promise<void> {
  stopRound?.();
  if (!art) {
    try {
      art = await loadArt();
    } catch {
      art = null;
    }
  }
  app.innerHTML = `<canvas class="game" data-screen="play"></canvas>`;
  const canvas = app.querySelector("canvas");
  const ctx = canvas?.getContext("2d");
  if (!canvas || !ctx) {
    showStart();
    return;
  }
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = FIELD.width * dpr;
  canvas.height = FIELD.height * dpr;
  ctx.scale(dpr, dpr);
  const input = createInput({
    keys: window,
    pointer: canvas,
    toFieldX: (clientX) => {
      const rect = canvas.getBoundingClientRect();
      return clientToFieldX(clientX, rect.left, rect.width, FIELD.width);
    },
  });
  const shotPlay = params.get("shot") === "play";
  const stop = runRound({
    ctx,
    input,
    art,
    ...(shotPlay
      ? {
          createState: midShotState,
          initialEffects: playShotEffects(),
          seedMotion: { catchAgeMs: 120, spinAgeMs: 30 },
          ...(params.get("pause") === "1"
            ? { pauseAfterFirstFrame: true }
            : {}),
        }
      : {}),
    requestFrame: (cb) => requestAnimationFrame(cb),
    cancelFrame: (handle) => cancelAnimationFrame(handle),
    rand: Math.random,
    labels: { score: pl.score, time: pl.time, photoCredits: pl.photoCredits },
    onEnd: (state) => {
      input.dispose();
      stopRound = null;
      showResult(state);
    },
  });
  stopRound = () => {
    stop();
    input.dispose();
  };
}

rememberRef(storage(), readRefToken(window.location.search));

const shot = params.get("shot");
if (shot === "play") void startGame();
else if (shot === "end") showResult(endShotState());
else showStart();
