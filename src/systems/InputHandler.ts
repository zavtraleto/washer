/**
 * InputHandler — manages Phaser pointer events and delegates to active tool.
 * Centralizes input coordination without unnecessary abstractions.
 */

import Phaser from 'phaser';
import type { ITool } from '../types/tools';
import type { TiltController } from './TiltController';

export class InputHandler {
  private locked = false;
  private activePointerId: number | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly getActiveTool: () => ITool,
    private readonly tiltController: TiltController,
  ) {
    scene.input.on('pointerdown', this.onPointerDown, this);
    scene.input.on('pointermove', this.onPointerMove, this);
    scene.input.on('pointerup', this.onPointerUp, this);
  }

  private pointerToWorld(pointer: Phaser.Input.Pointer): {
    x: number;
    y: number;
  } {
    const camera = this.scene.cameras.main;
    const worldPoint = camera.getWorldPoint(pointer.x, pointer.y);
    return { x: worldPoint.x, y: worldPoint.y };
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.locked || this.activePointerId !== null) return;

    this.activePointerId = pointer.id;
    this.tiltController.startInteraction();
    const { x, y } = this.pointerToWorld(pointer);
    this.getActiveTool().handlePointerDown(x, y);
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (this.locked || pointer.id !== this.activePointerId) return;

    const { x, y } = this.pointerToWorld(pointer);
    this.getActiveTool().handlePointerMove(x, y);
  }

  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    if (pointer.id !== this.activePointerId) return;

    this.activePointerId = null;
    this.tiltController.endInteraction();
    if (this.locked) return;

    const { x, y } = this.pointerToWorld(pointer);
    this.getActiveTool().handlePointerUp(x, y);
  }

  lock(): void {
    this.locked = true;
    if (this.activePointerId !== null) {
      this.activePointerId = null;
      this.getActiveTool().deactivate();
    }
  }

  unlock(): void {
    this.locked = false;
    this.activePointerId = null;
  }

  destroy(): void {
    this.scene.input.off('pointerdown', this.onPointerDown, this);
    this.scene.input.off('pointermove', this.onPointerMove, this);
    this.scene.input.off('pointerup', this.onPointerUp, this);
    this.activePointerId = null;
  }
}
