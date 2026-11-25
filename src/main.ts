import {
  FIELD,
  OFFER,
  REWARD,
  discountedPrice,
  formatOfferPrice,
} from "./config";
import { createMockBackend } from "./backend/mock";
import { logoUrl, loadArt, type GameArt } from "./game/art";
import { createGame } from "./game/game";
import { clientToFieldX, createInput } from "./game/input";
import { runRound } from "./game/session";
import type { GameState } from "./game/types";
import { pl } from "./i18n/pl";
import "./styles.css";

const root = document.querySelector("#app");
if (!(root instanceof HTMLElement)) {
  throw new Error("The #app root is missing.");
}
const app: HTMLElement = root;

const bookHref = OFFER.bookingUrl;
const backend = createMockBackend();
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
  </section>
`;
  document.querySelector("#play")?.addEventListener("click", () => {
    void startGame();
  });
}

function midShotState(): GameState {
  const base = createGame();
  return {
    ...base,
    remainingMs: 22_000,
    score: 120,
    streak: 3,
    items: [
      { id: 1, kind: "glass", x: 90, y: 180 },
      { id: 2, kind: "star", x: 200, y: 280 },
      { id: 3, kind: "clock", x: 300, y: 120 },
      { id: 4, kind: "obstacle", x: 150, y: 60 },
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

function priceBlock(percent: number): string {
  const regular = `${pl.priceRegular}: ${formatOfferPrice(OFFER.price)}`;
  if (percent <= 0) {
    return `<p class="price-base">${regular}</p><p class="lock">${pl.discountLocked}</p>`;
  }
  const deal = `${pl.priceWithCode} ${percent}%: ${formatOfferPrice(discountedPrice(percent))}`;
  return `<p class="price-base">${regular}</p><p class="price-deal">${deal}</p>`;
}

function bindClaim(state: GameState): void {
  const form = document.querySelector("#claim");
  const input = document.querySelector("#nick");
  const codeBox = document.querySelector("#code-box");
  if (
    !(form instanceof HTMLFormElement) ||
    !(input instanceof HTMLInputElement)
  ) {
    return;
  }
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void redeem(state, input.value, codeBox, form);
  });
}

async function redeem(
  state: GameState,
  nickname: string,
  codeBox: Element | null,
  form?: HTMLFormElement | null,
): Promise<void> {
  const result = await backend.submit({
    nickname,
    score: state.score,
    deviceId: deviceId(),
  });
  if (!codeBox) return;
  if (result.accepted && result.code) {
    const label =
      result.discountPercent === REWARD.referralPercent
        ? pl.discountReferral
        : pl.discountUnlocked;
    codeBox.innerHTML = `<p class="code">${pl.yourCode}: <strong>${result.code}</strong></p><p class="note">${label}</p>`;
    form?.classList.add("is-hidden");
    return;
  }
  codeBox.innerHTML = `<p class="lock">${pl.discountLocked}</p>`;
}

function showResult(state: GameState): void {
  const unlocked = state.score >= REWARD.discountScore;
  const percent = unlocked ? REWARD.basePercent : 0;
  const claim = unlocked
    ? `<form class="claim" id="claim">
        <input id="nick" name="nick" maxlength="16" autocomplete="nickname" required placeholder="${pl.enterName}" />
        <button type="submit" class="btn" id="claim-btn">${pl.getCode}</button>
      </form>
      <div id="code-box"></div>`
    : "";
  app.innerHTML = `
  <section class="panel" data-screen="end">
    ${brandLogo()}
    <h2 class="title">${pl.midnight}</h2>
    <p class="price">${pl.score}: ${state.score}</p>
    ${priceBlock(percent)}
    ${claim}
    <div class="actions">
      <button type="button" class="btn" id="play">${pl.playAgain}</button>
      <a class="btn secondary" id="book" href="${bookHref}">${pl.book}</a>
    </div>
  </section>
`;
  document.querySelector("#play")?.addEventListener("click", () => {
    void startGame();
  });
  if (unlocked) bindClaim(state);
  const shotNick = params.get("nick");
  if (unlocked && params.get("shot") === "end" && shotNick) {
    const input = document.querySelector("#nick");
    if (input instanceof HTMLInputElement) input.value = shotNick;
    const shotForm = document.querySelector("#claim");
    void redeem(
      state,
      shotNick,
      document.querySelector("#code-box"),
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
    ...(shotPlay ? { createState: midShotState } : {}),
    requestFrame: (cb) => requestAnimationFrame(cb),
    cancelFrame: (handle) => cancelAnimationFrame(handle),
    rand: Math.random,
    labels: { score: pl.score, time: pl.time },
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

const shot = params.get("shot");
if (shot === "play") void startGame();
else if (shot === "end") showResult(endShotState());
else showStart();
