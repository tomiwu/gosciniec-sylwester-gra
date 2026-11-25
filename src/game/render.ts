import { COLORS, CLOCK, FEEDBACK, FIELD, slowFactor } from "../config";
import type { GameArt } from "./art";
import type { Effects, Pop } from "./effects";
import type { GameState, ItemKind } from "./types";

/** The part of the 2D canvas context that the game uses. */
export type Ctx = Pick<
  CanvasRenderingContext2D,
  | "fillRect"
  | "strokeRect"
  | "beginPath"
  | "closePath"
  | "moveTo"
  | "lineTo"
  | "arc"
  | "ellipse"
  | "fill"
  | "stroke"
  | "save"
  | "restore"
  | "fillText"
  | "fillStyle"
  | "strokeStyle"
  | "lineWidth"
  | "lineCap"
  | "globalAlpha"
  | "font"
  | "textAlign"
  | "textBaseline"
  | "shadowColor"
  | "shadowBlur"
  | "shadowOffsetX"
  | "shadowOffsetY"
  | "drawImage"
  | "translate"
  | "rotate"
  | "createRadialGradient"
>;

export interface Labels {
  readonly score: string;
  readonly time: string;
}

export interface View {
  readonly nowMs?: number;
  readonly moveDir?: -1 | 0 | 1;
  readonly catchAgeMs?: number;
  readonly art?: GameArt | null;
}

function readView(view: View): {
  nowMs: number;
  moveDir: -1 | 0 | 1;
  catchAgeMs: number;
  art: GameArt | null;
} {
  return {
    nowMs: view.nowMs ?? 0,
    moveDir: view.moveDir ?? 0,
    catchAgeMs: view.catchAgeMs ?? 10_000,
    art: view.art ?? null,
  };
}

export function formatClock(remainingMs: number): string {
  const total = Math.max(0, Math.ceil(remainingMs / 1000));
  const seconds = String(total % 60).padStart(2, "0");
  return `${Math.floor(total / 60)}:${seconds}`;
}

export function formatFactor(factor: number): string {
  return factor > 1 ? `×${factor.toFixed(1)}` : "";
}

/**
 * Clock-hand angles for a countdown from 11:00 to midnight.
 * remaining = base => 11:00. remaining = 0 => 12:00.
 * Angles are in radians, 0 at 3 o'clock, so we subtract PI/2 for 12 o'clock.
 */
export function clockAngles(
  remainingMs: number,
  base = CLOCK.baseDurationMs,
): { hour: number; minute: number } {
  const progress = 1 - Math.min(1, Math.max(0, remainingMs) / base);
  const hours = (11 + progress) % 12;
  const minutes = (progress * 60) % 60;
  return {
    hour: (hours / 12) * Math.PI * 2 - Math.PI / 2,
    minute: (minutes / 60) * Math.PI * 2 - Math.PI / 2,
  };
}

const R = FIELD.itemRadiusPx;
const CLOCK_CX = FIELD.width / 2;
const CLOCK_CY = 298;
const CLOCK_SIZE = 356;
const COUPLE_HEIGHT = 214;
const COUPLE_FOOT_Y = FIELD.height - 26;

function disc(ctx: Ctx, x: number, y: number, radius: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawGlass(ctx: Ctx, x: number, y: number) {
  ctx.fillStyle = COLORS.cream;
  ctx.beginPath();
  ctx.moveTo(x - R / 2, y - R);
  ctx.lineTo(x + R / 2, y - R);
  ctx.lineTo(x + 3, y + 2);
  ctx.lineTo(x - 3, y + 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(x - 2, y + 2, 4, R - 6);
  ctx.fillStyle = COLORS.gold;
  ctx.fillRect(x - R / 2, y + R - 4, R, 4);
}

function drawStar(ctx: Ctx, x: number, y: number) {
  ctx.fillStyle = COLORS.gold;
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const radius = i % 2 === 0 ? R : R / 2;
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    ctx.lineTo(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius);
  }
  ctx.closePath();
  ctx.fill();
}

function drawClockItem(ctx: Ctx, x: number, y: number) {
  disc(ctx, x, y, R, COLORS.cream);
  disc(ctx, x, y, R - 4, COLORS.dark);
  ctx.strokeStyle = COLORS.gold;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x, y - R + 8);
  ctx.lineTo(x, y);
  ctx.lineTo(x + R / 2, y);
  ctx.stroke();
}

