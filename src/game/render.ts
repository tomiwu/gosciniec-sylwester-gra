import { COLORS, CLOCK, DEPTH, FEEDBACK, FIELD, slowFactor } from "../config";
import { floorEdges, itemScale } from "./depth";
import type { GameArt } from "./art";
import type { Effects, Pop, Spark } from "./effects";
import type { GameState, Item, ItemKind } from "./types";

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
  | "strokeText"
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
  | "scale"
  | "createRadialGradient"
  | "createLinearGradient"
  | "clip"
>;

export type PoseId = "idle" | "left" | "right" | "catch";

export interface Labels {
  readonly score: string;
  readonly time: string;
}

export interface View {
  readonly nowMs?: number;
  readonly moveDir?: -1 | 0 | 1;
  readonly catchAgeMs?: number;
  readonly pose?: PoseId;
  readonly prevPose?: PoseId;
  readonly blend?: number;
  readonly lean?: number;
  readonly spinRad?: number;
  readonly art?: GameArt | null;
}

function defaultPose(moveDir: -1 | 0 | 1, catchAgeMs: number): PoseId {
  if (catchAgeMs < FEEDBACK.catchPoseMs) return "catch";
  if (moveDir < 0) return "left";
  if (moveDir > 0) return "right";
  return "idle";
}

function pick<T>(value: T | undefined, fallback: T): T {
  if (value === undefined) return fallback;
  return value;
}

