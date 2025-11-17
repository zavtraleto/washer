/**
 * Game event constants for Phaser event system.
 * Use with scene.game.events (cross-scene) or scene.events (within-scene).
 */

export const GameEvents = {
  // Cross-scene events (use with this.game.events)
  /** Fired when cleaning progress updates. Payload: clean percentage (0-100). */
  PROGRESS: 'game:progress',

  /** Fired when win condition is met (≥95% clean). No payload. */
  WIN: 'game:win',

  /** Fired when user clicks Restart button. No payload. */
  RESTART: 'game:restart',

  /** Fired when user clicks Next button after winning. No payload. */
  NEXT: 'game:next',

  /** Fired when user switches tools. Payload: tool id ('scrubber' | 'powerwash'). */
  SWITCH_TOOL: 'game:switch-tool',

  // Within-scene events (use with this.events or custom EventEmitter)
  /** Fired when a cleaning stamp is applied. Payload: stamp details. */
  STAMP_APPLIED: 'stamp:applied',

  /** Fired when dirt is cleared from an area. Payload: clear details. */
  DIRT_CLEARED: 'dirt:cleared',
} as const;

export type GameEventType = (typeof GameEvents)[keyof typeof GameEvents];

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
  [GameEvents.STAMP_APPLIED]: StampAppliedPayload;
  [GameEvents.DIRT_CLEARED]: DirtClearedPayload;
}
