import Phaser from 'phaser';
import { SCENE_KEYS, GAME_CONFIG } from '../types/constants';

export class PreloadScene extends Phaser.Scene {
  private progressBar?: Phaser.GameObjects.Graphics;
  private progressBox?: Phaser.GameObjects.Graphics;

  constructor() {
    super({ key: SCENE_KEYS.PRELOAD });
  }

  preload(): void {
    // Create progress bar
    this.createProgressBar();

    // Setup loader event listeners
    this.load.on('progress', this.onProgress, this);
    this.load.on('complete', this.onComplete, this);

    // Load catalog.json
    this.load.json('catalog', 'assets/catalog.json');

    // Load placeholder textures - objects
    this.load.image('objects/key', 'assets/objects/key.png');

    // Load placeholder textures - dirt
    this.load.image('dirt/mold_diffuse', 'assets/dirt/mold_diffuse.png');
    this.load.image('dirt/grease_diffuse', 'assets/dirt/grease_diffuse.png');

    // Load placeholder textures - masks
    this.load.image('masks/mold_mask', 'assets/masks/mold_mask.png');
    this.load.image('masks/grease_mask', 'assets/masks/grease_mask.png');
  }

  private createProgressBar(): void {
    const centerX = GAME_CONFIG.WIDTH / 2;
    const centerY = GAME_CONFIG.HEIGHT / 2;
    const barWidth = 400;
    const barHeight = 30;

    // Background box
    this.progressBox = this.add.graphics();
    this.progressBox.fillStyle(0x222222, 0.8);
    this.progressBox.fillRect(
      centerX - barWidth / 2 - 10,
      centerY - barHeight / 2 - 10,
      barWidth + 20,
      barHeight + 20,
    );

    // Progress bar
    this.progressBar = this.add.graphics();

    // Loading text
    const loadingText = this.add.text(centerX, centerY - 50, 'Loading...', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '32px',
      color: '#ffffff',
    });
    loadingText.setOrigin(0.5);

    // Percentage text
    const percentText = this.add.text(centerX, centerY, '0%', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '24px',
      color: '#ffffff',
    });
    percentText.setOrigin(0.5);

    // Update percentage on progress
    this.load.on('progress', (value: number) => {
      percentText.setText(`${Math.round(value * 100)}%`);
    });
  }

  private onProgress(value: number): void {
    if (!this.progressBar) return;

    const centerX = GAME_CONFIG.WIDTH / 2;
    const centerY = GAME_CONFIG.HEIGHT / 2;
    const barWidth = 400;
    const barHeight = 30;

    // Clear and redraw progress bar
    this.progressBar.clear();
    this.progressBar.fillStyle(0x00ff00, 1);
    this.progressBar.fillRect(
      centerX - barWidth / 2,
      centerY - barHeight / 2,
      barWidth * value,
      barHeight,
    );
  }

  private onComplete(): void {
    // Clean up loader listeners
    this.load.off('progress', this.onProgress, this);
    this.load.off('complete', this.onComplete, this);

    // Retrieve and log catalog data (optional)
    const catalog = this.cache.json.get('catalog');
    console.log('Catalog loaded:', catalog);

    // Start Game scene and launch UI scene
    this.scene.start(SCENE_KEYS.GAME);
    this.scene.launch(SCENE_KEYS.UI);
  }
}
