/**
 * GameEventDispatcher — typed event dispatcher for gameplay events.
 * Wraps EventBus to provide type-safe emit/on methods for game mechanics.
 * Use this for within-scene event communication (e.g., stamp → particles).
 */

import { EventBus } from './EventBus';
import {
  GameplayEvents,
  type StampAppliedPayload,
  type DirtClearedPayload,
} from '../types/events';

export class GameEventDispatcher {
  private eventBus: EventBus;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  // === STAMP_APPLIED event ===

  /**
   * Emit STAMP_APPLIED event when a cleaning stamp is applied.
   */
  emitStampApplied(payload: StampAppliedPayload): void {
    this.eventBus.emit(GameplayEvents.STAMP_APPLIED, payload);
  }

  /**
   * Listen for STAMP_APPLIED events.
   */
  onStampApplied(
    handler: (payload: StampAppliedPayload) => void,
    context?: any,
  ): void {
    this.eventBus.on(GameplayEvents.STAMP_APPLIED, handler, context);
  }

  /**
   * Stop listening for STAMP_APPLIED events.
   */
  offStampApplied(handler: (payload: StampAppliedPayload) => void): void {
    this.eventBus.off(GameplayEvents.STAMP_APPLIED, handler);
  }

  // === DIRT_CLEARED event (future use) ===

  /**
   * Emit DIRT_CLEARED event when dirt is removed.
   */
  emitDirtCleared(payload: DirtClearedPayload): void {
    this.eventBus.emit(GameplayEvents.DIRT_CLEARED, payload);
  }

  /**
   * Listen for DIRT_CLEARED events.
   */
  onDirtCleared(
    handler: (payload: DirtClearedPayload) => void,
    context?: any,
  ): void {
    this.eventBus.on(GameplayEvents.DIRT_CLEARED, handler, context);
  }

  /**
   * Stop listening for DIRT_CLEARED events.
   */
  offDirtCleared(handler: (payload: DirtClearedPayload) => void): void {
    this.eventBus.off(GameplayEvents.DIRT_CLEARED, handler);
  }

  /**
   * Clear all gameplay event listeners.
   */
  clearAll(): void {
    this.eventBus.clear(GameplayEvents.STAMP_APPLIED);
    this.eventBus.clear(GameplayEvents.DIRT_CLEARED);
  }
}
