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
  speedBoost: boolean;
}

// PowerWash tool config.
export interface PowerWashConfig {
  id: 'powerwash';
  name: 'Power Wash';
  sourceAnchorX: number;
  sourceAnchorY: number;
  springStiffness: number;
  springDamping: number;
  pressureRiseSpeed: number;
  pressureFallSpeed: number;
  baseStrength: number;
  jitter: number;
  streamWidth: number;
  streamColor: number;
}

export interface ObjectDef {
  id: string;
  sprite: string;
}

export interface Catalog {
  object: ObjectDef;
  layers: DirtLayerConfig[];
  tools?: {
    // New multi-tool config.
    scrubber: ScrubbingConfig;
    powerwash: PowerWashConfig;
  };
}
