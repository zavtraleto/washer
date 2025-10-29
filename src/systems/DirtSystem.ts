import type { DirtLayerConfig, DirtLayerId } from '../types/config';
import { SilhouetteClip } from './SilhouetteClip';
import { RNG } from '../services/RNG';

const BLUR_RADIUS = 2; // Small radius for organic blobs.
const BLUR_DIAMETER = BLUR_RADIUS * 2 + 1;
const BINARY_SEARCH_STEPS = 12; // Iterations to approximate target coverage.
const BASE_RADIUS_PX = 10; // Base brush radius in grid pixels before per-layer scaling.

// Holds two 256² coverage maps (0..1) for mold/grease.
export class DirtSystem {
  private readonly size: number;
  private readonly layers: DirtLayerConfig[];
  private readonly mask: Uint8Array;
  private readonly maps: Map<DirtLayerId, Float32Array>;
  private readonly scratchA: Float32Array;
  private readonly scratchB: Float32Array;
  private readonly insideCount: number;

  constructor(
    size: number,
    layers: DirtLayerConfig[],
    silhouette: SilhouetteClip,
  ) {
    this.size = size;
    this.layers = layers;
    this.mask = silhouette.getMask();
    this.maps = new Map();

    const totalPixels = size * size;
    this.scratchA = new Float32Array(totalPixels);
    this.scratchB = new Float32Array(totalPixels);

    for (const layer of layers) {
      this.maps.set(layer.id, new Float32Array(totalPixels));
    }

    // Always guarantee both layer entries exist for shader hooks.
    if (!this.maps.has('mold')) {
      this.maps.set('mold', new Float32Array(totalPixels));
    }
    if (!this.maps.has('grease')) {
      this.maps.set('grease', new Float32Array(totalPixels));
    }

    let count = 0;
    for (let i = 0; i < this.mask.length; i += 1) {
      if (this.mask[i] === 1) {
        count += 1;
      }
    }
    this.insideCount = count;
  }

  init(rng: RNG, coverage: Record<DirtLayerId, number>): void {
    const totalPixels = this.size * this.size;

    for (const layer of this.layers) {
      const target = Math.min(1, Math.max(0, coverage[layer.id] ?? 0));
      const map = this.ensureMap(layer.id);

      if (target <= 0 || this.insideCount === 0) {
        map.fill(0);
        continue;
      }

      for (let i = 0; i < totalPixels; i += 1) {
        this.scratchA[i] = rng.float(); // Seed noise for organic dirt blobs.
      }

      this.applyBoxBlur(this.scratchA, this.scratchB); // Smooth noise for cohesive patches.

      const threshold = this.findThreshold(this.scratchA, target);

      for (let i = 0; i < totalPixels; i += 1) {
        const maskValue = this.mask[i] ?? 0;
        const noiseValue = this.scratchA[i] ?? 0;
        map[i] = maskValue === 1 && noiseValue >= threshold ? 1 : 0;
      }
    }

    // Ensure layers missing from catalog still respect target defaults.
    for (const id of ['mold', 'grease'] as DirtLayerId[]) {
      if (!this.maps.has(id)) {
        this.maps.set(id, new Float32Array(totalPixels));
      }
    }
  }

  getMap(id: DirtLayerId): Float32Array {
    return this.ensureMap(id); // Direct access for future shader/data usage.
  }

  getMapsForShader(): { size: number; map0: Float32Array; map1: Float32Array } {
    return {
      size: this.size,
      map0: this.ensureMap('mold'),
      map1: this.ensureMap('grease'),
    }; // Stable hook for future shader pipelines.
  }

  // what: reduce coverage around UV center using soft falloff per layer.
  applyStampUV(
    u: number,
    v: number,
    strength: number,
    radiusFactor: number,
  ): void {
    if (strength <= 0) {
      return;
    }

    const size = this.size;
    const clampedU = this.clamp01(u);
    const clampedV = this.clamp01(v);
    const centerX = Math.min(size - 1, Math.floor(clampedU * size));
    const centerY = Math.min(size - 1, Math.floor(clampedV * size));
    const safeRadiusFactor = Math.max(0.2, radiusFactor); // why: guard against tiny/negative jitter.

    for (const layer of this.layers) {
      const map = this.ensureMap(layer.id);
      const radius = Math.max(
        1,
        BASE_RADIUS_PX * layer.baseRadius * safeRadiusFactor,
      );
      const radiusSq = radius * radius;
      const minX = Math.max(0, Math.floor(centerX - radius));
      const maxX = Math.min(size - 1, Math.ceil(centerX + radius));
      const minY = Math.max(0, Math.floor(centerY - radius));
      const maxY = Math.min(size - 1, Math.ceil(centerY + radius));

      for (let y = minY; y <= maxY; y += 1) {
        const dy = y - centerY;
        for (let x = minX; x <= maxX; x += 1) {
          const dx = x - centerX;
          const distSq = dx * dx + dy * dy;
          if (distSq > radiusSq) {
            continue;
          }

          const index = y * size + x;
          if ((this.mask[index] ?? 0) === 0) {
            continue; // Respect silhouette: ignore outside pixels.
          }

          const distance = Math.sqrt(distSq);
          if (distance >= radius) {
            continue;
          }

          const falloff = this.softFalloff(distance / radius);
          if (falloff <= 0) {
            continue;
          }

          const delta = falloff * strength * layer.eraseRate;
          const current = map[index] ?? 0;
          const next = current - delta;
          map[index] = next > 0 ? next : 0;
        }
      }
    }
  }

