import { FIELD, OFFER } from "./config";
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
let stopRound: (() => void) | null = null;

function showStart(): void {
  app.innerHTML = `
  <section class="panel" data-screen="start">
    <p class="logo">${pl.hotel}</p>
    <h1 class="title">${pl.title}</h1>
    <p class="subtitle">${pl.subtitle}</p>
    <p class="price-was">${pl.offerWas}</p>
    <p class="price">${pl.offerPrice}</p>
    <p class="how">${pl.howTo}</p>
    <div class="actions">
      <button type="button" class="btn" id="play">${pl.play}</button>
      <a class="btn secondary" id="book" href="${bookHref}">${pl.book}</a>
    </div>
    <p class="note">${pl.localOnly}</p>
  </section>
`;
  document.querySelector("#play")?.addEventListener("click", startGame);
}

function showResult(state: GameState): void {
  app.innerHTML = `
  <section class="panel" data-screen="end">
    <p class="logo">${pl.hotel}</p>
    <h2 class="title">${pl.midnight}</h2>
    <p class="price">${pl.score}: ${state.score}</p>
    <div class="actions">
      <button type="button" class="btn" id="play">${pl.playAgain}</button>
      <a class="btn secondary" id="book" href="${bookHref}">${pl.book}</a>
    </div>
  </section>
`;
  document.querySelector("#play")?.addEventListener("click", startGame);
}

/** Start one round. Issue #3 can call this from its own button. */
export function startGame(): void {
  stopRound?.();
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
  const stop = runRound({
    ctx,
    input,
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

showStart();
