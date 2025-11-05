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
    // tool: {
    //   id: 'water_jet',
    //   spacing: 10,
    //   falloff: 'soft',
    //   jitter: 0.08,
    //   strength: 1.0,
    //   speedBoost: true,
    // },
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
        sourceAnchorX: 0.95,
        sourceAnchorY: 0.95,
        springStiffness: 0.08,
        springDamping: 0.45,
        pressureRiseSpeed: 4,
        pressureFallSpeed: 2.5,
        baseStrength: 8.0,
        jitter: 0.1,
        streamWidth: 8,
        streamColor: 0x4da6ff,
      },
    },
  };
}
