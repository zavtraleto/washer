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

    // Optional: Load custom dirt textures (if provided).
    // If these assets don't exist, DirtShaderRenderer will use procedural fallbacks.
    this.load.image('dirt_mold', 'objects/dirt_mold.png');
    this.load.image('dirt_grease', 'objects/dirt_grease.png');

    // Suppress 404 errors for optional assets (they're intentionally optional).
    this.load.on('loaderror', (file: Phaser.Loader.File) => {
      if (file.key === 'dirt_mold' || file.key === 'dirt_grease') {
        // Silently ignore - procedural textures will be used instead.
        return;
      }
      // eslint-disable-next-line no-console
      console.error(`[PreloadScene] Failed to load: ${file.key}`);
    });
  }

  create(): void {
    this.scene.start('GameScene'); // switch to gameplay scene
    this.scene.launch('UIScene'); // overlay UI scene in parallel
  }
}
