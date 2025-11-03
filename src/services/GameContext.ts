/**
 * GameContext — centralized game state management.
 * Single source of truth for game-level state (seed, coverage, win status).
 * Provides state transitions and observable state changes.
 */

import type { DirtLayerId } from '../types/config';

export type GameState = 'playing' | 'won' | 'restarting';

export interface GameContextState {
  seed: number;
  coverage: Record<DirtLayerId, number>;
  won: boolean;
  state: GameState;
}

type StateChangeListener = (state: GameContextState) => void;

export class GameContext {
  private state: GameContextState;
  private listeners = new Set<StateChangeListener>();

  constructor(initialSeed: number, coverage: Record<DirtLayerId, number>) {
    this.state = {
      seed: initialSeed,
      coverage: { ...coverage },
      won: false,
      state: 'playing',
    };
  }

  /**
   * Get current game state (immutable snapshot).
   */
  getState(): Readonly<GameContextState> {
    return { ...this.state };
  }

  /**
   * Get current seed.
   */
  getSeed(): number {
    return this.state.seed;
  }

  /**
   * Get current coverage config.
   */
  getCoverage(): Readonly<Record<DirtLayerId, number>> {
    return { ...this.state.coverage };
  }

  /**
   * Check if player has won.
   */
  isWon(): boolean {
    return this.state.won;
  }

  /**
   * Get current game state.
   */
  getGameState(): GameState {
    return this.state.state;
  }

  /**
   * Transition to 'won' state.
   */
  setWon(): void {
    if (this.state.won) return; // Prevent double-trigger.
    this.state.won = true;
    this.state.state = 'won';
    this.notifyListeners();
  }

  /**
   * Reset with current seed (restart).
   */
  reset(): void {
    this.state.won = false;
    this.state.state = 'playing';
    this.notifyListeners();
  }

  /**
   * Generate new seed and reset (next level).
   */
  nextLevel(): void {
    const randomOffset = Math.floor(Math.random() * 0xffff) + 1;
    this.state.seed = Math.max(1, (Date.now() & 0xffff) ^ randomOffset);
    this.state.won = false;
    this.state.state = 'playing';
    this.notifyListeners();
  }

  /**
   * Set custom seed (for testing/debugging).
   */
  setSeed(seed: number): void {
    this.state.seed = Math.max(1, seed);
    this.notifyListeners();
  }

  /**
   * Update coverage config.
   */
  setCoverage(coverage: Record<DirtLayerId, number>): void {
    this.state.coverage = { ...coverage };
    this.notifyListeners();
  }

  /**
   * Subscribe to state changes.
   */
  onChange(listener: StateChangeListener): void {
    this.listeners.add(listener);
  }

  /**
   * Unsubscribe from state changes.
   */
  offChange(listener: StateChangeListener): void {
    this.listeners.delete(listener);
  }

  /**
   * Notify all listeners of state change.
   */
  private notifyListeners(): void {
    const snapshot = this.getState();
    this.listeners.forEach((listener) => listener(snapshot));
  }
}
