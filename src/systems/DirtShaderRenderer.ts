import Phaser from 'phaser';

import { ProceduralTextures } from '../utils/ProceduralTextures';

// Minimal interface for dirt coverage data (clean separation from logic).
export interface DirtMaps {
  size: number; // Dimension of coverage maps (e.g., 256).
  map0: Float32Array; // Mold coverage (0..1).
  map1: Float32Array; // Grease coverage (0..1).
}

// Renders dirt using texture sampling (GPU-accelerated blending).
// Simple MVP approach: bake dirt texture on demand, no custom shaders yet.
export class DirtShaderRenderer {
  private readonly scene: Phaser.Scene;
  private readonly mesh: Phaser.GameObjects.Mesh;
  private readonly canvasTexture: Phaser.Textures.CanvasTexture;
  private readonly context: CanvasRenderingContext2D;
  private readonly baseImageData: ImageData;
  private readonly dirtTexture0: HTMLCanvasElement;
  private readonly dirtTexture1: HTMLCanvasElement;
  private readonly textureSize: number;
  private readonly textureKey: string;

  constructor(
    scene: Phaser.Scene,
    mesh: Phaser.GameObjects.Mesh,
    baseTextureKey: string,
  ) {
    this.scene = scene;
    this.mesh = mesh;
    this.textureSize = 256;
    this.textureKey = `${baseTextureKey}_dirty_shader`;

    // Load or generate dirt textures (tileable).
    this.dirtTexture0 = this.loadOrGenerateDirtTexture('mold');
    this.dirtTexture1 = this.loadOrGenerateDirtTexture('grease');

    // Create dynamic canvas texture for rendering.
    if (scene.textures.exists(this.textureKey)) {
      scene.textures.remove(this.textureKey);
    }

    const canvasTexture = scene.textures.createCanvas(
      this.textureKey,
      this.textureSize,
      this.textureSize,
    );
    if (!canvasTexture) {
      throw new Error('DirtShaderRenderer: failed to create canvas texture.');
    }
    this.canvasTexture = canvasTexture;

    const context = this.canvasTexture.getContext();
    if (!context) {
      throw new Error('DirtShaderRenderer: missing 2D context.');
    }
    this.context = context;

    // Pre-render base texture to ImageData for fast blending.
    this.baseImageData = this.extractBaseTexture(baseTextureKey);

    // Apply the dynamic texture to mesh.
    this.mesh.setTexture(this.textureKey);
  }

  // Update dirt rendering (call when coverage maps change).
  update(maps: DirtMaps): void {
    if (maps.size !== this.textureSize) {
      // eslint-disable-next-line no-console
      console.warn(
        `[DirtShaderRenderer] Map size mismatch: expected ${this.textureSize}, got ${maps.size}`,
      );
      return;
    }

    // Render dirt texture based on coverage maps.
    this.renderDirtTexture(maps);
  }

  // Clean up resources.
  destroy(): void {
    this.scene.textures.remove(this.textureKey);
  }

  // Extract base texture pixels for blending.
  private extractBaseTexture(key: string): ImageData {
    const texture = this.scene.textures.get(key);
    const source = texture.getSourceImage() as HTMLImageElement;

    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = this.textureSize;
    offscreenCanvas.height = this.textureSize;
    const offscreenCtx = offscreenCanvas.getContext('2d');
    if (!offscreenCtx) {
      throw new Error(
        'DirtShaderRenderer: failed to create offscreen context.',
      );
    }

    // Draw base texture scaled to dirt map size.
    offscreenCtx.drawImage(source, 0, 0, this.textureSize, this.textureSize);

    return offscreenCtx.getImageData(0, 0, this.textureSize, this.textureSize);
  }

  // Smoothstep interpolation for soft edges (GLSL-style).
  private smoothstep(edge0: number, edge1: number, x: number): number {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  }

