/**
 * ScrubbingTool — click & drag on object to scrub dirt away.
 * Wraps StrokeSystem to provide stamp-based cleaning mechanics.
 */

import Phaser from 'phaser';
import { BaseTool } from './BaseTool';
import { StrokeSystem } from '../systems/StrokeSystem';
import type { IToolConfig } from '../types/tools';
import type { DirtSystem } from '../systems/DirtSystem';
import type { GameEventDispatcher } from '../services/GameEventDispatcher';

/** Configuration specific to scrubbing tool. */
export interface ScrubbingToolConfig extends IToolConfig {
  spacing: number; // Distance between stamps (px).
  jitter: number; // Random radius variation (0-1).
  strength: number; // Dirt removal strength.
  speedBoost: boolean; // Whether to enlarge radius at high speed.
}

export class ScrubbingTool extends BaseTool {
  private strokeSystem: StrokeSystem;

  constructor(
    scene: Phaser.Scene,
    config: ScrubbingToolConfig,
    dirtSystem: DirtSystem,
    worldToUV: (x: number, y: number) => { u: number; v: number },
    eventDispatcher: GameEventDispatcher,
  ) {
    super(config);

    // Create internal stroke system for stamp-based cleaning.
    this.strokeSystem = new StrokeSystem(
      scene,
      {
        id: 'water_jet', // Legacy ID from catalog.
        spacing: config.spacing,
        falloff: 'soft',
        jitter: config.jitter,
        strength: config.strength,
        speedBoost: config.speedBoost,
      },
      dirtSystem,
      worldToUV,
      eventDispatcher,
    );
  }

  handleDown(worldX: number, worldY: number, timestamp: number): void {
    if (!this.active) return;
    this.strokeSystem.handleDown(worldX, worldY, timestamp);
  }

  handleMove(worldX: number, worldY: number, timestamp: number): void {
    if (!this.active) return;
    this.strokeSystem.handleMove(worldX, worldY, timestamp);
  }

  handleUp(worldX: number, worldY: number, timestamp: number): void {
    if (!this.active) return;
    this.strokeSystem.handleUp(worldX, worldY, timestamp);
  }

  update(deltaMs: number): void {
    if (!this.active) return;
    this.strokeSystem.update(deltaMs);
  }

  /**
   * Scrubbing tool only works ON the object.
   */
  isValidInputLocation(
    _worldX: number,
    _worldY: number,
    isOnObject: boolean,
  ): boolean {
    return isOnObject; // Only allow scrubbing on the object surface.
  }

  /**
   * Check if stroke system applied stamps since last check.
   */
  didStampSinceLastCheck(): boolean {
    return this.strokeSystem.didStampSinceLastCheck();
  }
}
