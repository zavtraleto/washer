import Phaser from 'phaser';

// Builds a binary silhouette mask from a texture's alpha channel.
export class SilhouetteClip {
  private readonly mask: Uint8Array; // Binary alpha mask stored row-major.
  private readonly size: number; // Dimension of the square mask grid.

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly textureKey: string,
    size = 256,
    alphaThreshold = 0.5,
  ) {
    this.size = size;
    this.mask = this.buildMask(size, alphaThreshold);
  }

  getSize(): number {
    return this.size; // Expose mask dimension for consumers.
  }

  getMask(): Uint8Array {
    return this.mask; // Provide raw mask data for advanced systems.
  }

  testUV(u: number, v: number): boolean {
    const index = this.uvToIndex(u, v);
    return this.mask[index] === 1; // Fast membership check for gameplay systems.
  }

  uvToIndex(u: number, v: number): number {
    const clampedU = this.clamp01(u);
    const clampedV = this.clamp01(v);
    const x = Math.min(this.size - 1, Math.floor(clampedU * this.size));
    const y = Math.min(this.size - 1, Math.floor(clampedV * this.size));
    return y * this.size + x; // Map UV coordinates to the mask's linear index.
  }

  private buildMask(size: number, alphaThreshold: number): Uint8Array {
    const texture = this.scene.textures.get(this.textureKey);
    if (!texture) {
      throw new Error(
        `SilhouetteClip: texture '${this.textureKey}' not found.`,
      );
    }

    const source = texture.getSourceImage() as
      | HTMLImageElement
      | HTMLCanvasElement
      | ImageBitmap;

    if (!source) {
      throw new Error(
        `SilhouetteClip: source image missing for '${this.textureKey}'.`,
      );
    }

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('SilhouetteClip: failed to acquire 2D context.');
    }

    context.drawImage(source, 0, 0, size, size); // Project texture alpha into mask resolution.
    const imageData = context.getImageData(0, 0, size, size);
    const data = imageData.data;
    const mask = new Uint8Array(size * size);
    const threshold = Math.floor(alphaThreshold * 255);

    for (let i = 0; i < size * size; i += 1) {
      const alphaIndex = i * 4 + 3;
      const alpha = data[alphaIndex] ?? 0;
      mask[i] = alpha >= threshold ? 1 : 0; // Mark silhouette pixels based on alpha.
    }

    return mask;
  }

  private clamp01(value: number): number {
    if (Number.isNaN(value)) {
      return 0; // Guard against invalid inputs.
    }
    return Math.min(1, Math.max(0, value));
  }
}