function readView(view: View): {
  nowMs: number;
  moveDir: -1 | 0 | 1;
  catchAgeMs: number;
  pose: PoseId;
  prevPose: PoseId;
  blend: number;
  lean: number;
  spinRad: number;
  art: GameArt | null;
} {
  const moveDir = pick(view.moveDir, 0);
  const catchAgeMs = pick(view.catchAgeMs, 10_000);
  const pose = pick(view.pose, defaultPose(moveDir, catchAgeMs));
  return {
    nowMs: pick(view.nowMs, 0),
    moveDir,
    catchAgeMs,
    pose,
    prevPose: pick(view.prevPose, pose),
    blend: pick(view.blend, 1),
    lean: pick(view.lean, moveDir * 0.14),
    spinRad: pick(view.spinRad, 0),
    art: pick(view.art, null),
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

function itemSprite(art: GameArt, kind: ItemKind): HTMLImageElement {
  if (kind === "glass") return art.itemGlass;
  if (kind === "star") return art.itemStar;
  if (kind === "clock") return art.itemClock;
  return art.itemObstacle;
}

function drawContained(
  ctx: Ctx,
  img: CanvasImageSource & { width: number; height: number },
  size: number,
) {
  const scale = size / Math.max(img.width, img.height);
  const tw = img.width * scale;
  const th = img.height * scale;
  ctx.drawImage(img, -tw / 2, -th / 2, tw, th);
}

function drawFallingItem(
  ctx: Ctx,
  art: GameArt | null,
  item: Item,
  nowMs: number,
) {
  ctx.save();
  ctx.translate(item.x, item.y);
  ctx.rotate(Math.sin(nowMs / 240 + item.id) * 0.14);
  if (art) {
    const collect = item.kind !== "obstacle";
    const size = itemScale(item.z) * (collect ? 1 : 1.12);
    ctx.shadowColor = collect
      ? "rgba(201, 162, 77, 0.7)"
      : "rgba(80, 0, 16, 0.7)";
    ctx.shadowBlur = collect ? 10 + size / 8 : 8 + size / 10;
    drawContained(ctx, itemSprite(art, item.kind), size);
  } else {
    const s = itemScale(item.z) / (R * 2);
    ctx.scale(s, s);
    ITEM_DRAWERS[item.kind](ctx, 0, 0);
  }
  ctx.restore();
}

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

function coupleImage(art: GameArt, pose: PoseId): HTMLImageElement {
  if (pose === "left") return art.coupleLeft;
  if (pose === "right") return art.coupleRight;
  if (pose === "catch") return art.coupleCatch;
  return art.coupleIdle;
}

function drawPoseSprite(
  ctx: Ctx,
  img: HTMLImageElement,
  alpha: number,
  pop: number,
) {
  const scale = (COUPLE_HEIGHT * pop) / img.height;
  const tw = img.width * scale;
  const th = img.height * scale;
  const pivot = th * 0.58;
  ctx.globalAlpha = alpha;
  ctx.drawImage(img, -tw / 2, -th + pivot, tw, th);
}

function coupleFeel(pose: PoseId, moveDir: -1 | 0 | 1) {
  if (pose === "catch") return { swayAmt: 0.018, bob: 3.4, pop: 1.05 };
  if (moveDir !== 0) return { swayAmt: 0.018, bob: 2, pop: 1 };
  return { swayAmt: 0.035, bob: 2, pop: 1 };
}

function drawCoupleLayers(
  ctx: Ctx,
  art: GameArt,
  shot: ReturnType<typeof readView>,
  pop: number,
) {
  if (shot.blend < 1 && shot.prevPose !== shot.pose) {
    drawPoseSprite(ctx, coupleImage(art, shot.prevPose), 1 - shot.blend, pop);
    drawPoseSprite(ctx, coupleImage(art, shot.pose), shot.blend, pop);
    return;
  }
  drawPoseSprite(ctx, coupleImage(art, shot.pose), 1, pop);
}

function drawCoupleSprite(
  ctx: Ctx,
  art: GameArt,
  x: number,
  nowMs: number,
  shot: ReturnType<typeof readView>,
) {
  const feel = coupleFeel(shot.pose, shot.moveDir);
  const sway = Math.sin(nowMs / 430) * feel.swayAmt;
  const bob = Math.sin(nowMs / 300) * feel.bob;
  const pivot = COUPLE_HEIGHT * feel.pop * 0.58;
  ctx.save();
  ctx.translate(x, COUPLE_FOOT_Y + bob - pivot);
  ctx.rotate(sway + shot.lean + shot.spinRad);
  drawCoupleLayers(ctx, art, shot, feel.pop);
  ctx.restore();
}

function drawPop(ctx: Ctx, pop: Pop) {
  const t = pop.ageMs / FEEDBACK.popMs;
  const rise = t * FEEDBACK.popRisePx;
  const scale = 1.18 - t * 0.28;
  const fade = t < 0.72 ? 1 : 1 - (t - 0.72) / 0.28;
  ctx.save();
  ctx.globalAlpha = fade;
  ctx.translate(pop.x, pop.y - rise);
  ctx.scale(scale, scale);
  ctx.font = "700 26px 'GFS Didot', Georgia, serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(0, 0, 0, 0.75)";
  ctx.shadowBlur = 8;
  ctx.lineWidth = 3;
  ctx.strokeStyle = COLORS.gold;
  ctx.fillStyle = COLORS.cream;
  const text = `+${pop.points}`;
  ctx.strokeText(text, 0, 0);
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

function drawSpark(ctx: Ctx, spark: Spark) {
  const t = spark.ageMs / spark.lifeMs;
  const size = spark.size * (1.15 - t * 0.45);
  ctx.save();
  ctx.globalAlpha = 1 - t;
  ctx.translate(spark.x, spark.y);
  ctx.rotate(t * 0.9);
  ctx.fillStyle = spark.hue === "gold" ? COLORS.gold : COLORS.cream;
  ctx.shadowColor = COLORS.gold;
  ctx.shadowBlur = 8;
  ctx.beginPath();
  for (let i = 0; i < 8; i += 1) {
    const radius = i % 2 === 0 ? size : size * 0.35;
    const angle = (Math.PI / 4) * i - Math.PI / 2;
    ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawPops(ctx: Ctx, pops: readonly Pop[]) {
  for (const pop of pops) drawPop(ctx, pop);
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

function floorFill(ctx: Ctx) {
  const top = floorEdges(DEPTH.horizonY);
  ctx.beginPath();
  ctx.moveTo(top.left, DEPTH.horizonY);
  ctx.lineTo(top.right, DEPTH.horizonY);
  ctx.lineTo(FIELD.width, FIELD.height);
  ctx.lineTo(0, FIELD.height);
  ctx.closePath();
  const gradient = ctx.createLinearGradient(
    FIELD.width / 2,
    DEPTH.horizonY,
    FIELD.width / 2,
    FIELD.height,
  );
  if (gradient && "addColorStop" in gradient) {
    gradient.addColorStop(0, "rgba(18, 12, 16, 0.12)");
    gradient.addColorStop(0.4, "rgba(28, 18, 20, 0.38)");
    gradient.addColorStop(1, "rgba(42, 28, 18, 0.78)");
    ctx.fillStyle = gradient;
  } else {
    ctx.fillStyle = "rgba(28, 18, 20, 0.4)";
  }
  ctx.fill();
}

function laneLines(ctx: Ctx) {
  ctx.strokeStyle = "rgba(201, 162, 77, 0.32)";
  ctx.lineWidth = 1.2;
  for (let i = 0; i <= DEPTH.lanes; i += 1) {
    const u = i / DEPTH.lanes;
    const frontX = u * FIELD.width;
    ctx.beginPath();
    ctx.moveTo(DEPTH.vanishX, DEPTH.vanishY);
    ctx.lineTo(frontX, FIELD.height);
    ctx.stroke();
  }
}

function depthLines(ctx: Ctx) {
  ctx.strokeStyle = "rgba(201, 162, 77, 0.16)";
  ctx.lineWidth = 1;
  const steps = [0.35, 0.6, 0.85];
  for (const z of steps) {
    const y = DEPTH.horizonY + z * (FIELD.height - DEPTH.horizonY);
    if (y < DEPTH.horizonY) continue;
    const { left, right } = floorEdges(y);
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
    ctx.stroke();
  }
}

function clipFloor(ctx: Ctx) {
  const top = floorEdges(DEPTH.horizonY);
  ctx.beginPath();
  ctx.moveTo(top.left, DEPTH.horizonY);
  ctx.lineTo(top.right, DEPTH.horizonY);
  ctx.lineTo(FIELD.width, FIELD.height);
  ctx.lineTo(0, FIELD.height);
  ctx.closePath();
  ctx.clip();
}

function catchLine(ctx: Ctx) {
  const { left, right } = floorEdges(FIELD.playerY);
  ctx.strokeStyle = "rgba(201, 162, 77, 0.55)";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(left, FIELD.playerY);
  ctx.lineTo(right, FIELD.playerY);
  ctx.stroke();
}

function drawFloor(ctx: Ctx) {
  ctx.save();
  floorFill(ctx);
  clipFloor(ctx);
  laneLines(ctx);
  depthLines(ctx);
  catchLine(ctx);
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
  drawFloor(ctx);
  const nearFirst = [...state.items].sort((a, b) => a.z - b.z);
  for (const item of nearFirst)
    drawFallingItem(ctx, shot.art, item, shot.nowMs);
  if (shot.art) {
    drawCoupleSprite(ctx, shot.art, state.playerX, shot.nowMs, shot);
  } else {
    drawFallbackCouple(ctx, state.playerX);
  }
  for (const spark of fx.sparks) drawSpark(ctx, spark);
  drawPops(ctx, fx.pops);
  flash(ctx, COLORS.cream, fx.flashMs, FEEDBACK.flashMs);
  flash(ctx, COLORS.red, fx.hitMs, FEEDBACK.hitMs);
  pulse(ctx, fx.pulseMs);
  drawHud(ctx, state, labels);
}