  // Render dirt texture by sampling from tileable textures based on coverage.
  private renderDirtTexture(maps: DirtMaps): void {
    const size = this.textureSize;
    const baseData = this.baseImageData.data;
    const workImageData = this.context.createImageData(size, size);
    const workData = workImageData.data;

    // Pre-render dirt textures to ImageData for fast sampling.
    const moldData = this.getTextureData(this.dirtTexture0);
    const greaseData = this.getTextureData(this.dirtTexture1);

    const moldSize = this.dirtTexture0.width;
    const greaseSize = this.dirtTexture1.width;

    // Blend dirt onto base texture pixel by pixel.
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const idx = y * size + x;
        const pixelIdx = idx * 4;

        const moldCov = maps.map0[idx] ?? 0;
        const greaseCov = maps.map1[idx] ?? 0;

        // Start with clean base pixel.
        let r = baseData[pixelIdx] ?? 0;
        let g = baseData[pixelIdx + 1] ?? 0;
        let b = baseData[pixelIdx + 2] ?? 0;
        const a = baseData[pixelIdx + 3] ?? 255;

        // Detect overlap for special blend effect (darker "crusty" layer).
        const bothPresent = moldCov > 0.05 && greaseCov > 0.05;

        // Sample mold texture (tileable with pseudo-random offset).
        if (moldCov > 0.05) {
          const hash = ((x * 157 + y * 311) % 1000) / 1000;
          const offsetX = Math.floor(hash * moldSize * 0.2);
          const offsetY = Math.floor((1 - hash) * moldSize * 0.2);
          const moldX = (x * 4 + offsetX) % moldSize;
          const moldY = (y * 4 + offsetY) % moldSize;
          const moldIdx = (moldY * moldSize + moldX) * 4;

          const moldR = moldData[moldIdx] ?? 0;
          const moldG = moldData[moldIdx + 1] ?? 0;
          const moldB = moldData[moldIdx + 2] ?? 0;

          // Smooth alpha with smoothstep for soft edges.
          const moldAlpha = this.smoothstep(0.05, 0.15, moldCov);

          r = r * (1 - moldAlpha) + moldR * moldAlpha;
          g = g * (1 - moldAlpha) + moldG * moldAlpha;
          b = b * (1 - moldAlpha) + moldB * moldAlpha;
        }

        // Sample grease texture (different tiling scale).
        if (greaseCov > 0.05) {
          const hash = ((x * 311 + y * 127) % 1000) / 1000;
          const offsetX = Math.floor(hash * greaseSize * 0.2);
          const offsetY = Math.floor(hash * 0.8 * greaseSize * 0.2);
          const greaseX = (x * 6 + offsetX) % greaseSize;
          const greaseY = (y * 6 + offsetY) % greaseSize;
          const greaseIdx = (greaseY * greaseSize + greaseX) * 4;

          const greaseR = greaseData[greaseIdx] ?? 0;
          const greaseG = greaseData[greaseIdx + 1] ?? 0;
          const greaseB = greaseData[greaseIdx + 2] ?? 0;

          // Smooth alpha with smoothstep for soft edges.
          const greaseAlpha = this.smoothstep(0.05, 0.15, greaseCov);

          r = r * (1 - greaseAlpha) + greaseR * greaseAlpha;
          g = g * (1 - greaseAlpha) + greaseG * greaseAlpha;
          b = b * (1 - greaseAlpha) + greaseB * greaseAlpha;
        }

        // Apply darker blend where mold and grease overlap (crusty effect).
        if (bothPresent) {
          const overlapStrength = Math.min(moldCov, greaseCov);
          const darkenFactor = this.smoothstep(0.05, 0.3, overlapStrength);
          const darkenAmount = 0.65; // Darken by 35%.
          r *= 1 - darkenAmount * darkenFactor;
          g *= 1 - darkenAmount * darkenFactor;
          b *= 1 - darkenAmount * darkenFactor;
        }

        workData[pixelIdx] = r;
        workData[pixelIdx + 1] = g;
        workData[pixelIdx + 2] = b;
        workData[pixelIdx + 3] = a;
      }
    }

    this.context.putImageData(workImageData, 0, 0);
    this.canvasTexture.refresh();
  }

  // Extract pixel data from canvas for sampling.
  private getTextureData(canvas: HTMLCanvasElement): Uint8ClampedArray {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('DirtShaderRenderer: failed to get canvas context.');
    }
    return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  }

  // Load dirt texture from assets, or generate procedural fallback.
  private loadOrGenerateDirtTexture(
    type: 'mold' | 'grease',
  ): HTMLCanvasElement {
    const assetKey = `dirt_${type}`;

    // Check if user provided a PNG asset.
    if (this.scene.textures.exists(assetKey)) {
      const texture = this.scene.textures.get(assetKey);
      const source = texture.getSourceImage() as HTMLImageElement;

      // Copy to canvas for pixel access.
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(source, 0, 0, 256, 256);
      }
      return canvas;
    }

    // Generate procedural fallback texture.
    const canvas =
      type === 'mold'
        ? ProceduralTextures.generateMoldTexture(256)
        : ProceduralTextures.generateGreaseTexture(256);

    // eslint-disable-next-line no-console
    console.log(
      `[DirtShaderRenderer] Using procedural ${type} texture (add '${assetKey}.png' to assets for custom texture).`,
    );

    return canvas;
  }
}
