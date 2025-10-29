import Phaser from 'phaser';

import type { ToolConfig } from '../types/config';
import { DirtSystem } from './DirtSystem';

// Turn drag path into evenly spaced stamps with soft falloff.
export class StrokeSystem {
  private active = false;
  private lastX = 0;
  private lastY = 0;
  private lastT = 0;
  private residual = 0;
  private stamped = false;
  private readonly rng: Phaser.Math.RandomDataGenerator;
  private lastDirX = 0;
  private lastDirY = -1;

  constructor(
    scene: Phaser.Scene,
    private readonly tool: ToolConfig,
    private readonly dirt: DirtSystem,
    private readonly worldToUV: (
      x: number,
      y: number,
    ) => { u: number; v: number },
    private readonly onStamp?: (
      x: number,
      y: number,
      dirX: number,
      dirY: number,
      intensity: number,
    ) => void,
  ) {
    this.rng = new Phaser.Math.RandomDataGenerator([scene.time.now.toString()]);
  }

  setActive(active: boolean): void {
    this.active = active;
    if (!active) {
      this.residual = 0;
    }
  }

  handleDown(x: number, y: number, t: number): void {
    this.lastX = x;
    this.lastY = y;
    this.lastT = t;
    this.residual = 0;
    this.lastDirX = 0;
    this.lastDirY = -1;
    this.placeStamp(x, y, 0, 0, this.lastDirX, this.lastDirY); // what: first stamp anchors the stroke immediately.
  }

  handleMove(x: number, y: number, t: number): void {
    if (!this.active) {
      return;
    }

    const dx = x - this.lastX;
    const dy = y - this.lastY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const spacing = Math.max(1, this.tool.spacing);
    const dt = Math.max(0, t - this.lastT);

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
      const ratio = Phaser.Math.Clamp(travelledAlongSegment / dist, 0, 1);
      const sx = Phaser.Math.Linear(this.lastX, x, ratio);
      const sy = Phaser.Math.Linear(this.lastY, y, ratio);
      const stampDt = dt * (needed / Math.max(dist, spacing));
      this.placeStamp(sx, sy, needed, stampDt, dirX, dirY);
      this.residual = 0;
    }

    const remaining = dist - travelledAlongSegment;
    this.residual += Math.max(0, remaining);
    this.lastX = x;
    this.lastY = y;
    this.lastT = t;
    if (dist > 0) {
      this.lastDirX = dirX;
      this.lastDirY = dirY;
    }

    if (dist === 0 && dt > 0) {
      this.placeStamp(x, y, 0, dt, this.lastDirX, this.lastDirY);
    }
  }

  handleUp(x: number, y: number, t: number): void {
    if (!this.active) {
      return;
    }
    const dx = x - this.lastX;
    const dy = y - this.lastY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const dt = Math.max(0, t - this.lastT);
    const dirX = dist > 0 ? dx / dist : this.lastDirX;
    const dirY = dist > 0 ? dy / dist : this.lastDirY;
    this.placeStamp(x, y, dist, dt, dirX, dirY);
    this.lastDirX = dirX;
    this.lastDirY = dirY;
    this.setActive(false);
  }

  update(_dt: number): void {
    // Reserved for future smoothing/throttling.
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
    dtMs: number,
    dirX: number,
    dirY: number,
  ): void {
    const { u, v } = this.worldToUV(x, y);
    const jitter = this.computeJitter();
    const boost = this.computeSpeedBoost(distance, dtMs);
    const radiusFactor = Math.max(0.2, 1 + jitter) * boost;
    this.dirt.applyStampUV(u, v, this.tool.strength, radiusFactor);
    this.stamped = true;

    if (this.onStamp) {
      const normalized = this.normalizeDirection(dirX, dirY);
      const spacing = Math.max(1, this.tool.spacing);
      const travel = distance > 0 ? distance : spacing * 0.6;
      const intensity = Phaser.Math.Clamp(travel / spacing, 0.4, 1.4);
      this.onStamp(x, y, normalized.x, normalized.y, intensity);
    }
  }

  private computeJitter(): number {
    if (this.tool.jitter <= 0) {
      return 0;
    }
    return this.rng.frac() * 2 * this.tool.jitter - this.tool.jitter; // why: +/- jitter around base radius.
  }

  private computeSpeedBoost(distance: number, dtMs: number): number {
    if (!this.tool.speedBoost || dtMs <= 0 || distance <= 0) {
      return 1;
    }
    const speed = (distance / dtMs) * 1000; // px per second.
    const normalized = Phaser.Math.Clamp(speed / 600, 0, 1);
    return 1 + 0.15 * normalized; // why: modest radius boost at higher pointer speed.
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
