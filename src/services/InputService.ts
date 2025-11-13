import Phaser from 'phaser';

export type PointerSample = { x: number; y: number; t: number }; // what: world coords + ms timestamp

// Normalize pointer events into world-space samples.
export class InputService {
  private downCallbacks: Array<(p: PointerSample) => void> = [];
  private moveCallbacks: Array<(p: PointerSample) => void> = [];
  private upCallbacks: Array<(p: PointerSample) => void> = [];
  private isDown = false;
  private activePointerId: number | null = null; // Track which pointer is active

  constructor(private readonly scene: Phaser.Scene) {
    const input = scene.input;
    input.on('pointerdown', this.handleDown, this);
    input.on('pointermove', this.handleMove, this);
    input.on('pointerup', this.handleUp, this);
  }

  onDown(cb: (p: PointerSample) => void): void {
    this.downCallbacks.push(cb);
  }

  onMove(cb: (p: PointerSample) => void): void {
    this.moveCallbacks.push(cb);
  }

  onUp(cb: (p: PointerSample) => void): void {
    this.upCallbacks.push(cb);
  }

  destroy(): void {
    const input = this.scene.input;
    input.off('pointerdown', this.handleDown, this);
    input.off('pointermove', this.handleMove, this);
    input.off('pointerup', this.handleUp, this);
    this.downCallbacks = [];
    this.moveCallbacks = [];
    this.upCallbacks = [];
    this.isDown = false;
    this.activePointerId = null;
  }

  private handleDown(pointer: Phaser.Input.Pointer): void {
    // Accept the first pointer that presses down (mouse or touch)
    if (this.isDown) {
      return; // Already have an active pointer; ignore others.
    }
    this.isDown = true;
    this.activePointerId = pointer.id;
    const sample = this.sample(pointer);
    for (const cb of this.downCallbacks) {
      cb(sample);
    }
  }

  private handleMove(pointer: Phaser.Input.Pointer): void {
    // Only track the active pointer
    if (!this.isDown || pointer.id !== this.activePointerId) {
      return;
    }
    const sample = this.sample(pointer);
    for (const cb of this.moveCallbacks) {
      cb(sample);
    }
  }

  private handleUp(pointer: Phaser.Input.Pointer): void {
    // Only respond to the active pointer releasing
    if (pointer.id !== this.activePointerId) {
      return;
    }
    this.isDown = false;
    this.activePointerId = null;
    const sample = this.sample(pointer);
    for (const cb of this.upCallbacks) {
      cb(sample);
    }
  }

  private sample(pointer: Phaser.Input.Pointer): PointerSample {
    const camera = this.scene.cameras.main;
    const worldPoint = camera.getWorldPoint(pointer.x, pointer.y);
    const timeStamp =
      typeof pointer.event?.timeStamp === 'number'
        ? pointer.event.timeStamp
        : performance.now();
    return { x: worldPoint.x, y: worldPoint.y, t: timeStamp }; // what: convert to world and timestamp
  }
}
