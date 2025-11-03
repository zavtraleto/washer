/**
 * Game event type definitions for type-safe EventBus usage.
 */

// UI/Lifecycle events (cross-scene communication)
export const GameEvents = {
  /** Fired when cleaning progress updates. Payload: clean percentage (0-100). */
  PROGRESS: 'PROGRESS',

  /** Fired when win condition is met (≥95% clean). No payload. */
  WIN: 'WIN',

  /** Fired when user clicks Restart button. No payload. */
  RESTART: 'RESTART',

  /** Fired when user clicks Next button after winning. No payload. */
  NEXT: 'NEXT',

  /** Fired when user switches tools. Payload: tool id ('scrubber' | 'powerwash'). */
  SWITCH_TOOL: 'SWITCH_TOOL',
} as const;

// Gameplay events (within-scene mechanics)
export const GameplayEvents = {
  /** Fired when a cleaning stamp is applied. Payload: stamp details. */
  STAMP_APPLIED: 'STAMP_APPLIED',

  /** Fired when dirt is cleared from an area. Payload: clear details. */
  DIRT_CLEARED: 'DIRT_CLEARED',
} as const;

export type GameEventType = (typeof GameEvents)[keyof typeof GameEvents];
export type GameplayEventType =
  (typeof GameplayEvents)[keyof typeof GameplayEvents];

/** Stamp applied event payload. */
export interface StampAppliedPayload {
  worldX: number; // World-space X coordinate of stamp
  worldY: number; // World-space Y coordinate of stamp
  dirX: number; // Direction X (-1 to 1)
  dirY: number; // Direction Y (-1 to 1)
  intensity: number; // Stamp intensity (0.4 to 1.4+)
  dirtValue: number; // Dirt coverage at this location (0 to 1)
}

/** Dirt cleared event payload (future use). */
export interface DirtClearedPayload {
  u: number; // UV X coordinate
  v: number; // UV Y coordinate
  amount: number; // Amount of dirt cleared
}

/** Type-safe event payload mapping for UI events. */
export interface GameEventPayloads {
  [GameEvents.PROGRESS]: number; // clean percentage
  [GameEvents.WIN]: void;
  [GameEvents.RESTART]: void;
  [GameEvents.NEXT]: void;
}

/** Type-safe event payload mapping for gameplay events. */
export interface GameplayEventPayloads {
  [GameplayEvents.STAMP_APPLIED]: StampAppliedPayload;
  [GameplayEvents.DIRT_CLEARED]: DirtClearedPayload;
}
