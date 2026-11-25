import {
  COLORS,
  FEEDBACK,
  FIELD,
  JUMP,
  jumpClock,
  jumpScrollSpeed,
  slowFactor,
} from "../config";
import type { GameArt } from "../game/art";
import type { Effects, Pop } from "../game/effects";
import { clockAngles, formatClock, formatFactor } from "../game/render";
import type { Floor, FloorKind, Hazard, JumpState, Pickup } from "./types";

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
  | "lineJoin"
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
  | "quadraticCurveTo"
  | "rect"
  | "clip"
>;

export interface JumpLabels {
  readonly score: string;
  readonly time: string;
  readonly combo: string;
  readonly faster: string;
}

export interface JumpView {
  readonly nowMs?: number;
  readonly moveDir?: -1 | 0 | 1;
  readonly airborne?: boolean;
  readonly art?: GameArt | null;
}

const CLOCK_CX = FIELD.width / 2;
const COUPLE_HEIGHT = 196;
const clock = jumpClock();

function disc(ctx: Ctx, x: number, y: number, radius: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function screenY(worldY: number, cameraY: number): number {
  return worldY - cameraY;
}

function drawCover(
  ctx: Ctx,
  img: CanvasImageSource & { width: number; height: number },
  shiftX: number,
  shiftY: number,
) {
  const iw = img.width;
  const ih = img.height;
  if (iw <= 0 || ih <= 0) return;
  const scale = Math.max(FIELD.width / iw, FIELD.height / ih) * 1.08;
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = (FIELD.width - dw) / 2 + shiftX;
  const dy = (FIELD.height - dh) / 2 + shiftY;
  ctx.drawImage(img, dx, dy, dw, dh);
}

function drawTwinkles(ctx: Ctx, nowMs: number, cameraY: number) {
  ctx.save();
  for (let i = 0; i < 22; i += 1) {
    const x = ((i * 73 + 19) % 97) * (FIELD.width / 97);
    const y =
      (((24 + ((i * 47 + 11) % 79) * 10 - cameraY * 0.12) % FIELD.height) +
        FIELD.height) %
      FIELD.height;
    const pulse = 0.2 + 0.8 * (0.5 + 0.5 * Math.sin(nowMs / 420 + i * 0.9));
    ctx.globalAlpha = pulse;
    ctx.fillStyle = i % 3 === 0 ? COLORS.cream : COLORS.gold;
    ctx.beginPath();
    ctx.arc(x, y, i % 4 === 0 ? 1.7 : 1.15, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawVignette(ctx: Ctx) {
  const gradient = ctx.createRadialGradient(
    CLOCK_CX,
    260,
    40,
    CLOCK_CX,
    300,
    460,
  );
  if (gradient && "addColorStop" in gradient) {
    gradient.addColorStop(0, "rgba(8, 6, 10, 0)");
    gradient.addColorStop(1, "rgba(8, 6, 10, 0.5)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  }
}

function drawHand(
  ctx: Ctx,
  cx: number,
  cy: number,
  angle: number,
  length: number,
  width: number,
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.strokeStyle = "#e8d196";
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

export function clockSize(remainingMs: number): number {
  const urgency =
    1 - Math.min(1, Math.max(0, remainingMs) / JUMP.baseDurationMs);
  return 210 + urgency * 90;
}

function drawClockFace(ctx: Ctx, remainingMs: number, art: GameArt | null) {
  const size = clockSize(remainingMs);
  const cy = 178 + (1 - size / 300) * 20;
  if (art) {
    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.shadowColor = "rgba(201, 162, 77, 0.55)";
    ctx.shadowBlur = 28;
    ctx.drawImage(
      art.clockRing,
      CLOCK_CX - size / 2,
      cy - size / 2,
      size,
      size,
    );
    ctx.restore();
  } else {
    ctx.strokeStyle = COLORS.gold;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(CLOCK_CX, cy, size / 2 - 6, 0, Math.PI * 2);
    ctx.stroke();
  }
  const { hour, minute } = clockAngles(remainingMs, clock.baseDurationMs);
  drawHand(ctx, CLOCK_CX, cy, hour, size * 0.2, 4);
  drawHand(ctx, CLOCK_CX, cy, minute, size * 0.33, 2.4);
  disc(ctx, CLOCK_CX, cy, 5, COLORS.gold);
  disc(ctx, CLOCK_CX, cy, 2.2, COLORS.cream);
}

function windowLit(col: number, row: number, nowMs: number): number {
  const seed = (col * 17 + row * 31) % 11;
  if (seed < 3) return 0.08;
  return 0.45 + 0.35 * (0.5 + 0.5 * Math.sin(nowMs / 700 + seed));
}

function drawTower(ctx: Ctx, cameraY: number, nowMs: number) {
  const wing = 58;
  ctx.fillStyle = "rgba(12, 10, 14, 0.58)";
  ctx.fillRect(0, 0, wing, FIELD.height);
  ctx.fillRect(FIELD.width - wing, 0, wing, FIELD.height);
  ctx.strokeStyle = "rgba(201, 162, 77, 0.7)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(wing, 0);
  ctx.lineTo(wing, FIELD.height);
  ctx.moveTo(FIELD.width - wing, 0);
  ctx.lineTo(FIELD.width - wing, FIELD.height);
  ctx.stroke();
  const step = 38;
  const first = Math.floor(cameraY / step) * step;
  for (
    let worldY = first;
    worldY < cameraY + FIELD.height + step;
    worldY += step
  ) {
    const y = screenY(worldY, cameraY);
    const row = Math.round(worldY / step);
    for (let col = 0; col < 2; col += 1) {
      const leftX = 10 + col * 22;
      const rightX = FIELD.width - wing + 10 + col * 22;
      const glow = windowLit(col, row, nowMs);
      ctx.fillStyle = `rgba(232, 209, 150, ${glow})`;
      ctx.fillRect(leftX, y + 8, 16, 20);
      ctx.fillRect(rightX, y + 8, 16, 20);
      ctx.strokeStyle = "rgba(201, 162, 77, 0.4)";
      ctx.lineWidth = 1;
      ctx.strokeRect(leftX, y + 8, 16, 20);
      ctx.strokeRect(rightX, y + 8, 16, 20);
    }
    if (row % 5 === 0) {
      ctx.fillStyle = COLORS.gold;
      ctx.fillRect(0, y + 2, wing + 8, 5);
      ctx.fillRect(FIELD.width - wing - 8, y + 2, wing + 8, 5);
      ctx.fillRect(wing, y + 3, FIELD.width - wing * 2, 2);
    }
  }
}

function drawLedge(ctx: Ctx, x: number, y: number, width: number) {
  ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
  ctx.fillRect(x + 6, y + 6, width - 4, 10);
  ctx.fillStyle = "#3a2d1c";
  ctx.fillRect(x, y, width, JUMP.floorThicknessPx);
  ctx.fillStyle = COLORS.gold;
  ctx.fillRect(x, y, width, 5);
  ctx.fillRect(x, y + JUMP.floorThicknessPx - 3, width, 3);
  for (let i = x + 4; i < x + width - 6; i += 12) {
    ctx.fillRect(i, y + 6, 7, 5);
  }
  disc(ctx, x, y + 2, 5, COLORS.gold);
  disc(ctx, x + width, y + 2, 5, COLORS.gold);
}

function drawTray(ctx: Ctx, x: number, y: number, width: number) {
  const cx = x + width / 2;
  ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
  ctx.fillRect(x + 8, y + 8, width - 8, 10);
  ctx.fillStyle = "#2c2218";
  ctx.fillRect(cx - 6, y, 12, 16);
  ctx.fillStyle = "#3a2d1c";
  ctx.fillRect(x, y, width, JUMP.floorThicknessPx);
  ctx.fillStyle = COLORS.gold;
  ctx.fillRect(x, y, width, 5);
  ctx.fillRect(x, y + JUMP.floorThicknessPx - 3, width, 3);
  ctx.strokeStyle = "#e8d196";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(cx, y + 1, width / 2 - 8, 5, 0, 0, Math.PI * 2);
  ctx.stroke();
  disc(ctx, x + 8, y + 2, 3.5, COLORS.gold);
  disc(ctx, x + width - 8, y + 2, 3.5, COLORS.gold);
}

function drawChandelier(ctx: Ctx, x: number, y: number, width: number) {
  const cx = x + width / 2;
  ctx.strokeStyle = COLORS.gold;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(cx, y - 70);
  ctx.lineTo(cx, y);
  ctx.moveTo(cx, y - 36);
  ctx.lineTo(x + 10, y - 4);
  ctx.moveTo(cx, y - 36);
  ctx.lineTo(x + width - 10, y - 4);
  ctx.stroke();
  drawLedge(ctx, x, y, width);
  disc(ctx, x + 10, y - 4, 4, COLORS.cream);
  disc(ctx, cx, y - 36, 5, COLORS.cream);
  disc(ctx, x + width - 10, y - 4, 4, COLORS.cream);
  ctx.shadowColor = "rgba(243, 238, 230, 0.65)";
  ctx.shadowBlur = 12;
  disc(ctx, cx, y - 8, 3.5, COLORS.cream);
  ctx.shadowBlur = 0;
}

const FLOOR_DRAWERS: Record<
  FloorKind,
  (ctx: Ctx, x: number, y: number, width: number) => void
> = {
  ledge: drawLedge,
  tray: drawTray,
  chandelier: drawChandelier,
};

function drawFloors(ctx: Ctx, floors: readonly Floor[], cameraY: number) {
  for (const floor of floors) {
    const y = screenY(floor.y, cameraY);
    if (y < -40 || y > FIELD.height + 40) continue;
    FLOOR_DRAWERS[floor.kind](ctx, floor.x, y, floor.width);
  }
}

function drawGlass(ctx: Ctx, x: number, y: number) {
  ctx.fillStyle = COLORS.cream;
  ctx.beginPath();
  ctx.moveTo(x - 10, y - 16);
  ctx.lineTo(x + 10, y - 16);
  ctx.lineTo(x + 4, y + 2);
  ctx.lineTo(x - 4, y + 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(x - 2, y + 2, 4, 10);
  ctx.fillStyle = COLORS.gold;
  ctx.fillRect(x - 8, y + 12, 16, 3);
}

function drawStar(ctx: Ctx, x: number, y: number) {
  ctx.fillStyle = COLORS.gold;
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const radius = i % 2 === 0 ? 12 : 6;
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    ctx.lineTo(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius);
  }
  ctx.closePath();
  ctx.fill();
}

function drawClockItem(ctx: Ctx, x: number, y: number) {
  disc(ctx, x, y, 12, COLORS.cream);
  disc(ctx, x, y, 8, COLORS.dark);
  ctx.strokeStyle = COLORS.gold;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y - 6);
  ctx.lineTo(x, y);
  ctx.lineTo(x + 5, y);
  ctx.stroke();
}

function drawItemSprite(
  ctx: Ctx,
  img: CanvasImageSource & { width: number; height: number },
  x: number,
  y: number,
  size: number,
) {
  if (img.width <= 0 || img.height <= 0) return false;
  const scale = size / Math.max(img.width, img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.drawImage(img, x - w / 2, y - h / 2, w, h);
  return true;
}

function pickupSprite(art: GameArt, kind: Pickup["kind"]) {
  if (kind === "glass") return art.itemGlass;
  if (kind === "star") return art.itemStar;
  return art.itemClock;
}

function drawPickupShape(ctx: Ctx, kind: Pickup["kind"], x: number, y: number) {
  if (kind === "glass") drawGlass(ctx, x, y);
  else if (kind === "star") drawStar(ctx, x, y);
  else drawClockItem(ctx, x, y);
}

function drawPickups(
  ctx: Ctx,
  pickups: readonly Pickup[],
  cameraY: number,
  art: GameArt | null,
) {
  for (const item of pickups) {
    const y = screenY(item.y, cameraY);
    if (
      art &&
      drawItemSprite(ctx, pickupSprite(art, item.kind), item.x, y, 44)
    ) {
      continue;
    }
    drawPickupShape(ctx, item.kind, item.x, y);
  }
}

function drawHazard(
  ctx: Ctx,
  hazard: Hazard,
  cameraY: number,
  art: GameArt | null,
) {
  const y = screenY(hazard.y, cameraY);
  if (art && drawItemSprite(ctx, art.itemObstacle, hazard.x, y, 46)) return;
  ctx.save();
  ctx.shadowColor = "rgba(225, 6, 0, 0.55)";
  ctx.shadowBlur = 10;
  disc(ctx, hazard.x, y, 12, "#4a0c0c");
  ctx.restore();
  ctx.strokeStyle = COLORS.gold;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(hazard.x, y, 12, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(hazard.x, y, 7, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = COLORS.red;
  ctx.beginPath();
  ctx.moveTo(hazard.x, y - 5);
  ctx.lineTo(hazard.x + 4, y);
  ctx.lineTo(hazard.x, y + 5);
  ctx.lineTo(hazard.x - 4, y);
  ctx.closePath();
  ctx.fill();
}

function drawFallbackCouple(ctx: Ctx, x: number, y: number) {
  ctx.fillStyle = COLORS.cream;
  ctx.beginPath();
  ctx.ellipse(x - 16, y - 40, 14, 38, 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLORS.gold;
  ctx.beginPath();
  ctx.ellipse(x + 16, y - 40, 14, 38, -0.15, 0, Math.PI * 2);
  ctx.fill();
  disc(ctx, x - 12, y - 90, 11, COLORS.cream);
  disc(ctx, x + 12, y - 90, 11, COLORS.gold);
}

function couplePose(art: GameArt, moveDir: -1 | 0 | 1, airborne: boolean) {
  if (airborne) return art.coupleCatch;
  if (moveDir < 0) return art.coupleLeft;
  if (moveDir > 0) return art.coupleRight;
  return art.coupleIdle;
}

function coupleBob(nowMs: number, moveDir: -1 | 0 | 1, airborne: boolean) {
  if (airborne) return -2;
  if (moveDir !== 0) return Math.sin(nowMs / 90) * 3;
  return 0;
}

function drawCoupleSprite(
  ctx: Ctx,
  art: GameArt,
  x: number,
  y: number,
  nowMs: number,
  moveDir: -1 | 0 | 1,
  airborne: boolean,
) {
  const img = couplePose(art, moveDir, airborne);
  const scale = COUPLE_HEIGHT / img.height;
  const tw = img.width * scale;
  const th = img.height * scale;
  const lean = moveDir * (airborne ? 0.02 : 0.08);
  ctx.save();
  ctx.translate(x, y + coupleBob(nowMs, moveDir, airborne));
  ctx.rotate(lean);
  ctx.shadowColor = "rgba(201, 162, 77, 0.55)";
  ctx.shadowBlur = 16;
  ctx.drawImage(img, -tw / 2, -th, tw, th);
  ctx.restore();
}

function drawPlayer(
  ctx: Ctx,
  art: GameArt | null,
  x: number,
  y: number,
  nowMs: number,
  moveDir: -1 | 0 | 1,
  airborne: boolean,
) {
  if (art) drawCoupleSprite(ctx, art, x, y, nowMs, moveDir, airborne);
  else drawFallbackCouple(ctx, x, y);
}

function readJumpView(view: JumpView, state: JumpState) {
  return {
    nowMs: view.nowMs ?? 0,
    moveDir: view.moveDir ?? 0,
    airborne: view.airborne ?? state.onFloorId === null,
    art: view.art ?? null,
  };
}

function drawPop(ctx: Ctx, pop: Pop, cameraY: number) {
  const progress = pop.ageMs / FEEDBACK.popMs;
  ctx.globalAlpha = 1 - progress;
  ctx.fillStyle = COLORS.gold;
  ctx.fillText(
    `+${pop.points}`,
    pop.x,
    screenY(pop.y, cameraY) - progress * FEEDBACK.popRisePx,
  );
}

function drawPops(ctx: Ctx, pops: readonly Pop[], cameraY: number) {
  ctx.save();
  ctx.font = "bold 28px Cinzel, Georgia, serif";
  ctx.textAlign = "center";
  ctx.shadowColor = "rgba(0, 0, 0, 0.65)";
  ctx.shadowBlur = 6;
  for (const pop of pops) drawPop(ctx, pop, cameraY);
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

function drawHud(
  ctx: Ctx,
  state: JumpState,
  labels: JumpLabels,
  nowMs: number,
) {
  ctx.save();
  ctx.fillStyle = COLORS.cream;
  ctx.font = "18px Cinzel, Georgia, serif";
  ctx.textAlign = "left";
  ctx.shadowColor = "rgba(0, 0, 0, 0.75)";
  ctx.shadowBlur = 6;
  ctx.fillText(`${labels.score}: ${state.score}`, 16, 32);
  ctx.font = "16px Cinzel, Georgia, serif";
  ctx.fillText(formatClock(state.remainingMs), 16, 56);
  ctx.textAlign = "right";
  ctx.fillStyle = COLORS.gold;
  const factor = formatFactor(slowFactor(state.streak));
  if (state.streak > 0) {
    ctx.fillText(`${labels.combo} ${state.streak}`, FIELD.width - 16, 32);
    if (factor) ctx.fillText(factor, FIELD.width - 16, 54);
  } else if (factor) {
    ctx.fillText(factor, FIELD.width - 16, 32);
  }
  const mid = (JUMP.scrollMinPxPerSec + JUMP.scrollMaxPxPerSec) / 2;
  if (jumpScrollSpeed(state.remainingMs) >= mid) {
    ctx.textAlign = "center";
    ctx.globalAlpha = 0.85 + 0.15 * (0.5 + 0.5 * Math.sin(nowMs / 180));
    ctx.font = "18px Cinzel, Georgia, serif";
    ctx.fillText(labels.faster, CLOCK_CX, FIELD.height - 28);
  }
  ctx.restore();
}

function drawBackdrop(
  ctx: Ctx,
  art: GameArt | null,
  playerX: number,
  cameraY: number,
  nowMs: number,
) {
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  if (art) {
    const shiftX = ((playerX - FIELD.width / 2) / FIELD.width) * -16;
    const shiftY = (cameraY % 80) * 0.08;
    drawCover(ctx, art.skyline, shiftX, shiftY);
  }
  drawTwinkles(ctx, nowMs, cameraY);
  drawTower(ctx, cameraY, nowMs);
  drawVignette(ctx);
}

export function drawJumpFrame(
  ctx: Ctx,
  state: JumpState,
  fx: Effects,
  labels: JumpLabels,
  view: JumpView = {},
): void {
  const shot = readJumpView(view, state);
  drawBackdrop(ctx, shot.art, state.playerX, state.cameraY, shot.nowMs);
  drawClockFace(ctx, state.remainingMs, shot.art);
  drawFloors(ctx, state.floors, state.cameraY);
  drawPickups(ctx, state.pickups, state.cameraY, shot.art);
  for (const hazard of state.hazards)
    drawHazard(ctx, hazard, state.cameraY, shot.art);
  drawPlayer(
    ctx,
    shot.art,
    state.playerX,
    screenY(state.playerY, state.cameraY),
    shot.nowMs,
    shot.moveDir,
    shot.airborne,
  );
  drawPops(ctx, fx.pops, state.cameraY);
  flash(ctx, COLORS.cream, fx.flashMs, FEEDBACK.flashMs);
  flash(ctx, COLORS.red, fx.hitMs, FEEDBACK.hitMs);
  pulse(ctx, fx.pulseMs);
  drawHud(ctx, state, labels, shot.nowMs);
}
