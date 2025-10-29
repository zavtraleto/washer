import Phaser from 'phaser';

// Config for dirt appearance (colors and blend settings).
export interface DirtRenderConfig {
  moldColor: number; // Hex color for mold dirt layer.
  greaseColor: number; // Hex color for grease dirt layer.
  darkenFactor: number; // How much to darken (0..1, where 1 = full black).
  textureSize: number; // Size of the dynamic texture (should match dirt map size).
}

const DEFAULT_CONFIG: DirtRenderConfig = {
  moldColor: 0x33ff66, // Green tint for mold.
  greaseColor: 0x8a5a2b, // Brown tint for grease.
  darkenFactor: 0.6, // 60% darkening.
  textureSize: 256,
};

// Renders dirt maps directly onto mesh texture (real-time blending).
export class DirtTextureRenderer {
  private readonly canvasTexture: Phaser.Textures.CanvasTexture;
  private readonly context: CanvasRenderingContext2D;
  private readonly baseImageData: ImageData;
  private readonly workImageData: ImageData;
  private readonly config: DirtRenderConfig;
  private readonly textureKey: string;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly mesh: Phaser.GameObjects.Mesh,
    baseTextureKey: string,
    config: Partial<DirtRenderConfig> = {},
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.textureKey = `${baseTextureKey}_dirty`;

    // Create dynamic canvas texture for blending.
    if (scene.textures.exists(this.textureKey)) {
      scene.textures.remove(this.textureKey);
    }

    const canvasTexture = scene.textures.createCanvas(
      this.textureKey,
      this.config.textureSize,
      this.config.textureSize,
    );
    if (!canvasTexture) {
      throw new Error('DirtTextureRenderer: failed to create canvas texture.');
    }
    this.canvasTexture = canvasTexture;

    const context = this.canvasTexture.getContext();
    if (!context) {
      throw new Error('DirtTextureRenderer: missing 2D context.');
    }
    this.context = context;

    // Pre-render base texture to ImageData for fast blending.
    this.baseImageData = this.extractBaseTexture(baseTextureKey);
    this.workImageData = this.context.createImageData(
      this.config.textureSize,
      this.config.textureSize,
    );

    // Apply the dynamic texture to mesh.
    this.mesh.setTexture(this.textureKey);
  }

  // Extract base texture pixels for blending.
  private extractBaseTexture(key: string): ImageData {
    const texture = this.scene.textures.get(key);
    const source = texture.getSourceImage() as HTMLImageElement;

    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = this.config.textureSize;
    offscreenCanvas.height = this.config.textureSize;
    const offscreenCtx = offscreenCanvas.getContext('2d');
    if (!offscreenCtx) {
      throw new Error(
        'DirtTextureRenderer: failed to create offscreen context.',
      );
    }

    // Draw base texture scaled to dirt map size.
    offscreenCtx.drawImage(
      source,
      0,
      0,
      this.config.textureSize,
      this.config.textureSize,
    );

    return offscreenCtx.getImageData(
      0,
      0,
      this.config.textureSize,
      this.config.textureSize,
    );
  }

  // Update mesh texture with current dirt maps (call every frame).
  updateTexture(map0: Float32Array, map1: Float32Array): void {
    const size = this.config.textureSize;
    const baseData = this.baseImageData.data;
    const workData = this.workImageData.data;
    const darkenFactor = this.config.darkenFactor;

    // Extract RGB from hex colors.
    const moldR = (this.config.moldColor >> 16) & 0xff;
    const moldG = (this.config.moldColor >> 8) & 0xff;
    const moldB = this.config.moldColor & 0xff;

    const greaseR = (this.config.greaseColor >> 16) & 0xff;
    const greaseG = (this.config.greaseColor >> 8) & 0xff;
    const greaseB = this.config.greaseColor & 0xff;

    // Blend dirt onto base texture.
    const length = size * size;
    for (let i = 0; i < length; i += 1) {
      const moldValue = map0[i] ?? 0;
      const greaseValue = map1[i] ?? 0;
      const totalDirt = Math.max(moldValue, greaseValue); // Union.

      const idx = i * 4;
      const baseR = baseData[idx] ?? 0;
      const baseG = baseData[idx + 1] ?? 0;
      const baseB = baseData[idx + 2] ?? 0;
      const baseA = baseData[idx + 3] ?? 255;

      if (totalDirt > 0.05) {
        // Determine dominant dirt type for color tint.
        const isMoldDominant = moldValue > greaseValue;
        const tintR = isMoldDominant ? moldR : greaseR;
        const tintG = isMoldDominant ? moldG : greaseG;
        const tintB = isMoldDominant ? moldB : greaseB;

        // Darken base color and blend with dirt tint.
        const darken = 1 - totalDirt * darkenFactor;
        const tintAmount = totalDirt * 0.3; // 30% tint influence.

        workData[idx] = baseR * darken * (1 - tintAmount) + tintR * tintAmount;
        workData[idx + 1] =
          baseG * darken * (1 - tintAmount) + tintG * tintAmount;
        workData[idx + 2] =
          baseB * darken * (1 - tintAmount) + tintB * tintAmount;
        workData[idx + 3] = baseA;
      } else {
        // Clean area: use base texture as-is.
        workData[idx] = baseR;
        workData[idx + 1] = baseG;
        workData[idx + 2] = baseB;
        workData[idx + 3] = baseA;
      }
    }

    // Write blended result to canvas and refresh texture.
    this.context.putImageData(this.workImageData, 0, 0);
    this.canvasTexture.refresh();
  }

  destroy(): void {
    this.canvasTexture.destroy();
  }
}
