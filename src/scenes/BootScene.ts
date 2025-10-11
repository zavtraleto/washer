import Phaser from 'phaser';

const BACKGROUND_COLOR = 0x10131a;

export default class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create(): void {
    this.scale.scaleMode = Phaser.Scale.FIT; // keep canvas responsive
    this.scale.autoCenter = Phaser.Scale.CENTER_BOTH; // center canvas on any display
    this.cameras.main.setBackgroundColor(BACKGROUND_COLOR); // neutral dark backdrop
    this.scene.start('PreloadScene'); // proceed to preload assets
  }
}
