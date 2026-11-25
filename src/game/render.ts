import { COLORS, FEEDBACK, FIELD, slowFactor } from "../config";
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
  | "globalAlpha"
  | "font"
  | "textAlign"
>;

export interface Labels {
  readonly score: string;
  readonly time: string;
}

export function formatClock(remainingMs: number): string {
  const total = Math.max(0, Math.ceil(remainingMs / 1000));
  const seconds = String(total % 60).padStart(2, "0");
  return `${Math.floor(total / 60)}:${seconds}`;
}

export function formatFactor(factor: number): string {
  return factor > 1 ? `×${factor.toFixed(1)}` : "";
}

const R = FIELD.itemRadiusPx;

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

function drawClock(ctx: Ctx, x: number, y: number) {
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
    clock: drawClock,
    obstacle: drawObstacle,
  };

function drawCouple(ctx: Ctx, x: number) {
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

function drawPop(ctx: Ctx, pop: Pop) {
  const progress = pop.ageMs / FEEDBACK.popMs;
  ctx.globalAlpha = 1 - progress;
  ctx.fillStyle = COLORS.gold;
  ctx.fillText(`+${pop.points}`, pop.x, pop.y - progress * FEEDBACK.popRisePx);
}

function drawPops(ctx: Ctx, pops: readonly Pop[]) {
  ctx.save();
  ctx.font = "bold 28px Georgia, serif";
  ctx.textAlign = "center";
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
  ctx.font = "20px Georgia, serif";
  ctx.textAlign = "left";
  ctx.fillText(`${labels.score}: ${state.score}`, 16, 32);
  ctx.textAlign = "right";
  ctx.fillText(
    `${labels.time}: ${formatClock(state.remainingMs)}`,
    FIELD.width - 16,
    32,
  );
  ctx.fillStyle = COLORS.gold;
  ctx.fillText(formatFactor(slowFactor(state.streak)), FIELD.width - 16, 58);
  ctx.restore();
}

export function drawFrame(
  ctx: Ctx,
  state: GameState,
  fx: Effects,
  labels: Labels,
): void {
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  for (const item of state.items) ITEM_DRAWERS[item.kind](ctx, item.x, item.y);
  drawCouple(ctx, state.playerX);
  drawPops(ctx, fx.pops);
  flash(ctx, COLORS.cream, fx.flashMs, FEEDBACK.flashMs);
  flash(ctx, COLORS.red, fx.hitMs, FEEDBACK.hitMs);
  pulse(ctx, fx.pulseMs);
  drawHud(ctx, state, labels);
}
