/**
 * Type definitions for game assets catalog
 */

// ID types for type safety
export type ObjectId = string;
export type DirtLayerId = string;
export type ToolId = string;

// Asset catalog structure
export interface AssetCatalog {
  objects: ObjectAssets;
  dirt: DirtAssets;
  masks: MaskAssets;
  ui: UIAssets;
}

export interface ObjectAssets {
  // Define object asset keys here
}

export interface DirtAssets {
  // Define dirt asset keys here
}

export interface MaskAssets {
  // Define mask asset keys here
}

export interface UIAssets {
  // Define UI asset keys here
}

// Asset keys type-safe access
export type AssetKey = string;

// Cleanable object definition
export interface CleanableObjectDef {
  id: ObjectId;
  displayName: string;
  sprite: string;
  preview: string;
  initialDirt: { layerId: DirtLayerId; coverage: number }[];
  fx?: { reveal?: string };
}

// Dirt layer definition
export interface DirtLayerDef {
  id: DirtLayerId;
  baseTexture: string;
  tiling?: boolean;
  alphaMaskInit: string;
  eraseRate: number;
  wetOverlay?: boolean;
}

// Tool definition
export interface ToolDef {
  id: ToolId;
  name: string;
  radius: number;
  falloff: 'hard' | 'soft' | 'noisy';
  rate: number;
  spacing: number;
  sprayJitter?: number;
  particles?: boolean;
}
