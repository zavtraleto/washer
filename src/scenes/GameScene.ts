import Phaser from 'phaser';
import { SCENE_KEYS } from '../types/constants';
import ContentCatalogService from '../services/ContentCatalogService';
import type { CleanableObjectDef } from '../types/catalog';
import {
  fitSpriteIntoViewport,
  centerDisplayObject,
  type Viewport,
} from '../utils/layout';

/**
 * GameScene manages the main game loop, cleanable objects, and user interaction.
 *
 * Responsibilities:
 * - Load and display cleanable objects from catalog
 * - Handle responsive layout and scaling
 * - Manage dirt layers and cleaning mechanics
 * - Process user input for cleaning tools
 *
 * Scene key: 'Game'
 */
export class GameScene extends Phaser.Scene {
  private catalog!: ContentCatalogService;
  private currentObjectDef!: CleanableObjectDef;

  /**
   * Container for the cleanable object sprite (base layer).
   *
   * Rendering Stack (bottom to top):
   * 1. objectLayer - Base cleanable object sprite
   * 2. dirtComposite - Dirt layers with masked visuals
   * 3. wetOverlay - Transient wetness effect (to be added)
   * 4. nozzle/particles - Visual effects on top (to be added)
   */
  private objectLayer!: Phaser.GameObjects.Container;

  /** The main sprite of the current cleanable object */
  private objectSprite!: Phaser.GameObjects.Sprite;

  /**
   * Container for dirt layer visuals, positioned above objectLayer.
   *
   * This container holds all dirt-related graphics including:
   * - Dirt texture layers (mold, grease, etc.)
   * - Alpha masks for progressive cleaning
   * - Blend modes and effects
   *
   * Layout Binding Strategy:
   * The container's position and scale are synchronized with objectLayer
   * to ensure 1:1 pixel alignment between the base object and dirt layers.
   * This approach simplifies dirt rendering by binding layout at the container
   * level rather than managing transforms for each individual child sprite.
   *
   * Why container-level transforms?
   * - Single source of truth for layout (DRY principle)
   * - Ensures perfect alignment without floating-point drift
   * - Simplifies adding/removing dirt layers without recalculating positions
   * - Child sprites can use local coordinates (0,0 = object center)
   * - Reduces CPU overhead from per-child transform updates
   *
   * @see attachDirtComposite for safe external access pattern
   */
  private dirtComposite!: Phaser.GameObjects.Container;

  /**
   * Debounce timer for resize events.
   *
   * Rationale: Mobile devices (especially iOS/Android) can fire multiple rapid
   * resize events during orientation changes or soft keyboard show/hide. Processing
   * layout calculations on every event causes visual jank and unnecessary work.
   * A trailing debounce (250ms) ensures layout is only recalculated once after
   * the final resize event, improving performance and user experience.
   *
   * Mobile-specific scenarios:
   * - iOS Safari: Fires 10-20 resize events during single rotation
   * - Android Chrome: Multiple events when soft keyboard appears/disappears
   * - Tablets: Slow rotation animations trigger continuous resize stream
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Window/resize_event
   */
  private resizeDebounceTimer: Phaser.Time.TimerEvent | null = null;

  /** Debounce delay for resize events in milliseconds */
  private readonly RESIZE_DEBOUNCE_MS = 250;

  constructor() {
    super({ key: SCENE_KEYS.GAME });
  }

  /**
   * Initialize the game scene.
   *
   * Creates the content catalog service, loads the default cleanable object,
   * sets up the object layer container, and applies initial layout.
   * Also hooks into scale manager events for responsive behavior.
   */
  create(): void {
    // Initialize content catalog service
    this.catalog = new ContentCatalogService(this);

    // Resolve default cleanable object from catalog
    this.currentObjectDef = this.catalog.getDefaultObject();
    console.log('[GameScene] Loading object:', this.currentObjectDef.id);

    // Set up camera, scale handling, and input
    this.setupCamera();
    this.setupScaleHandling();
    this.setupInput();

    // Create rendering layers in z-order
    this.createObjectLayer();
    this.createDirtComposite();

    // Apply initial layout
    this.applyLayout('initial layout');

    // Launch parallel scenes
    this.scene.launch(SCENE_KEYS.UI);

    if (import.meta.env.DEV) {
      this.scene.launch(SCENE_KEYS.DEVTOOLS);
    }
  }

