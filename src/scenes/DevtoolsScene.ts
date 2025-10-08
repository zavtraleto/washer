import Phaser from 'phaser';

export class DevtoolsScene extends Phaser.Scene {
  constructor() {
    super({ key: 'DevtoolsScene' });
  }

  create(): void {
    // Create development tools (FPS counter, debug info, etc.)
    this.setupFPSCounter();
  }

  private setupFPSCounter(): void {
    // Add FPS display
    const fpsText = this.add.text(10, 10, 'FPS: 0', {
      fontSize: '16px',
      color: '#00ff00',
    });
    fpsText.setScrollFactor(0);
    fpsText.setDepth(10000);

    this.events.on('update', () => {
      fpsText.setText(`FPS: ${Math.round(this.game.loop.actualFps)}`);
    });
  }
}
