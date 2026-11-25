import type { ItemKind } from "../game/types";

export type FloorKind = "ledge" | "chandelier" | "tray";

export interface Floor {
  readonly id: number;
  readonly index: number;
  readonly kind: FloorKind;
  readonly x: number;
  readonly y: number;
  readonly width: number;
}

export interface Pickup {
  readonly id: number;
  readonly kind: Exclude<ItemKind, "obstacle">;
  readonly x: number;
  readonly y: number;
  readonly floorId: number;
}

export interface Hazard {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly floorId: number;
}

export type JumpEndReason = "midnight" | "wallClock";

export interface JumpState {
  readonly status: "playing" | "ended";
  readonly endReason: JumpEndReason | null;
  readonly playerX: number;
  readonly playerY: number;
  readonly vx: number;
  readonly vy: number;
  readonly onFloorId: number | null;
  readonly lastFloorIndex: number;
  readonly floors: readonly Floor[];
  readonly pickups: readonly Pickup[];
  readonly hazards: readonly Hazard[];
  readonly score: number;
  readonly streak: number;
  readonly remainingMs: number;
  readonly elapsedRealMs: number;
  readonly cameraY: number;
  readonly nextId: number;
  readonly events: readonly import("../game/types").GameEvent[];
  readonly jumpBufferMs: number;
  readonly coyoteMs: number;
  readonly invulnMs: number;
}

export interface JumpInputState {
  /** Analog run axis from -1 (left) to 1 (right). 0 means no run input. */
  readonly axis: number;
  /** True while the jump control is held. */
  readonly jumpDown: boolean;
  /** True on the frame the jump control was pressed. */
  readonly jumpPressed: boolean;
}