  /**
   * Configure camera settings for the game viewport.
   */
  private setupCamera(): void {
    this.cameras.main.setBackgroundColor('#2d2d2d');
  }

  /**
   * Set up scale manager event listeners for responsive layout.
   *
   * Listens to 'resize' and 'orientationchange' events to re-apply
   * layout when viewport dimensions change.
   */
  private setupScaleHandling(): void {
    this.scale.on('resize', this.onResize, this);
    this.scale.on('orientationchange', this.onOrientationChange, this);
  }

  /**
   * Set up input event handlers for cleaning interaction.
   */
  private setupInput(): void {
    this.input.on('pointerdown', this.onPointerDown, this);
    this.input.on('pointermove', this.onPointerMove, this);
    this.input.on('pointerup', this.onPointerUp, this);
  }

  /**
   * Create the object layer container and load the cleanable object sprite.
   *
   * @throws Error if sprite texture is missing from cache
   */
  private createObjectLayer(): void {
    // Create dedicated container for cleanable object
    this.objectLayer = this.add.container(0, 0);
    this.objectLayer.setName('objectLayer');

    // Extract texture key from sprite path (e.g., "assets/objects/key.png" -> "objects/key")
    const textureKey = this.extractTextureKey(this.currentObjectDef.sprite);

    // Guard: Check if texture exists in cache
    if (!this.textures.exists(textureKey)) {
      throw new Error(
        `[GameScene] Texture '${textureKey}' not found in cache. ` +
          `Expected from sprite path: '${this.currentObjectDef.sprite}'. ` +
          `Ensure the asset is preloaded in PreloadScene.`,
      );
    }

    // Create sprite from object definition
    this.objectSprite = this.add.sprite(0, 0, textureKey);
    this.objectSprite.setOrigin(0.5);
    this.objectSprite.setName(`sprite_${this.currentObjectDef.id}`);

    // Add sprite to object layer
    this.objectLayer.add(this.objectSprite);

    console.log(
      `[GameScene] Created sprite '${textureKey}' (${this.objectSprite.width}x${this.objectSprite.height}px)`,
    );
  }

  /**
   * Create the dirt composite container for dirt layer visuals.
   *
   * This container is positioned above objectLayer in the render stack
   * to ensure dirt layers appear on top of the base object. It will be
   * synchronized with objectLayer's transform during layout updates.
   */
  private createDirtComposite(): void {
    // Create dedicated container for dirt layers
    this.dirtComposite = this.add.container(0, 0);
    this.dirtComposite.setName('dirtComposite');

    // Position above objectLayer in render order (higher depth = rendered later)
    // Render stack: objectLayer (base) → dirtComposite → wetOverlay → FX
    this.dirtComposite.setDepth(this.objectLayer.depth + 1);

    console.log(
      `[GameScene] Created dirtComposite (depth: ${this.dirtComposite.depth})`,
    );
  }

