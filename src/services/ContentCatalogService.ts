import Phaser from 'phaser';
import type {
  CleanableObjectDef,
  DirtLayerDef,
  ToolDef,
  ObjectId,
  DirtLayerId,
  ToolId,
} from '../types/catalog';

interface CatalogData {
  catalogVersion: string;
  objects: CleanableObjectDef[];
  dirtLayers: DirtLayerDef[];
  tools: ToolDef[];
}

/**
 * ContentCatalogService manages game content definitions loaded from catalog.json
 */
export default class ContentCatalogService {
  private objects: CleanableObjectDef[] = [];
  private dirtLayers: DirtLayerDef[] = [];
  private tools: ToolDef[] = [];
  private catalogVersion: string = '';

  constructor(scene: Phaser.Scene) {
    this.loadCatalog(scene);
    this.validateCatalog();
  }

  /**
   * Load catalog data from preloaded JSON
   */
  private loadCatalog(scene: Phaser.Scene): void {
    const catalogData = scene.cache.json.get('catalog') as CatalogData;

    if (!catalogData) {
      throw new Error(
        'ContentCatalogService: catalog.json not found in cache. Ensure it is preloaded.',
      );
    }

    this.catalogVersion = catalogData.catalogVersion || 'unknown';
    this.objects = catalogData.objects || [];
    this.dirtLayers = catalogData.dirtLayers || [];
    this.tools = catalogData.tools || [];

    console.log(
      `[ContentCatalogService] Loaded catalog version: ${this.catalogVersion}`,
    );
    console.log(
      `[ContentCatalogService] Objects: ${this.objects.length}, DirtLayers: ${this.dirtLayers.length}, Tools: ${this.tools.length}`,
    );
  }

  /**
   * Get a cleanable object by ID
   */
  public getObject(id: ObjectId): CleanableObjectDef {
    const obj = this.objects.find((o) => o.id === id);

    if (!obj) {
      const errorMsg = `ContentCatalogService: Object with id '${id}' not found.`;

      if (import.meta.env.DEV) {
        throw new Error(errorMsg);
      } else {
        console.warn(errorMsg, 'Returning first object as fallback.');
        return this.getDefaultObject();
      }
    }

    return obj;
  }

  /**
   * Get a dirt layer by ID
   */
  public getDirtLayer(id: DirtLayerId): DirtLayerDef {
    const layer = this.dirtLayers.find((d) => d.id === id);

    if (!layer) {
      const errorMsg = `ContentCatalogService: DirtLayer with id '${id}' not found.`;

      if (import.meta.env.DEV) {
        throw new Error(errorMsg);
      } else {
        console.warn(errorMsg, 'Returning first dirt layer as fallback.');
        return this.dirtLayers[0] ?? this.createFallbackDirtLayer();
      }
    }

    return layer;
  }

  /**
   * Get a tool by ID
   */
  public getTool(id: ToolId): ToolDef {
    const tool = this.tools.find((t) => t.id === id);

    if (!tool) {
      const errorMsg = `ContentCatalogService: Tool with id '${id}' not found.`;

      if (import.meta.env.DEV) {
        throw new Error(errorMsg);
      } else {
        console.warn(errorMsg, 'Returning first tool as fallback.');
        return this.tools[0] ?? this.createFallbackTool();
      }
    }

    return tool;
  }

  /**
   * Get the default (first) cleanable object
   */
  public getDefaultObject(): CleanableObjectDef {
    if (this.objects.length === 0) {
      throw new Error(
        'ContentCatalogService: No objects defined in catalog. Cannot get default object.',
      );
    }

    return this.objects[0]!;
  }

  /**
   * Get all cleanable objects
   */
  public getAllObjects(): CleanableObjectDef[] {
    return [...this.objects];
  }

  /**
   * Get all dirt layers
   */
  public getAllDirtLayers(): DirtLayerDef[] {
    return [...this.dirtLayers];
  }

  /**
   * Get all tools
   */
  public getAllTools(): ToolDef[] {
    return [...this.tools];
  }