  getUnionDirtyRatio(eps = 0.05): number {
    if (this.insideCount === 0) {
      return 0;
    }

    const map0 = this.ensureMap('mold');
    const map1 = this.ensureMap('grease');
    let dirty = 0;

    for (let i = 0; i < this.mask.length; i += 1) {
      const maskValue = this.mask[i] ?? 0;
      if (maskValue === 0) {
        continue; // Respect object silhouette: outside pixels stay clean.
      }
      const value0 = map0[i] ?? 0;
      const value1 = map1[i] ?? 0;
      if (value0 > eps || value1 > eps) {
        dirty += 1;
      }
    }

    return dirty / this.insideCount; // Union dirty ratio used by progress UI later.
  }

  // Get the maximum dirt value at a specific UV coordinate (union of all layers).
  getUnionDirtyValueAt(u: number, v: number): number {
    const size = this.size;
    const clampedU = this.clamp01(u);
    const clampedV = this.clamp01(v);
    const x = Math.min(size - 1, Math.floor(clampedU * size));
    const y = Math.min(size - 1, Math.floor(clampedV * size));
    const index = y * size + x;

    if ((this.mask[index] ?? 0) === 0) {
      return 0; // Outside silhouette.
    }

    const map0 = this.ensureMap('mold');
    const map1 = this.ensureMap('grease');
    return Math.max(map0[index] ?? 0, map1[index] ?? 0);
  }

  private ensureMap(id: DirtLayerId): Float32Array {
    let map = this.maps.get(id);
    if (!map) {
      map = new Float32Array(this.size * this.size);
      this.maps.set(id, map);
    }
    return map;
  }

  private applyBoxBlur(buffer: Float32Array, temp: Float32Array): void {
    const size = this.size;

    for (let y = 0; y < size; y += 1) {
      let sum = 0;
      const rowOffset = y * size;
      for (let k = -BLUR_RADIUS; k <= BLUR_RADIUS; k += 1) {
        const index = rowOffset + this.clampColumn(k);
        sum += buffer[index] ?? 0;
      }
      for (let x = 0; x < size; x += 1) {
        temp[rowOffset + x] = sum / BLUR_DIAMETER;
        const removeIndex = rowOffset + this.clampColumn(x - BLUR_RADIUS);
        const addIndex = rowOffset + this.clampColumn(x + BLUR_RADIUS + 1);
        sum += (buffer[addIndex] ?? 0) - (buffer[removeIndex] ?? 0);
      }
    }

    for (let x = 0; x < size; x += 1) {
      let sum = 0;
      for (let k = -BLUR_RADIUS; k <= BLUR_RADIUS; k += 1) {
        const index = this.clampRow(k) * size + x;
        sum += temp[index] ?? 0;
      }
      for (let y = 0; y < size; y += 1) {
        const idx = y * size + x;
        buffer[idx] = sum / BLUR_DIAMETER;
        const removeIndex = this.clampRow(y - BLUR_RADIUS) * size + x;
        const addIndex = this.clampRow(y + BLUR_RADIUS + 1) * size + x;
        sum += (temp[addIndex] ?? 0) - (temp[removeIndex] ?? 0);
      }
    }
  }

  private findThreshold(values: Float32Array, target: number): number {
    if (target >= 1) {
      return 0; // Full coverage keeps every pixel inside silhouette.
    }
    if (target <= 0 || this.insideCount === 0) {
      return 1; // No coverage desired.
    }

    let low = 0;
    let high = 1;

    for (let i = 0; i < BINARY_SEARCH_STEPS; i += 1) {
      const mid = (low + high) * 0.5;
      const ratio = this.coverageRatio(values, mid);
      if (ratio > target) {
        low = mid;
      } else {
        high = mid;
      }
    }

    return (low + high) * 0.5;
  }

  private coverageRatio(values: Float32Array, threshold: number): number {
    if (this.insideCount === 0) {
      return 0;
    }
    let count = 0;
    for (let i = 0; i < values.length; i += 1) {
      const maskValue = this.mask[i] ?? 0;
      const value = values[i] ?? 0;
      if (maskValue === 1 && value >= threshold) {
        count += 1;
      }
    }
    return count / this.insideCount;
  }

  private softFalloff(distanceRatio: number): number {
    const clamped = Math.min(1, Math.max(0, distanceRatio));
    if (clamped >= 1) {
      return 0;
    }
    const inv = 1 - clamped;
    return inv * inv; // why: cheap smooth falloff (soft brush feel).
  }

  private clampColumn(value: number): number {
    return this.clampCoordinate(value);
  }

  private clampRow(value: number): number {
    return this.clampCoordinate(value);
  }

  private clampCoordinate(value: number): number {
    if (value < 0) {
      return 0;
    }
    if (value >= this.size) {
      return this.size - 1;
    }
    return value;
  }

  private clamp01(value: number): number {
    if (Number.isNaN(value)) {
      return 0;
    }
    if (value <= 0) {
      return 0;
    }
    if (value >= 1) {
      return 1;
    }
    return value;
  }
}
