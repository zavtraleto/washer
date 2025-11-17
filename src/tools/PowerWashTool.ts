/**
 * PowerWashTool — water stream with inertia and damping.
 * Stream starts from fixed corner, follows cursor with spring physics, washes where it hits object.
 */

import Phaser from 'phaser';
import { BaseTool } from './BaseTool';
import type { IToolConfig } from '../types/tools';
import type { DirtSystem } from '../systems/DirtSystem';
import type { GameEventDispatcher } from '../services/GameEventDispatcher';
import type { TiltController } from '../systems/TiltController';

export interface PowerWashToolConfig extends IToolConfig {
  sourceAnchorX: number; // Corner position 0..1.
  sourceAnchorY: number;
  springStiffness: number; // Spring feel.
  springDamping: number;
  pressureRiseSpeed: number; // Ramp speed.
  pressureFallSpeed: number;
  baseStrength: number; // Cleaning power.
  jitter: number;
  streamWidth: number; // Visual.
  streamColor: number;
}

export class PowerWashTool extends BaseTool {
  private dirtSystem: DirtSystem;
  private worldToUV: (x: number, y: number) => { u: number; v: number };
  private isPointOnObject: (x: number, y: number) => boolean;
  private eventDispatcher: GameEventDispatcher;
  private tiltController: TiltController;
  private cfg: PowerWashToolConfig;

  private sourceX = 0;
  private sourceY = 0;
  private nozzleX = 0;
  private nozzleY = 0;
  private velX = 0;
  private velY = 0;
  private pressure = 0;
  private firing = false;

  private graphics: Phaser.GameObjects.Graphics;

  constructor(
    scene: Phaser.Scene,
    config: PowerWashToolConfig,
    dirtSystem: DirtSystem,
    worldToUV: (x: number, y: number) => { u: number; v: number },
    isPointOnObject: (x: number, y: number) => boolean,
    eventDispatcher: GameEventDispatcher,
    tiltController: TiltController,
  ) {
    super(config);
    this.cfg = config;
    this.dirtSystem = dirtSystem;
    this.worldToUV = worldToUV;
    this.isPointOnObject = isPointOnObject;
    this.eventDispatcher = eventDispatcher;
    this.tiltController = tiltController;

    this.graphics = scene.add.graphics().setDepth(1000);

    // Fixed source at corner.
    this.sourceX = scene.scale.width * config.sourceAnchorX;
    this.sourceY = scene.scale.height * config.sourceAnchorY;
    this.nozzleX = this.sourceX;
    this.nozzleY = this.sourceY;
  }

  override activate(): void {
    super.activate();
    this.graphics.setVisible(false);
  }

  override deactivate(): void {
    super.deactivate();
    this.firing = false;
    this.graphics.setVisible(false);
  }

  handleDown(_worldX: number, _worldY: number, _timestamp: number): void {
    if (!this.active) return;
    this.firing = true;
  }

  handleMove(_worldX: number, _worldY: number, _timestamp: number): void {
    // Movement is tracked in update via pointer.
  }

  handleUp(_worldX: number, _worldY: number, _timestamp: number): void {
    if (!this.active) return;
    this.firing = false;
  }

  update(deltaMs: number): void {
    if (!this.active) return;

    const dt = deltaMs / 1000;

    // Update pressure.
    if (this.firing) {
      this.pressure = Math.min(
        1,
        this.pressure + this.cfg.pressureRiseSpeed * dt,
      );
    } else {
      this.pressure = Math.max(
        0,
        this.pressure - this.cfg.pressureFallSpeed * dt,
      );
    }

    if (this.pressure <= 0.01) {
      this.graphics.setVisible(false);
      return;
    }

    // Get cursor position.
    const pointer = this.graphics.scene.input.activePointer;
    const cursorX = pointer.worldX;
    const cursorY = pointer.worldY;

    // Check if cursor is on object - if yes, that's where we want to clean.
    if (!this.isPointOnObject(cursorX, cursorY)) {
      this.graphics.setVisible(false);
      return;
    }

    // Nozzle springs toward cursor position (with lag/inertia).
    const dx = cursorX - this.nozzleX;
    const dy = cursorY - this.nozzleY;

    const forceX =
      this.cfg.springStiffness * dx - this.cfg.springDamping * this.velX;
    const forceY =
      this.cfg.springStiffness * dy - this.cfg.springDamping * this.velY;

    this.velX += forceX;
    this.velY += forceY;
    this.nozzleX += this.velX * dt * 60;
    this.nozzleY += this.velY * dt * 60;

    // Update tilt to where stream is actually hitting (nozzle position with lag).
    this.tiltController.setPointerTarget(this.nozzleX, this.nozzleY);

    // Draw stream from source to nozzle (lagged cleaning point).
    this.graphics.clear();
    this.graphics.setVisible(true);
    this.graphics.lineStyle(
      this.cfg.streamWidth,
      this.cfg.streamColor,
      this.pressure * 0.7,
    );
    this.graphics.beginPath();
    this.graphics.moveTo(this.sourceX, this.sourceY);
    this.graphics.lineTo(this.nozzleX, this.nozzleY);
    this.graphics.strokePath();

    // Draw cleaning point indicator.
    this.graphics.fillStyle(0xffffff, this.pressure * 0.5);
    this.graphics.fillCircle(this.nozzleX, this.nozzleY, 8);

    // Clean where nozzle is (lagged position with inertia).
    const uv = this.worldToUV(this.nozzleX, this.nozzleY);
    const jitterFactor = 1 + (Math.random() - 0.5) * this.cfg.jitter;
    const strength = this.cfg.baseStrength * this.pressure;

    this.dirtSystem.applyStampUV(uv.u, uv.v, strength, jitterFactor);

    // Emit particles at cleaning point.
    const dirtValue = this.dirtSystem.getUnionDirtyValueAt(uv.u, uv.v);
    const angle = Math.atan2(
      this.nozzleY - this.sourceY,
      this.nozzleX - this.sourceX,
    );

    this.eventDispatcher.emitStampApplied({
      worldX: this.nozzleX,
      worldY: this.nozzleY,
      dirX: Math.cos(angle),
      dirY: Math.sin(angle),
      intensity: this.pressure * 1.5,
      dirtValue,
    });
  }

  isValidInputLocation(
    _worldX: number,
    _worldY: number,
    isOnObject: boolean,
  ): boolean {
    return isOnObject;
  }

  destroy(): void {
    this.graphics?.destroy();
  }
}
