import Phaser from 'phaser';

// Debug overlay: shows union of dirt maps as grayscale on top of the object.
export class DirtDebugOverlay {
  private readonly texture: Phaser.Textures.CanvasTexture;
  private readonly context: CanvasRenderingContext2D;
  private readonly imageData: ImageData;
  private readonly image: Phaser.GameObjects.Image;

  constructor(
    scene: Phaser.Scene,
    private readonly objectMesh: Phaser.GameObjects.Mesh,
    private readonly size: number,
  ) {
    const key = 'dirt_debug_overlay';
    if (scene.textures.exists(key)) {
      scene.textures.remove(key);
    }
    const texture = scene.textures.createCanvas(key, size, size);
    if (!texture) {
      throw new Error('DirtDebugOverlay: failed to create canvas texture.');
    }
    this.texture = texture;
    const context = this.texture.getContext();
    if (!context) {
      throw new Error('DirtDebugOverlay: missing 2D context.');
    }
    this.context = context;
    this.imageData = context.createImageData(size, size);
    this.image = scene.add.image(objectMesh.x, objectMesh.y, key);
    this.image.setOrigin(0.5, 0.5);
    this.image.setAlpha(0.35);
    this.image.setBlendMode(Phaser.BlendModes.NORMAL);
    this.image.setDepth(objectMesh.depth + 1);
    this.relayout();
  }

  updateUnion(map0: Float32Array, map1: Float32Array): void {
    const data = this.imageData.data;
    const length = this.size * this.size;
    for (let i = 0; i < length; i += 1) {
      const value = Math.max(map0[i] ?? 0, map1[i] ?? 0);
      const shade = Math.max(0, Math.min(255, (value * 255) | 0));
      const idx = i * 4;
      data[idx] = shade;
      data[idx + 1] = shade;
      data[idx + 2] = shade;
      data[idx + 3] = 170; // Keep overlay translucent.
    }
    this.context.putImageData(this.imageData, 0, 0);
    this.texture.refresh();
  }

  relayout(): void {
    this.image.setPosition(this.objectMesh.x, this.objectMesh.y); // Relayout overlay with the object so sizes stay in sync.
    this.image.setDisplaySize(
      this.objectMesh.displayWidth,
      this.objectMesh.displayHeight,
    );
  }

  destroy(): void {
    this.image.destroy();
    this.texture.destroy();
  }
}
