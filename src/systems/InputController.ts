/**
 * InputController — coordinates pointer input with tilt and tool systems.
 * Centralizes input state checks (won, active) and delegates to specialized systems.
 */

import type { TiltController } from './TiltController';
import type { ITool } from '../types/tools';

export class InputController {
  private inputActive = false;
  private locked = false; // Lock input after win or during state transitions.

  constructor(
    private tiltController: TiltController,
    private tool: ITool,
  ) {}

  /**
   * Handle pointer press event.
   * @param x - World X coordinate.
   * @param y - World Y coordinate.
   * @param t - Timestamp in milliseconds.
   */
  handleDown(x: number, y: number, t: number): void {
    if (this.locked) return;

    this.inputActive = true;
    this.tiltController.startInteraction();
    this.tool.handleDown(x, y, t);
  }

  /**
   * Handle pointer move event.
   * @param x - World X coordinate.
   * @param y - World Y coordinate.
   * @param t - Timestamp in milliseconds.
   */
  handleMove(x: number, y: number, t: number): void {
    if (this.locked) return;

    this.tool.handleMove(x, y, t);
  }

  /**
   * Handle pointer release event.
   * @param x - World X coordinate.
   * @param y - World Y coordinate.
   * @param t - Timestamp in milliseconds.
   */
  handleUp(x: number, y: number, t: number): void {
    if (this.locked) return;

    this.inputActive = false;
    this.tiltController.endInteraction();
    this.tool.handleUp(x, y, t);
  }

  /**
   * Lock input (e.g., during win state or transitions).
   */
  lock(): void {
    this.locked = true;
    if (this.inputActive) {
      // Force end any active interaction.
      this.inputActive = false;
      this.tiltController.endInteraction();
      this.tool.deactivate();
    }
  }

  /**
   * Unlock input (e.g., after restart).
   */
  unlock(): void {
    this.locked = false;
    this.inputActive = false;
  }

  /**
   * Check if input is currently active (pointer pressed).
   */
  isActive(): boolean {
    return this.inputActive;
  }

  /**
   * Check if input is locked.
   */
  isLocked(): boolean {
    return this.locked;
  }
}