function drawObstacle(ctx: Ctx, x: number, y: number) {
  disc(ctx, x, y, R, COLORS.red);
  disc(ctx, x, y, R - 6, COLORS.dark);
  ctx.strokeStyle = COLORS.red;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x - R / 3, y - R / 3);
  ctx.lineTo(x + R / 3, y + R / 3);
  ctx.moveTo(x + R / 3, y - R / 3);
  ctx.lineTo(x - R / 3, y + R / 3);
  ctx.stroke();
}

const ITEM_DRAWERS: Record<ItemKind, (ctx: Ctx, x: number, y: number) => void> =
  {
    glass: drawGlass,
    star: drawStar,
    clock: drawClockItem,
    obstacle: drawObstacle,
  };

function drawCover(
  ctx: Ctx,
  img: CanvasImageSource & { width: number; height: number },
  shiftX: number,
) {
  const iw = img.width;
  const ih = img.height;
  if (iw <= 0 || ih <= 0) return;
  const scale = Math.max(FIELD.width / iw, FIELD.height / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = (FIELD.width - dw) / 2 + shiftX;
  const dy = (FIELD.height - dh) / 2;
  ctx.drawImage(img, dx, dy, dw, dh);
}

function drawTwinkles(ctx: Ctx, nowMs: number) {
  ctx.save();
  for (let i = 0; i < 16; i += 1) {
    const x = ((i * 73 + 19) % 97) * (FIELD.width / 97);
    const y = 24 + ((i * 47 + 11) % 53) * 2.2;
    const pulse = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(nowMs / 420 + i * 0.9));
    ctx.globalAlpha = pulse;
    ctx.fillStyle = i % 3 === 0 ? COLORS.cream : COLORS.gold;
    ctx.beginPath();
    ctx.arc(x, y, i % 4 === 0 ? 1.6 : 1.1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawVignette(ctx: Ctx) {
  const gradient = ctx.createRadialGradient(
    CLOCK_CX,
    CLOCK_CY,
    70,
    CLOCK_CX,
    CLOCK_CY,
    430,
  );
  if (gradient && "addColorStop" in gradient) {
    gradient.addColorStop(0, "rgba(8, 6, 10, 0)");
    gradient.addColorStop(1, "rgba(8, 6, 10, 0.42)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  }
}

function drawHand(
  ctx: Ctx,
  angle: number,
  length: number,
  width: number,
  color: string,
) {
  ctx.save();
  ctx.translate(CLOCK_CX, CLOCK_CY);
  ctx.rotate(angle);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.shadowColor = "rgba(201, 162, 77, 0.7)";
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.moveTo(-length * 0.16, 0);
  ctx.lineTo(length, 0);
  ctx.stroke();
  ctx.restore();
}

function drawClockFace(ctx: Ctx, remainingMs: number, art: GameArt | null) {
  const size = CLOCK_SIZE;
  if (art) {
    ctx.save();
    ctx.shadowColor = "rgba(201, 162, 77, 0.45)";
    ctx.shadowBlur = 24;
    ctx.drawImage(
      art.clockRing,
      CLOCK_CX - size / 2,
      CLOCK_CY - size / 2,
      size,
      size,
    );
    ctx.restore();
  } else {
    ctx.strokeStyle = COLORS.gold;
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(CLOCK_CX, CLOCK_CY, size / 2 - 8, 0, Math.PI * 2);
    ctx.stroke();
  }
  const { hour, minute } = clockAngles(remainingMs);
  drawHand(ctx, hour, size * 0.2, 4, "#e8d196");
  drawHand(ctx, minute, size * 0.33, 2.5, COLORS.gold);
  disc(ctx, CLOCK_CX, CLOCK_CY, 5, COLORS.gold);
  disc(ctx, CLOCK_CX, CLOCK_CY, 2.2, COLORS.cream);
}

function drawFallbackCouple(ctx: Ctx, x: number) {
  const y = FIELD.playerY;
  ctx.fillStyle = COLORS.cream;
  ctx.beginPath();
  ctx.ellipse(x - 16, y + 8, 14, 38, 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLORS.gold;
  ctx.beginPath();
  ctx.ellipse(x + 16, y + 8, 14, 38, -0.15, 0, Math.PI * 2);
  ctx.fill();
  disc(ctx, x - 12, y - 42, 11, COLORS.cream);
  disc(ctx, x + 12, y - 42, 11, COLORS.gold);
}

function couplePose(art: GameArt, moveDir: -1 | 0 | 1, catchAgeMs: number) {
  if (catchAgeMs < FEEDBACK.catchPoseMs) return art.coupleCatch;
  if (moveDir < 0) return art.coupleLeft;
  if (moveDir > 0) return art.coupleRight;
  return art.coupleIdle;
}

function drawCoupleSprite(
  ctx: Ctx,
  art: GameArt,
  x: number,
  nowMs: number,
  moveDir: -1 | 0 | 1,
  catchAgeMs: number,
) {
  const img = couplePose(art, moveDir, catchAgeMs);
  const scale = COUPLE_HEIGHT / img.height;
  const tw = img.width * scale;
  const th = img.height * scale;
  const catching = catchAgeMs < FEEDBACK.catchPoseMs;
  const idle = moveDir === 0 && !catching;
  const sway = Math.sin(nowMs / 430) * (idle ? 0.035 : 0.02);
  const bob = Math.sin(nowMs / 300) * (idle ? 2 : 3.2);
  const lean = moveDir * 0.05;
  const pop = catching ? 1.04 : 1;
  ctx.save();
  ctx.translate(x, COUPLE_FOOT_Y + bob);
  ctx.rotate(sway + lean);
  ctx.drawImage(img, (-tw * pop) / 2, -th * pop, tw * pop, th * pop);
  ctx.restore();
}

function drawPop(ctx: Ctx, pop: Pop) {
  const progress = pop.ageMs / FEEDBACK.popMs;
  ctx.globalAlpha = 1 - progress;
  ctx.fillStyle = COLORS.gold;
  ctx.fillText(`+${pop.points}`, pop.x, pop.y - progress * FEEDBACK.popRisePx);
}

function drawPops(ctx: Ctx, pops: readonly Pop[]) {
  ctx.save();
  ctx.font = "bold 28px Cinzel, Georgia, serif";
  ctx.textAlign = "center";
  ctx.shadowColor = "rgba(0, 0, 0, 0.65)";
  ctx.shadowBlur = 6;
  for (const pop of pops) drawPop(ctx, pop);
  ctx.restore();
}

function flash(ctx: Ctx, color: string, left: number, total: number) {
  if (left <= 0) return;
  ctx.save();
  ctx.globalAlpha = (left / total) * 0.35;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.restore();
}

function pulse(ctx: Ctx, left: number) {
  if (left <= 0) return;
  ctx.save();
  ctx.globalAlpha = left / FEEDBACK.pulseMs;
  ctx.strokeStyle = COLORS.gold;
  ctx.lineWidth = 10;
  ctx.strokeRect(0, 0, FIELD.width, FIELD.height);
  ctx.restore();
}

function drawHud(ctx: Ctx, state: GameState, labels: Labels) {
  ctx.save();
  ctx.fillStyle = COLORS.cream;
  ctx.font = "18px Cinzel, Georgia, serif";
  ctx.textAlign = "left";
  ctx.shadowColor = "rgba(0, 0, 0, 0.7)";
  ctx.shadowBlur = 6;
  ctx.fillText(`${labels.score}: ${state.score}`, 16, 32);
  ctx.textAlign = "right";
  ctx.fillStyle = COLORS.gold;
  ctx.fillText(formatFactor(slowFactor(state.streak)), FIELD.width - 16, 32);
  ctx.restore();
}

function drawBackdrop(
  ctx: Ctx,
  art: GameArt | null,
  playerX: number,
  nowMs: number,
) {
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  if (art) {
    const shift = ((playerX - FIELD.width / 2) / FIELD.width) * -14;
    drawCover(ctx, art.skyline, shift);
  }
  drawTwinkles(ctx, nowMs);
  drawVignette(ctx);
}

export function drawFrame(
  ctx: Ctx,
  state: GameState,
  fx: Effects,
  labels: Labels,
  view: View = {},
): void {
  const shot = readView(view);
  drawBackdrop(ctx, shot.art, state.playerX, shot.nowMs);
  drawClockFace(ctx, state.remainingMs, shot.art);
  for (const item of state.items) ITEM_DRAWERS[item.kind](ctx, item.x, item.y);
  if (shot.art) {
    drawCoupleSprite(
      ctx,
      shot.art,
      state.playerX,
      shot.nowMs,
      shot.moveDir,
      shot.catchAgeMs,
    );
  } else {
    drawFallbackCouple(ctx, state.playerX);
  }
  drawPops(ctx, fx.pops);
  flash(ctx, COLORS.cream, fx.flashMs, FEEDBACK.flashMs);
  flash(ctx, COLORS.red, fx.hitMs, FEEDBACK.hitMs);
  pulse(ctx, fx.pulseMs);
  drawHud(ctx, state, labels);
}
