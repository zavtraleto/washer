/**
 * BaseTool — abstract base class for all cleaning tools.
 * Provides shared functionality and enforces tool interface.
 */

import type { ITool, IToolConfig } from '../types/tools';

export abstract class BaseTool implements ITool {
  protected active = false; // Whether tool is currently active (selected).

  constructor(public readonly config: IToolConfig) {}

  /**
   * Activate tool (override for tool-specific setup).
   */
  activate(): void {
    this.active = true;
  }

  /**
   * Deactivate tool (override for tool-specific cleanup).
   */
  deactivate(): void {
    this.active = false;
    this.reset?.();
  }

  /**
   * Reset tool state (optional, override for tool-specific state clearing).
   */
  reset?(): void;

  /**
   * Check if tool is currently active.
   */
  isActive(): boolean {
    return this.active;
  }

  // Abstract methods - concrete tools must implement these.
  abstract handleDown(worldX: number, worldY: number, timestamp: number): void;
  abstract handleMove(worldX: number, worldY: number, timestamp: number): void;
  abstract handleUp(worldX: number, worldY: number, timestamp: number): void;
  abstract update(deltaMs: number): void;
  abstract isValidInputLocation(
    worldX: number,
    worldY: number,
    isOnObject: boolean,
  ): boolean;
}
