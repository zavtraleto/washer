import Phaser from 'phaser';

import { getCatalog } from '../services/Catalog';

const catalog = getCatalog();
export const OBJECT_TEXTURE_KEY = catalog.object.id;
const OBJECT_TEXTURE_PATH = catalog.object.sprite;

export default class PreloadScene extends Phaser.Scene {
  constructor() {
    super('PreloadScene');
  }

  preload(): void {
    this.load.image(OBJECT_TEXTURE_KEY, OBJECT_TEXTURE_PATH); // preload object sprite from catalog
  }

  create(): void {
    this.scene.start('GameScene'); // switch to gameplay scene
    this.scene.launch('UIScene'); // overlay UI scene in parallel
  }
}