  /**
   * Extract Phaser texture key from asset path.
   *
   * Converts "assets/objects/key.png" to "objects/key" to match
   * the key used in PreloadScene.
   *
   * @param spritePath - Full asset path from catalog
   * @returns Texture key for Phaser cache lookup
   */
  private extractTextureKey(spritePath: string): string {
    // Remove "assets/" prefix and file extension
    return spritePath.replace(/^assets\//, '').replace(/\.\w+$/, '');
  }

  /**
   * Compute and apply layout to the object sprite based on current viewport dimensions.
   *
   * Uses fitSpriteIntoViewport and centerDisplayObject utility functions for
   * mobile-first responsive scaling and positioning. Also synchronizes the
   * dirtComposite container to maintain 1:1 alignment with the object sprite.
   *
   * @param context - Description of when layout is being applied (for logging)
   */
  private applyLayout(context: string = 'layout update'): void {
    // Guard: Ensure sprite exists
    if (!this.objectSprite) {
      console.warn('[GameScene] Cannot apply layout: objectSprite not created');
      return;
    }

    // Read canvas size from scale manager
    const gameSize = this.scale.gameSize;
    const viewport: Viewport = {
      width: gameSize.width,
      height: gameSize.height,
    };

    // Apply optimal scaling with 10% padding (mobile-first)
    const fitResult = fitSpriteIntoViewport(this.objectSprite, viewport, 0.1);

    // Center the scaled sprite in viewport
    centerDisplayObject(this.objectSprite, viewport);

    // Synchronize dirtComposite transform with objectSprite for perfect alignment
    // This ensures dirt layers render exactly on top of the object (1:1 pixel correspondence)
    if (this.dirtComposite) {
      this.dirtComposite.setPosition(this.objectSprite.x, this.objectSprite.y);
      this.dirtComposite.setScale(fitResult.scale);
    }

    // Log comprehensive diagnostics
    console.log(`[GameScene] Layout applied (${context}):`);
    console.log(
      `  Object: ${this.currentObjectDef.id} (${this.currentObjectDef.displayName})`,
    );
    console.log(`  Scale: ${fitResult.scale.toFixed(3)}x`);
    console.log(
      `  Final size: ${Math.round(fitResult.finalWidth)}x${Math.round(fitResult.finalHeight)}px`,
    );
    console.log(
      `  Position: (${Math.round(this.objectSprite.x)}, ${Math.round(this.objectSprite.y)})`,
    );
  }

  /**
   * Handle viewport resize events with debouncing.
   *
   * Uses a trailing debounce strategy to avoid excessive layout recalculations
   * during rapid resize events (common on mobile during orientation changes).
   * The actual layout update is deferred by RESIZE_DEBOUNCE_MS (250ms) and only
   * executes after resize events have stopped firing.
   *
   * This approach prevents:
   * - Performance degradation from rapid layout recalculations
   * - Visual jank/flickering during orientation transitions
   * - Wasted CPU cycles on intermediate viewport sizes
   *
   * @param gameSize - New viewport dimensions from Phaser scale manager
   *
   * @see RESIZE_DEBOUNCE_MS for debounce delay configuration
   * @see applyLayout for the actual layout implementation
   */
  private onResize(gameSize: Phaser.Structs.Size): void {
    // Cancel any pending resize operation
    if (this.resizeDebounceTimer) {
      this.resizeDebounceTimer.destroy();
      this.resizeDebounceTimer = null;
    }

    // Log immediate resize event for debugging
    if (import.meta.env.DEV) {
      console.log(
        `[GameScene] Resize triggered: ${gameSize.width}x${gameSize.height}px (debounced)`,
      );
    }

    // Schedule layout update after debounce period
    this.resizeDebounceTimer = this.time.delayedCall(
      this.RESIZE_DEBOUNCE_MS,
      () => {
        this.applyLayout('after resize');
        this.resizeDebounceTimer = null;
      },
    );
  }

  /**
   * Handle device orientation change events.
   *
   * Re-applies layout immediately (no debounce) to adjust for portrait/landscape
   * orientation. Orientation changes are less frequent than resize events and
   * typically represent a final state, so immediate response provides better UX.
   *
   * @param orientation - New device orientation string
   */
  private onOrientationChange(orientation: string): void {
    console.log(`[GameScene] Orientation changed: ${orientation}`);

    // Cancel any pending debounced resize
    if (this.resizeDebounceTimer) {
      this.resizeDebounceTimer.destroy();
      this.resizeDebounceTimer = null;
    }

    // Apply layout immediately for orientation changes
    this.applyLayout('after orientation change');
  }

  /**
   * Handle pointer down events for cleaning interaction.
   *
   * @param _pointer - Pointer event data
   */
  private onPointerDown(_pointer: Phaser.Input.Pointer): void {
    // TODO: Start cleaning interaction
  }

  /**
   * Handle pointer move events for continuous cleaning.
   *
   * @param _pointer - Pointer event data
   */
  private onPointerMove(_pointer: Phaser.Input.Pointer): void {
    // TODO: Apply cleaning tool along pointer path
  }

  /**
   * Handle pointer up events to end cleaning interaction.
   *
   * @param _pointer - Pointer event data
   */
  private onPointerUp(_pointer: Phaser.Input.Pointer): void {
    // TODO: End cleaning interaction
  }

  /**
   * Provides safe access to the dirtComposite container for external systems.
   *
   * This method follows the dependency injection pattern by providing a callback-based
   * access mechanism rather than exposing the internal container reference directly.
   * The consumer receives a temporary reference within the callback scope, preventing
   * long-lived external references that could create tight coupling or lifecycle issues.
   *
   * **Usage Pattern:**
   * ```ts
   * // In a dirt rendering system
   * gameScene.attachDirtComposite((container) => {
   *   const dirtLayer = this.createDirtLayer();
   *   container.add(dirtLayer);
   * });
   * ```
   *
   * **Lifecycle Guarantees:**
   * - Container is guaranteed to exist when callback is invoked
   * - Container position/scale are synchronized with objectLayer
   * - Callback is invoked synchronously (no async timing issues)
   * - Consumer must not store the container reference beyond callback scope
   *
   * **Why callback pattern vs. getter?**
   * - Prevents accidental long-lived references to internal state
   * - Makes it explicit that access is temporary and controlled
   * - Allows future addition of lifecycle hooks or validation
   * - Enforces encapsulation without exposing private fields
   * - Easier to track external dependencies in codebase
   *
   * **Design Rationale:**
   * This API design maintains the Single Responsibility Principle by keeping
   * GameScene responsible for container lifecycle while allowing dirt systems
   * to populate content without direct field access. It's inspired by React's
   * ref callback pattern and Qt's visitor pattern for safe external access.
   *
   * @param consumer - Callback function that receives the dirtComposite container.
   *                   Must not store the reference beyond the callback scope.
   *
   * @throws {Error} If dirtComposite has not been created yet (call after create())
   *
   * @example
   * ```ts
   * // Good: Temporary scoped access
   * gameScene.attachDirtComposite((container) => {
   *   const sprite = scene.add.sprite(0, 0, 'dirt');
   *   container.add(sprite);
   * });
   *
   * // Bad: Storing reference (violates contract)
   * let storedContainer: Phaser.GameObjects.Container;
   * gameScene.attachDirtComposite((container) => {
   *   storedContainer = container; // DON'T DO THIS
   * });
   * ```
   *
   * @see createDirtComposite for container initialization
   * @see applyLayout for transform synchronization
   */
  public attachDirtComposite(
    consumer: (node: Phaser.GameObjects.Container) => void,
  ): void {
    // Guard: Ensure dirtComposite has been created
    if (!this.dirtComposite) {
      throw new Error(
        '[GameScene] attachDirtComposite: dirtComposite not initialized. ' +
          'Ensure this method is called after scene.create() has completed.',
      );
    }

    // Invoke consumer with temporary scoped reference
    consumer(this.dirtComposite);
  }

  /**
   * Main game update loop.
   *
   * Updates game systems and entities each frame.
   *
   * @param _time - Total elapsed time in milliseconds
   * @param _delta - Time since last frame in milliseconds
   */
  override update(_time: number, _delta: number): void {
    // Game loop logic
    // Update systems, entities
  }
}
