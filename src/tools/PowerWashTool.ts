/**
 * PowerWashTool — click & hold OUTSIDE object to fire continuous water stream TOWARD object.
 * Stream mechanics: visible blue line from click point to object edge, continuous erosion at impact point.
 */

import Phaser from 'phaser';
import { BaseTool } from './BaseTool';
import type { IToolConfig } from '../types/tools';
import type { DirtSystem } from '../systems/DirtSystem';
import type { GameEventDispatcher } from '../services/GameEventDispatcher';

/** Configuration specific to power wash tool. */
export interface PowerWashToolConfig extends IToolConfig {
  maxRange: number; // Maximum stream distance (px).
  streamWidth: number; // Stream visual width (px).
  pressure: number; // Erosion strength per frame.
  tickRate: number; // Erosion ticks per second.
  jitter: number; // Random radius variation (0-1).
}

export class PowerWashTool extends BaseTool {
  private dirtSystem: DirtSystem;
  private worldToUV: (x: number, y: number) => { u: number; v: number };
  private eventDispatcher: GameEventDispatcher;
  private powerWashConfig: PowerWashToolConfig;

  private isStreaming = false;
  private streamStartX = 0;
  private streamStartY = 0;
  private streamTargetX = 0;
  private streamTargetY = 0;
  private streamHitX = 0;
  private streamHitY = 0;
  private hasHit = false;
  private timeSinceLastTick = 0;

  // Visual stream line.
  private streamLine: Phaser.GameObjects.Graphics;

  constructor(
    scene: Phaser.Scene,
    config: PowerWashToolConfig,
    dirtSystem: DirtSystem,
    worldToUV: (x: number, y: number) => { u: number; v: number },
    isPointOnObject: (x: number, y: number) => boolean,
    eventDispatcher: GameEventDispatcher,
  ) {
    super(config);
    this.dirtSystem = dirtSystem;
    this.worldToUV = worldToUV;
    this.eventDispatcher = eventDispatcher;
    this.powerWashConfig = config;
    this.isPointOnObject = isPointOnObject;

    // Create stream line graphics.
    this.streamLine = scene.add.graphics();
    this.streamLine.setDepth(1000); // Render on top.
    this.streamLine.setVisible(false);
  }

  // Callback to check if point is on object (injected from GameScene).
  private isPointOnObject: (x: number, y: number) => boolean;

  override activate(): void {
    super.activate();
    this.streamLine.setVisible(false);
  }

  override deactivate(): void {
    super.deactivate();
    this.isStreaming = false;
    this.streamLine.setVisible(false);
  }

  handleDown(worldX: number, worldY: number, _timestamp: number): void {
    if (!this.active) return;

    // Start streaming from click point.
    this.isStreaming = true;
    this.streamStartX = worldX;
    this.streamStartY = worldY;
    this.streamTargetX = worldX;
    this.streamTargetY = worldY;
    this.timeSinceLastTick = 0;
    this.hasHit = false;
  }

  handleMove(worldX: number, worldY: number, _timestamp: number): void {
    if (!this.active || !this.isStreaming) return;

    // Update stream target (allows player to aim stream while holding).
    this.streamTargetX = worldX;
    this.streamTargetY = worldY;
  }

  handleUp(_worldX: number, _worldY: number, _timestamp: number): void {
    if (!this.active) return;
    this.isStreaming = false;
    this.streamLine.setVisible(false);
    this.hasHit = false;
  }

  update(deltaMs: number): void {
    if (!this.active) return;

    if (this.isStreaming) {
      // Find hit point on object edge.
      this.updateStreamHitPoint();

      // Draw visual stream.
      this.drawStream();

      // Apply continuous erosion at hit point.
      if (this.hasHit) {
        this.timeSinceLastTick += deltaMs;
        const tickInterval = 1000 / this.powerWashConfig.tickRate;

        while (this.timeSinceLastTick >= tickInterval) {
          this.applyErosionAtHitPoint();
          this.timeSinceLastTick -= tickInterval;
        }
      }
    } else {
      this.streamLine.setVisible(false);
    }
  }

  /**
   * Find intersection point with object along ray from start to target.
   */
  private updateStreamHitPoint(): void {
    const { maxRange } = this.powerWashConfig;

    // Calculate ray direction from start to current target.
    const dx = this.streamTargetX - this.streamStartX;
    const dy = this.streamTargetY - this.streamStartY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < 1) {
      this.hasHit = false;
      return;
    }

    const dirX = dx / distance;
    const dirY = dy / distance;

    // Sample along ray to find first intersection with object.
    const stepSize = 3; // Sample every 3px for performance.
    const maxSteps = Math.floor(Math.min(maxRange, distance) / stepSize);

    for (let step = 1; step <= maxSteps; step += 1) {
      const testX = this.streamStartX + dirX * stepSize * step;
      const testY = this.streamStartY + dirY * stepSize * step;

      if (this.isPointOnObject(testX, testY)) {
        this.streamHitX = testX;
        this.streamHitY = testY;
        this.hasHit = true;
        return;
      }
    }

    this.hasHit = false;
  }

  /**
   * Draw visible stream line from start to hit point.
   */
  private drawStream(): void {
    this.streamLine.clear();

    if (!this.hasHit) {
      this.streamLine.setVisible(false);
      return;
    }

    this.streamLine.setVisible(true);

    // Draw thick blue line for stream.
    const { streamWidth } = this.powerWashConfig;
    this.streamLine.lineStyle(streamWidth, 0x4da6ff, 0.7);
    this.streamLine.beginPath();
    this.streamLine.moveTo(this.streamStartX, this.streamStartY);
    this.streamLine.lineTo(this.streamHitX, this.streamHitY);
    this.streamLine.strokePath();

    // Draw glow effect at impact point.
    this.streamLine.fillStyle(0x6bb8ff, 0.4);
    this.streamLine.fillCircle(
      this.streamHitX,
      this.streamHitY,
      streamWidth * 1.5,
    );
  }

  /**
   * Apply erosion at the current hit point.
   */
  private applyErosionAtHitPoint(): void {
    if (!this.hasHit) return;

    const { pressure, jitter } = this.powerWashConfig;

    const uv = this.worldToUV(this.streamHitX, this.streamHitY);
    const dirtValue = this.dirtSystem.getUnionDirtyValueAt(uv.u, uv.v);

    // Apply jitter to radius for organic feel.
    const jitterAmount = 1 + (Math.random() - 0.5) * jitter;
    const radiusFactor = Math.max(0.5, jitterAmount);

    // Apply stamp to dirt system.
    this.dirtSystem.applyStampUV(uv.u, uv.v, pressure, radiusFactor);

    // Emit event for particle effects.
    const dx = this.streamHitX - this.streamStartX;
    const dy = this.streamHitY - this.streamStartY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const dirX = dist > 0 ? dx / dist : 0;
    const dirY = dist > 0 ? dy / dist : 0;

    this.eventDispatcher.emitStampApplied({
      worldX: this.streamHitX,
      worldY: this.streamHitY,
      dirX,
      dirY,
      intensity: pressure * 1.5, // Higher intensity for power wash splash.
      dirtValue,
    });
  }

  /**
   * Power wash tool only works OUTSIDE the object (click to aim stream).
   */
  isValidInputLocation(
    _worldX: number,
    _worldY: number,
    isOnObject: boolean,
  ): boolean {
    return !isOnObject; // Only allow starting stream from outside object.
  }

  /**
   * Cleanup when tool is destroyed.
   */
  destroy(): void {
    if (this.streamLine) {
      this.streamLine.destroy();
    }
  }
}
