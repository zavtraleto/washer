/**
 * Game event type definitions for type-safe EventBus usage.
 */

export const GameEvents = {
  /** Fired when cleaning progress updates. Payload: clean percentage (0-100). */
  PROGRESS: 'PROGRESS',

  /** Fired when win condition is met (≥95% clean). No payload. */
  WIN: 'WIN',

  /** Fired when user clicks Restart button. No payload. */
  RESTART: 'RESTART',

  /** Fired when user clicks Next button after winning. No payload. */
  NEXT: 'NEXT',
} as const;

export type GameEventType = (typeof GameEvents)[keyof typeof GameEvents];

/** Type-safe event payload mapping. */
export interface GameEventPayloads {
  [GameEvents.PROGRESS]: number; // clean percentage
  [GameEvents.WIN]: void;
  [GameEvents.RESTART]: void;
  [GameEvents.NEXT]: void;
}
