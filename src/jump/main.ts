import {
  FIELD,
  OFFER,
  REWARD,
  discountedPrice,
  formatOfferPrice,
} from "../config";
import { createMockBackend } from "../backend/mock";
import { logoUrl, loadArt, type GameArt } from "../game/art";
import { clientToFieldX } from "./input";
import { createJumpInput } from "./input";
import { createJumpGame } from "./game";
import { burstOrigin, makeBurst, stepSparks, type Spark } from "./fireworks";
import { runJumpRound } from "./session";
import type { JumpState } from "./types";
import { pl } from "../i18n/pl";
import "../styles.css";

const root = document.querySelector("#app");
if (!(root instanceof HTMLElement)) {
  throw new Error("The #app root is missing.");
}
const app: HTMLElement = root;

const bookHref = OFFER.bookingUrl;
const backend = createMockBackend();
const params = new URLSearchParams(window.location.search);
let stopRound: (() => void) | null = null;
let stopFx: (() => void) | null = null;
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

function startFireworks(): () => void {
  const canvas = document.createElement("canvas");
  canvas.className = "fireworks";
  canvas.setAttribute("aria-hidden", "true");
  app.prepend(canvas);
  const ctx = canvas.getContext("2d");
  let sparks: Spark[] = [];
  let last = 0;
  let spawn = 0;
  let handle = 0;
  let live = true;
  const fit = () => {
    canvas.width = Math.max(1, app.clientWidth);
    canvas.height = Math.max(1, app.clientHeight);
  };
  fit();
  for (let i = 0; i < 3; i += 1) {
    const at = burstOrigin(canvas.width, canvas.height, Math.random);
    sparks = [...sparks, ...makeBurst(at.x, at.y, Math.random, 22)];
  }
  const frame = (time: number) => {
    if (!ctx || !live) return;
    const dt = last === 0 ? 16 : Math.min(48, time - last);
    last = time;
    spawn += dt;
    if (spawn > 280) {
      const at = burstOrigin(canvas.width, canvas.height, Math.random);
      sparks = [...sparks, ...makeBurst(at.x, at.y, Math.random)];
      spawn = 0;
    }
    sparks = stepSparks(sparks, dt);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const spark of sparks) {
      ctx.globalAlpha = 1 - spark.ageMs / spark.lifeMs;
      ctx.fillStyle = spark.color;
      ctx.shadowColor = spark.color;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(spark.x, spark.y, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    handle = requestAnimationFrame(frame);
  };
  handle = requestAnimationFrame(frame);
  return () => {
    live = false;
    cancelAnimationFrame(handle);
    canvas.remove();
  };
}

function showStart(): void {
  stopFx?.();
  stopFx = null;
  app.innerHTML = `
  <section class="panel" data-screen="start">
    ${brandLogo()}
    <h1 class="title">${pl.title}</h1>
    <p class="year">${pl.year}</p>
    <p class="subtitle">${pl.tower}</p>
    <p class="event">${pl.eventWhen}</p>
    <p class="price">${formatOfferPrice(OFFER.price)}</p>
    <p class="how">${pl.howToJump}</p>
    <div class="actions">
      <button type="button" class="btn" id="play">${pl.play}</button>
      <a class="btn secondary" id="book" href="${bookHref}">${pl.book}</a>
    </div>
    <p class="note">${pl.localOnly}</p>
  </section>
`;
  document.querySelector("#play")?.addEventListener("click", () => {
    void startJumpGame();
  });
}

function midShotState(): JumpState {
  const base = createJumpGame(() => 0.35);
  const stand = base.floors.find((item) => item.index === 5) ?? base.floors[3];
  if (!stand) return { ...base, remainingMs: 11_000, score: 188, streak: 3 };
  const above =
    base.floors.find((item) => item.index === stand.index + 2) ?? stand;
  const below =
    base.floors.find((item) => item.index === stand.index + 1) ?? stand;
  const cameraY = stand.y - 520;
  const floors = base.floors.map((floor) => {
    if (floor.id === above.id) return { ...floor, kind: "chandelier" as const };
    if (floor.id === below.id) return { ...floor, kind: "tray" as const };
    if (floor.id === stand.id || floor.y < stand.y - 160)
      return { ...floor, kind: "ledge" as const };
    return floor;
  });
  return {
    ...base,
    remainingMs: 11_000,
    score: 188,
    streak: 3,
    playerX: stand.x + Math.min(90, stand.width / 2),
    playerY: stand.y,
    vx: 180,
    onFloorId: stand.id,
    lastFloorIndex: stand.index,
    cameraY,
    floors,
    pickups: [
      {
        id: 800,
        kind: "glass",
        x: stand.x + stand.width - 42,
        y: stand.y - 34,
        floorId: stand.id,
      },
      {
        id: 801,
        kind: "star",
        x: below.x + 36,
        y: below.y - 36,
        floorId: below.id,
      },
      {
        id: 802,
        kind: "clock",
        x: above.x + above.width / 2,
        y: above.y - 48,
        floorId: above.id,
      },
    ],
    hazards: [
      {
        id: 803,
        x: above.x + above.width - 28,
        y: above.y - 22,
        floorId: above.id,
      },
    ],
  };
}

function endShotState(): JumpState {
  return {
    ...createJumpGame(),
    status: "ended",
    endReason: "midnight",
    remainingMs: 0,
    score: 240,
    streak: 4,
  };
}

function priceBlock(percent: number): string {
  const regular = `${pl.priceRegular}: ${formatOfferPrice(OFFER.price)}`;
  const share = `${pl.priceWithShare}: ${formatOfferPrice(OFFER.priceWithShare)}`;
  if (percent <= 0) {
    return `<p class="price-base">${regular}</p><p class="lock">${pl.discountLocked}</p><p class="price-share">${share}</p>`;
  }
  const deal = `${pl.priceWithCode} ${percent}%: ${formatOfferPrice(discountedPrice(percent))}`;
  return `<p class="price-base">${regular}</p><p class="price-deal">${deal}</p><p class="price-share">${share}</p>`;
}

function bindClaim(state: JumpState): void {
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
  state: JumpState,
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

function showResult(state: JumpState): void {
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
  stopFx?.();
  stopFx = startFireworks();
  document.querySelector("#play")?.addEventListener("click", () => {
    void startJumpGame();
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

export async function startJumpGame(): Promise<void> {
  stopRound?.();
  stopFx?.();
  stopFx = null;
  if (!art) {
    try {
      art = await loadArt();
    } catch {
      art = null;
    }
  }
  app.innerHTML = `
    <div class="play-wrap">
      <canvas class="game" data-screen="play"></canvas>
      <button type="button" class="btn jump-btn" id="jump-btn">${pl.jumpButton}</button>
    </div>
  `;
  const canvas = app.querySelector("canvas");
  const jumpButton = document.querySelector("#jump-btn");
  const ctx = canvas?.getContext("2d");
  if (!canvas || !ctx) {
    showStart();
    return;
  }
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = FIELD.width * dpr;
  canvas.height = FIELD.height * dpr;
  ctx.scale(dpr, dpr);
  const input = createJumpInput({
    keys: window,
    pointer: canvas,
    jumpButton,
    toFieldX: (clientX) => {
      const rect = canvas.getBoundingClientRect();
      return clientToFieldX(clientX, rect.left, rect.width, FIELD.width);
    },
  });
  const shotPlay = params.get("shot") === "play";
  const stop = runJumpRound({
    ctx,
    input,
    art,
    ...(shotPlay ? { createState: midShotState } : {}),
    requestFrame: (cb) => requestAnimationFrame(cb),
    cancelFrame: (handle) => cancelAnimationFrame(handle),
    rand: Math.random,
    labels: {
      score: pl.score,
      time: pl.time,
      combo: pl.combo,
      faster: pl.faster,
    },
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
if (shot === "play") void startJumpGame();
else if (shot === "end") showResult(endShotState());
else showStart();
