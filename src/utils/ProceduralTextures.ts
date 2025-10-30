// Generates procedural fallback dirt textures using canvas 2D API.
// These are placeholder textures until user provides real PNG assets.

export class ProceduralTextures {
  // Generate a tileable dirt texture with noise and color variation.
  static generateDirtTexture(
    size: number,
    baseColor: { r: number; g: number; b: number },
    variation: number,
  ): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('ProceduralTextures: failed to get 2D context.');
    }

    const imageData = ctx.createImageData(size, size);
    const data = imageData.data;

    // Simple noise-based texture generation.
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const idx = (y * size + x) * 4;

        // Multi-octave noise for detail (cheap approximation).
        const noise1 = Math.random();
        const noise2 = Math.random();
        const noise3 = Math.random();
        const combinedNoise = noise1 * 0.5 + noise2 * 0.3 + noise3 * 0.2;

        // Apply color variation.
        const variance = (combinedNoise - 0.5) * variation;
        data[idx] = Math.max(0, Math.min(255, baseColor.r + variance)); // R
        data[idx + 1] = Math.max(0, Math.min(255, baseColor.g + variance)); // G
        data[idx + 2] = Math.max(0, Math.min(255, baseColor.b + variance)); // B
        data[idx + 3] = 255; // A (opaque)
      }
    }

    ctx.putImageData(imageData, 0, 0);

    // Apply slight blur for smoothness (makes it less noisy).
    ctx.filter = 'blur(1px)';
    ctx.drawImage(canvas, 0, 0);
    ctx.filter = 'none';

    return canvas;
  }

  // Generate mold texture (bright lime green, cartoonish Nintendo-style).
  static generateMoldTexture(size = 256): HTMLCanvasElement {
    return this.generateDirtTexture(
      size,
      { r: 100, g: 200, b: 80 }, // Bright lime green base
      100, // High variation for depth (darker emerald in shadows)
    );
  }

  // Generate grease texture (rich dark brown, bold and saturated).
  static generateGreaseTexture(size = 256): HTMLCanvasElement {
    return this.generateDirtTexture(
      size,
      { r: 80, g: 50, b: 30 }, // Rich brown base
      60, // Variation for texture depth
    );
  }
}
