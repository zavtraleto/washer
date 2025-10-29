// Deterministic PRNG for reproducible dirt patterns.
export class RNG {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
    if (this.state === 0) {
      this.state = 0x6d2b79f5; // Avoid zero seed degeneracy.
    }
  }

  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0; // Return unsigned 32-bit integer.
  }

  float(): number {
    return this.next() / 0x100000000; // Normalize to [0,1).
  }
}
