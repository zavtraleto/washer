import type { Catalog } from '../types/config';

export function getCatalog(): Catalog {
  return {
    object: {
      id: 'key_v1',
      sprite: 'objects/shield.png',
    },
    layers: [
      {
        id: 'mold',
        eraseRate: 0.6,
        baseRadius: 1.5,
        debugColor: 0x33ff66,
      },
      {
        id: 'grease',
        eraseRate: 0.9,
        baseRadius: 1.55,
        debugColor: 0x8a5a2b,
      },
    ],
    tool: {
      id: 'water_jet',
      spacing: 10,
      falloff: 'soft',
      jitter: 0.08,
      strength: 1.0,
      speedBoost: true,
    },
    tools: {
      scrubber: {
        id: 'scrubber',
        name: 'Scrubber',
        spacing: 10,
        jitter: 0.08,
        strength: 1.0,
        speedBoost: true,
      },
      powerwash: {
        id: 'powerwash',
        name: 'Power Wash',
        maxRange: 500, // Max stream distance (px).
        streamWidth: 20, // Stream visual width (for future rendering).
        pressure: 1.5, // Higher erosion strength than scrubber.
        tickRate: 20, // 20 stamps per second for continuous feel.
        jitter: 0.12,
      },
    },
  };
}
