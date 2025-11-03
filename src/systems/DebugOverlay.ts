import Phaser from 'phaser';

import { debug } from '../services/DebugFlags';

// Visual on-screen debug display showing real-time game state.
export class DebugOverlay {
  private scene: Phaser.Scene;
  private graphics: Phaser.GameObjects.Graphics;
  private text: Phaser.GameObjects.Text;
  private boundsGraphics: Phaser.GameObjects.Graphics;
  private visible = false;

  // Debug state to display.
  private stats = {
    fps: 0,
    dirtProgress: 0,
    inputActive: false,
    tiltX: 0,
    tiltY: 0,
    particleCount: 0,
    seed: 0,
  };

  // Reference to mesh for bounds visualization.
  private mesh?: Phaser.GameObjects.Mesh;
  private getBounds?: () => {
    left: number;
    top: number;
    width: number;
    height: number;
  } | null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    // Graphics for mesh bounds visualization.
    this.boundsGraphics = scene.add.graphics();
    this.boundsGraphics.setDepth(9999);
    this.boundsGraphics.setScrollFactor(0);
    this.boundsGraphics.setVisible(false);

    // Semi-transparent background panel.
    this.graphics = scene.add.graphics();
    this.graphics.setDepth(10000);
    this.graphics.setScrollFactor(0);
    this.graphics.setVisible(false);

    // Monospace text for clean data display.
    this.text = scene.add.text(10, 10, '', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#00ff00',
      backgroundColor: 'rgba(0,0,0,0.8)',
      padding: { x: 10, y: 10 },
    });
    this.text.setDepth(10001);
    this.text.setScrollFactor(0);
    this.text.setVisible(false);

    // Register 'D' key to toggle overlay.
    scene.input.keyboard?.on('keydown-D', () => {
      this.toggle();
    });
  }

  // Set mesh reference for bounds drawing.
  setMesh(
    mesh: Phaser.GameObjects.Mesh,
    getBounds: () => {
      left: number;
      top: number;
      width: number;
      height: number;
    } | null,
  ): void {
    this.mesh = mesh;
    this.getBounds = getBounds;
  }

  // Toggle visibility and master debug flag.
  toggle(): void {
    this.visible = !this.visible;
    debug.toggle();
    this.graphics.setVisible(this.visible);
    this.text.setVisible(this.visible);
    this.boundsGraphics.setVisible(this.visible);

    if (this.visible) {
      console.log('[Debug] Overlay ENABLED - Press D to hide');
    }
  }

  // Update stats from game systems (call from scene update).
  updateStats(stats: Partial<typeof this.stats>): void {
    Object.assign(this.stats, stats);
  }

  // Refresh display with current stats and draw bounds.
  update(): void {
    if (!this.visible) return;

    this.stats.fps = Math.round(this.scene.game.loop.actualFps);

    const lines = [
      '=== DEBUG OVERLAY ===',
      `FPS: ${this.stats.fps}`,
      `Progress: ${this.stats.dirtProgress.toFixed(1)}%`,
      `Seed: ${this.stats.seed}`,
      '',
      `Input: ${this.stats.inputActive ? 'ACTIVE' : 'idle'}`,
      `Tilt: X=${this.stats.tiltX.toFixed(2)}° Y=${this.stats.tiltY.toFixed(2)}°`,
      `Particles: ${this.stats.particleCount}`,
      '',
      'Press D to toggle',
    ];

    this.text.setText(lines.join('\n'));

    // Draw mesh bounds if available.
    this.drawBounds();
  }

  private drawBounds(): void {
    this.boundsGraphics.clear();

    if (!this.mesh || !this.getBounds) return;

    const bounds = this.getBounds();
    if (!bounds) return;

    // Draw red rectangle around mesh visual bounds.
    this.boundsGraphics.lineStyle(2, 0xff0000, 1);
    this.boundsGraphics.strokeRect(
      bounds.left,
      bounds.top,
      bounds.width,
      bounds.height,
    );

    // Draw crosshair at mesh center.
    const centerX = bounds.left + bounds.width / 2;
    const centerY = bounds.top + bounds.height / 2;
    this.boundsGraphics.lineStyle(1, 0x00ff00, 1);
    this.boundsGraphics.beginPath();
    this.boundsGraphics.moveTo(centerX - 10, centerY);
    this.boundsGraphics.lineTo(centerX + 10, centerY);
    this.boundsGraphics.moveTo(centerX, centerY - 10);
    this.boundsGraphics.lineTo(centerX, centerY + 10);
    this.boundsGraphics.strokePath();
  }

  destroy(): void {
    this.graphics.destroy();
    this.text.destroy();
    this.boundsGraphics.destroy();
  }
}
