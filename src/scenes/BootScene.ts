import Phaser from 'phaser';
import { SCENE_KEYS, GAME_CONFIG } from '../types/constants';

export class BootScene extends Phaser.Scene {
  private bootingText?: Phaser.GameObjects.Text;

  constructor() {
    super({ key: SCENE_KEYS.BOOT });
  }

  create(): void {
    // Set up scale handling for resize/orientation changes
    this.setupScaleHandling();

    // Display centered "Booting..." label
    this.bootingText = this.add.text(
      GAME_CONFIG.WIDTH / 2,
      GAME_CONFIG.HEIGHT / 2,
      'Booting...',
      {
        fontFamily: 'Arial, sans-serif',
        fontSize: '48px',
        color: '#ffffff',
        align: 'center',
      },
    );
    this.bootingText.setOrigin(0.5);

    // Transition to Preload scene after 1000ms
    this.time.delayedCall(1000, () => {
      this.scene.start(SCENE_KEYS.PRELOAD);
    });
  }

  private setupScaleHandling(): void {
    // Handle resize events
    this.scale.on('resize', this.onResize, this);

    // Handle orientation change
    this.scale.on('orientationchange', this.onOrientationChange, this);
  }

  private onResize(gameSize: Phaser.Structs.Size): void {
    // Handle window resize
    const { width, height } = gameSize;

    // Safely resize camera if it exists
    if (this.cameras.main) {
      this.cameras.main.setSize(width, height);
    }

    // Re-center text after resize
    if (this.bootingText) {
      this.centerText(this.bootingText, width, height);
    }
  }

  private onOrientationChange(orientation: string): void {
    // Handle orientation change
    console.log(`Orientation changed to: ${orientation}`);
  }

  private centerText(
    textObject: Phaser.GameObjects.Text,
    width?: number,
    height?: number,
  ): void {
    const centerX = width ?? this.cameras.main.width;
    const centerY = height ?? this.cameras.main.height;

    textObject.setPosition(centerX / 2, centerY / 2);
  }
}
