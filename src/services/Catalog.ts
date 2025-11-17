import type { Catalog } from '../types/config';

export function getCatalog(): Catalog {
  return {
    object: {
      id: 'shield',
      sprite: 'objects/shield.png',
    }, //TODO expand to objects, add road_sign, etc.
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
    tools: {
      scrubber: {
        id: 'scrubber',
        name: 'Scrubber',
        spacing: 10,
        jitter: 0.08,
        strength: 1.0,
      },
    },
  };
}
