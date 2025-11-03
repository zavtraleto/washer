export type DirtLayerId = 'mold' | 'grease';

export interface DirtLayerConfig {
  id: DirtLayerId;
  eraseRate: number;
  baseRadius: number;
  debugColor?: number;
}

// Legacy tool config for scrubbing tool (backward compatibility).
export interface ToolConfig {
  id: 'water_jet';
  spacing: number;
  falloff: 'soft';
  jitter: number;
  strength: number;
  speedBoost: boolean;
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
  maxRange: number;
  streamWidth: number;
  pressure: number;
  tickRate: number;
  jitter: number;
}

export interface ObjectDef {
  id: 'key_v1';
  sprite: string;
}

export interface Catalog {
  object: ObjectDef;
  layers: DirtLayerConfig[];
  tool: ToolConfig; // Legacy single tool (for backward compatibility).
  tools?: {
    // New multi-tool config.
    scrubber: ScrubbingConfig;
    powerwash: PowerWashConfig;
  };
}
