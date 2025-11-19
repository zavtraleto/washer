import Phaser from 'phaser';

// import type { ToolConfig } from '../types/config';
import { DirtSystem } from './DirtSystem';
import { MathUtils } from '../utils/MathUtils';
import { GameEvents } from '../types/events';

/**
 * StrokeSystem — converts drag path into evenly-spaced stamps with soft falloff.
 * Internal helper for scrubbing-style tools.
 */
export class StrokeSystem {
  private lastX = 0;
  private lastY = 0;
  private residual = 0;
  private stamped = false;
  private readonly rng: Phaser.Math.RandomDataGenerator;
  private lastDirX = 0;
  private lastDirY = -1;

  constructor(
    scene: Phaser.Scene,
    private readonly tool: any, // ToolConfig
    private readonly dirt: DirtSystem,
    private readonly worldToUV: (
      x: number,
      y: number,
    ) => { u: number; v: number },
    private readonly eventDispatcher: Phaser.Events.EventEmitter,
  ) {
    this.rng = new Phaser.Math.RandomDataGenerator([scene.time.now.toString()]);
  }

  handleDown(x: number, y: number): void {
    this.lastX = x;
    this.lastY = y;
    this.residual = 0;
    this.lastDirX = 0;
    this.lastDirY = -1;
    this.placeStamp(x, y, 0, this.lastDirX, this.lastDirY);
  }

  handleMove(x: number, y: number): void {
    const dx = x - this.lastX;
    const dy = y - this.lastY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const spacing = Math.max(1, this.tool.spacing);

    this.residual = Math.min(this.residual, spacing);

    const dirX = dist > 0 ? dx / dist : this.lastDirX;
    const dirY = dist > 0 ? dy / dist : this.lastDirY;

    let travelledAlongSegment = 0;
    while (
      this.residual + (dist - travelledAlongSegment) >= spacing &&
      dist > 0
    ) {
      const needed = spacing - this.residual;
      travelledAlongSegment += needed;
      const ratio = MathUtils.clamp(travelledAlongSegment / dist, 0, 1);
      const sx = Phaser.Math.Linear(this.lastX, x, ratio);
      const sy = Phaser.Math.Linear(this.lastY, y, ratio);
      this.placeStamp(sx, sy, needed, dirX, dirY);
      this.residual = 0;
    }

    const remaining = dist - travelledAlongSegment;
    this.residual += Math.max(0, remaining);
    this.lastX = x;
    this.lastY = y;
    if (dist > 0) {
      this.lastDirX = dirX;
      this.lastDirY = dirY;
    }
  }

  handleUp(x: number, y: number): void {
    const dx = x - this.lastX;
    const dy = y - this.lastY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const dirX = dist > 0 ? dx / dist : this.lastDirX;
    const dirY = dist > 0 ? dy / dist : this.lastDirY;
    this.placeStamp(x, y, dist, dirX, dirY);
    this.lastDirX = dirX;
    this.lastDirY = dirY;
    this.residual = 0;
  }

  update(_dt: number): void {
    // Reserved for future smoothing/throttling.
  }

  reset(): void {
    this.lastX = 0;
    this.lastY = 0;
    this.residual = 0;
    this.stamped = false;
    this.lastDirX = 0;
    this.lastDirY = -1;
  }

  didStampSinceLastCheck(): boolean {
    const result = this.stamped;
    this.stamped = false;
    return result;
  }

  private placeStamp(
    x: number,
    y: number,
    distance: number,
    dirX: number,
    dirY: number,
  ): void {
    const { u, v } = this.worldToUV(x, y);
    const jitter = this.computeJitter();
    const radiusFactor = Math.max(0.2, 1 + jitter);
    this.dirt.applyStampUV(u, v, this.tool.strength, radiusFactor);
    this.stamped = true;

    const normalized = this.normalizeDirection(dirX, dirY);
    const spacing = Math.max(1, this.tool.spacing);
    const travel = distance > 0 ? distance : spacing * 0.6;
    const intensity = MathUtils.clamp(travel / spacing, 0.4, 1.4);
    const dirtValue = this.dirt.getUnionDirtyValueAt(u, v);

    this.eventDispatcher.emit(GameEvents.STAMP_APPLIED, {
      worldX: x,
      worldY: y,
      dirX: normalized.x,
      dirY: normalized.y,
      intensity,
      dirtValue,
    });
  }

  private computeJitter(): number {
    if (this.tool.jitter <= 0) {
      return 0;
    }
    return this.rng.frac() * 2 * this.tool.jitter - this.tool.jitter;
  }

  private normalizeDirection(
    dirX: number,
    dirY: number,
  ): { x: number; y: number } {
    const length = Math.hypot(dirX, dirY);
    if (length <= 0.0001) {
      return { x: 0, y: -1 };
    }
    return { x: dirX / length, y: dirY / length };
  }
}
