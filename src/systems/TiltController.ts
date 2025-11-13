import Phaser from 'phaser';

import { MathUtils } from '../utils/MathUtils';

// Configuration for tilt spring physics.
interface TiltConfig {
  maxTiltDegrees: number; // Maximum tilt angle.
  stiffness: number; // Spring force strength.
  damping: number; // Energy loss per frame.
  tiltSpeed: number; // Lerp speed when actively tilting.
}

// Visual bounds provider for accurate tilt calculations.
export interface VisualBoundsProvider {
  (): { left: number; top: number; width: number; height: number } | null;
}

// Manages mesh tilt with spring physics for reactive feel.
export class TiltController {
  private currentTiltX = 0; // Current rotation X in radians.
  private currentTiltY = 0; // Current rotation Y in radians.
  private targetTiltX = 0; // Target rotation X based on pointer.
  private targetTiltY = 0; // Target rotation Y based on pointer.
  private tiltVelX = 0; // Spring velocity X.
  private tiltVelY = 0; // Spring velocity Y.
  private isInteracting = false; // Whether pointer is active.

  constructor(
    private readonly mesh: Phaser.GameObjects.Mesh,
    private readonly config: TiltConfig,
    private readonly boundsProvider?: VisualBoundsProvider,
  ) {}

  // Set pointer target relative to mesh (normalized -1..1).
  setPointerTarget(pointerX: number, pointerY: number): void {
    // Get actual visual bounds (accounts for panZ perspective).
    const bounds = this.boundsProvider?.();
    if (!bounds) {
      return; // Can't calculate tilt without bounds.
    }

    const centerX = bounds.left + bounds.width / 2;
    const centerY = bounds.top + bounds.height / 2;

    // Calculate normalized offset from visual center.
    const dx = (pointerX - centerX) / (bounds.width * 0.5);
    const dy = (pointerY - centerY) / (bounds.height * 0.5);

    // Clamp to prevent extreme tilts at edges.
    const clampedDx = MathUtils.clamp(dx, -1, 1);
    const clampedDy = MathUtils.clamp(dy, -1, 1);

    // Convert to radians with max tilt limit.
    const maxTiltRad = Phaser.Math.DegToRad(this.config.maxTiltDegrees);
    this.targetTiltY = -clampedDx * maxTiltRad; // Y rotation for horizontal cursor movement.
    this.targetTiltX = -clampedDy * maxTiltRad; // X rotation for vertical cursor movement.
  }

  // Begin active interaction (lerp toward target).
  startInteraction(): void {
    this.isInteracting = true;
  }

  // End interaction (spring back to center).
  endInteraction(): void {
    this.isInteracting = false;
    this.targetTiltX = 0;
    this.targetTiltY = 0;
  }

  // Reset to neutral state.
  reset(): void {
    this.currentTiltX = 0;
    this.currentTiltY = 0;
    this.targetTiltX = 0;
    this.targetTiltY = 0;
    this.tiltVelX = 0;
    this.tiltVelY = 0;
    this.isInteracting = false;
  }

  // Update spring physics (call every frame with delta in seconds).
  update(dtSeconds: number): void {
    if (dtSeconds <= 0) return;

    if (this.isInteracting) {
      // Lerp toward target when actively interacting.
      this.currentTiltX = Phaser.Math.Linear(
        this.currentTiltX,
        this.targetTiltX,
        this.config.tiltSpeed,
      );
      this.currentTiltY = Phaser.Math.Linear(
        this.currentTiltY,
        this.targetTiltY,
        this.config.tiltSpeed,
      );
    } else {
      // Spring back to center when not interacting.
      const errorX = -this.currentTiltX;
      const errorY = -this.currentTiltY;

      // Apply spring force.
      this.tiltVelX += errorX * this.config.stiffness;
      this.tiltVelY += errorY * this.config.stiffness;

      // Apply damping.
      this.tiltVelX *= this.config.damping;
      this.tiltVelY *= this.config.damping;

      // Update positions.
      this.currentTiltX += this.tiltVelX;
      this.currentTiltY += this.tiltVelY;

      // Stop when close enough to avoid jitter.
      if (
        Math.abs(this.currentTiltX) < 0.001 &&
        Math.abs(this.tiltVelX) < 0.001
      ) {
        this.currentTiltX = 0;
        this.tiltVelX = 0;
      }
      if (
        Math.abs(this.currentTiltY) < 0.001 &&
        Math.abs(this.tiltVelY) < 0.001
      ) {
        this.currentTiltY = 0;
        this.tiltVelY = 0;
      }
    }

    // Apply rotation to mesh.
    this.mesh.modelRotation.x = this.currentTiltX;
    this.mesh.modelRotation.y = this.currentTiltY;
  }

  // Get current tilt in degrees for debug display.
  getTiltDegrees(): { x: number; y: number } {
    return {
      x: Phaser.Math.RadToDeg(this.currentTiltX),
      y: Phaser.Math.RadToDeg(this.currentTiltY),
    };
  }
}