  /**
   * Validate catalog data and log warnings for missing fields
   */
  public validateCatalog(): void {
    console.log('[ContentCatalogService] Validating catalog...');

    let hasErrors = false;

    // Validate objects
    if (this.objects.length === 0) {
      console.warn(
        '[ContentCatalogService] No objects defined in catalog. Game may not function correctly.',
      );
      hasErrors = true;
    }

    this.objects.forEach((obj, index) => {
      if (!obj.id) {
        console.error(
          `[ContentCatalogService] Object at index ${index} missing required field: id`,
        );
        hasErrors = true;
      }
      if (!obj.displayName) {
        console.warn(
          `[ContentCatalogService] Object '${obj.id}' missing displayName`,
        );
      }
      if (!obj.sprite) {
        console.error(
          `[ContentCatalogService] Object '${obj.id}' missing required field: sprite`,
        );
        hasErrors = true;
      }
      if (!obj.initialDirt || obj.initialDirt.length === 0) {
        console.warn(
          `[ContentCatalogService] Object '${obj.id}' has no initialDirt layers`,
        );
      }
    });

    // Validate dirt layers
    if (this.dirtLayers.length === 0) {
      console.warn(
        '[ContentCatalogService] No dirt layers defined in catalog.',
      );
      hasErrors = true;
    }

    this.dirtLayers.forEach((layer, index) => {
      if (!layer.id) {
        console.error(
          `[ContentCatalogService] DirtLayer at index ${index} missing required field: id`,
        );
        hasErrors = true;
      }
      if (!layer.baseTexture) {
        console.error(
          `[ContentCatalogService] DirtLayer '${layer.id}' missing required field: baseTexture`,
        );
        hasErrors = true;
      }
      if (!layer.alphaMaskInit) {
        console.error(
          `[ContentCatalogService] DirtLayer '${layer.id}' missing required field: alphaMaskInit`,
        );
        hasErrors = true;
      }
      if (layer.eraseRate === undefined) {
        console.error(
          `[ContentCatalogService] DirtLayer '${layer.id}' missing required field: eraseRate`,
        );
        hasErrors = true;
      }
    });

    // Validate tools
    if (this.tools.length === 0) {
      console.warn('[ContentCatalogService] No tools defined in catalog.');
      hasErrors = true;
    }

    this.tools.forEach((tool, index) => {
      if (!tool.id) {
        console.error(
          `[ContentCatalogService] Tool at index ${index} missing required field: id`,
        );
        hasErrors = true;
      }
      if (!tool.name) {
        console.warn(`[ContentCatalogService] Tool '${tool.id}' missing name`);
      }
      if (tool.radius === undefined || tool.radius <= 0) {
        console.error(
          `[ContentCatalogService] Tool '${tool.id}' missing or invalid radius`,
        );
        hasErrors = true;
      }
      if (!tool.falloff) {
        console.error(
          `[ContentCatalogService] Tool '${tool.id}' missing required field: falloff`,
        );
        hasErrors = true;
      }
    });

    if (hasErrors) {
      console.error(
        '[ContentCatalogService] Catalog validation completed with errors.',
      );
      if (import.meta.env.DEV) {
        console.error(
          '[ContentCatalogService] Fix catalog errors before proceeding.',
        );
      }
    } else {
      console.log(
        '[ContentCatalogService] Catalog validation passed successfully.',
      );
    }
  }

  /**
   * Create a fallback dirt layer for production error handling
   */
  private createFallbackDirtLayer(): DirtLayerDef {
    return {
      id: 'fallback_dirt',
      baseTexture: '',
      alphaMaskInit: '',
      eraseRate: 1.0,
      tiling: false,
      wetOverlay: false,
    };
  }

  /**
   * Create a fallback tool for production error handling
   */
  private createFallbackTool(): ToolDef {
    return {
      id: 'fallback_tool',
      name: 'Basic Tool',
      radius: 32,
      falloff: 'soft',
      rate: 1.0,
      spacing: 8,
    };
  }

  /**
   * Get catalog version
   */
  public getVersion(): string {
    return this.catalogVersion;
  }
}
