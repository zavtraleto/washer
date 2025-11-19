/**
 * ScrubbingTool — click & drag on object to scrub dirt away.
 * Wraps StrokeSystem to provide stamp-based cleaning mechanics.
 */

import Phaser from 'phaser';
import { BaseTool } from './BaseTool';
import { StrokeSystem } from '../systems/StrokeSystem';
import type { DirtSystem } from '../systems/DirtSystem';
import type { TiltController } from '../systems/TiltController';
import { ScrubbingConfig } from 'src/types/config';

export class ScrubbingTool extends BaseTool {
  private strokeSystem: StrokeSystem;
  private tiltController: TiltController;

  constructor(
    scene: Phaser.Scene,
    config: ScrubbingConfig,
    dirtSystem: DirtSystem,
    worldToUV: (x: number, y: number) => { u: number; v: number },
    eventDispatcher: Phaser.Events.EventEmitter,
    tiltController: TiltController,
  ) {
    super(config);
    this.tiltController = tiltController;

    // Create internal stroke system for stamp-based cleaning.
    this.strokeSystem = new StrokeSystem(
      scene,
      {
        id: 'scrubbing',
        spacing: config.spacing,
        falloff: 'soft',
        jitter: config.jitter,
        strength: config.strength,
      },
      dirtSystem,
      worldToUV,
      eventDispatcher,
    );
  }

  handlePointerDown(worldX: number, worldY: number): void {
    if (!this.active) return;
    this.tiltController.setPointerTarget(worldX, worldY);
    this.strokeSystem.handleDown(worldX, worldY);
  }

  handlePointerMove(worldX: number, worldY: number): void {
    if (!this.active) return;
    this.tiltController.setPointerTarget(worldX, worldY);
    this.strokeSystem.handleMove(worldX, worldY);
  }

  handlePointerUp(worldX: number, worldY: number): void {
    if (!this.active) return;
    this.strokeSystem.handleUp(worldX, worldY);
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
   * Reset stroke state when deactivating tool.
   */
  override reset(): void {
    this.strokeSystem.reset();
  }

  /**
   * Check if stroke system applied stamps since last check.
   */
  didStampSinceLastCheck(): boolean {
    return this.strokeSystem.didStampSinceLastCheck();
  }
}
