import type { Catalog } from '../types/config';

export function getCatalog(): Catalog {
  return {
    object: {
      id: 'key_v1',
      sprite: 'assets/objects/key.png',
    },
    layers: [
      {
        id: 'mold',
        eraseRate: 1.0,
        baseRadius: 1.15,
        debugColor: 0x33ff66,
      },
      {
        id: 'grease',
        eraseRate: 0.6,
        baseRadius: 0.85,
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
  };
}
