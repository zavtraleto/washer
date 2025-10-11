export type DirtLayerId = 'mold' | 'grease';

export interface DirtLayerConfig {
  id: DirtLayerId;
  eraseRate: number;
  baseRadius: number;
  debugColor?: number;
}

export interface ToolConfig {
  id: 'water_jet';
  spacing: number;
  falloff: 'soft';
  jitter: number;
  strength: number;
  speedBoost: boolean;
}

export interface ObjectDef {
  id: 'key_v1';
  sprite: string;
}

export interface Catalog {
  object: ObjectDef;
  layers: DirtLayerConfig[];
  tool: ToolConfig;
}
