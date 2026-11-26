export type ItemKind = "glass" | "star" | "clock" | "obstacle";

export interface Item {
  readonly id: number;
  readonly kind: ItemKind;
  /** Floor lane, from 0 (left) to DEPTH.lanes - 1 (right). */
  readonly lane: number;
  /** Depth: 0 at the horizon, 1 at the catch line, above 1 past the couple. */
  readonly z: number;
  /** Projected screen x, from lane and z. */
  readonly x: number;
  /** Projected screen y, from z. */
  readonly y: number;
}

export type GameEvent =
  | {
      readonly kind: "catch";
      readonly item: Exclude<ItemKind, "obstacle">;
      readonly x: number;
      readonly y: number;
      readonly points: number;
      readonly streak: number;
      readonly factor: number;
    }
  | { readonly kind: "hit"; readonly x: number; readonly y: number };

export type EndReason = "midnight" | "wallClock";

export interface GameState {
  readonly status: "playing" | "ended";
  readonly endReason: EndReason | null;
  readonly playerX: number;
  readonly items: readonly Item[];
  readonly score: number;
  readonly streak: number;
  /** Game time left until midnight, in milliseconds. */
  readonly remainingMs: number;
  /** Real time since the round began, in milliseconds. */
  readonly elapsedRealMs: number;
  readonly spawnTimerMs: number;
  readonly nextId: number;
  /** Events of the last step. The feedback layer reads them. */
  readonly events: readonly GameEvent[];
}

export interface InputState {
  /** Keyboard direction: -1 left, 0 none, 1 right. */
  readonly dir: -1 | 0 | 1;
  /** Horizontal drag since the last read, in field pixels. 0 when idle. */
  readonly dragDx: number;
}
