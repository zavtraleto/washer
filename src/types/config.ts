export type DirtLayerId = 'mold' | 'grease';

export interface DirtLayerConfig {
  id: DirtLayerId;
  eraseRate: number;
  baseRadius: number;
  debugColor?: number;
}

// Scrubbing tool config.
export interface ScrubbingConfig {
  id: 'scrubber';
  name: 'Scrubber';
  spacing: number;
  jitter: number;
  strength: number;
}

export interface ObjectDef {
  id: string;
  sprite: string;
}

export interface Catalog {
  object: ObjectDef;
  layers: DirtLayerConfig[];
  tools: {
    // New multi-tool config.
    scrubber: ScrubbingConfig;
  };
}
