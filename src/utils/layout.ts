/**
 * Layout utility functions for responsive game object positioning and scaling.
 *
 * These pure functions handle viewport-aware layout calculations for Phaser game objects,
 * ensuring proper scaling and centering across different screen sizes and orientations.
 */

/**
 * Viewport dimensions for layout calculations
 */
export interface Viewport {
  /** Viewport width in pixels */
  width: number;
  /** Viewport height in pixels */
  height: number;
}

/**
 * Result of fitting a sprite into viewport
 */
export interface FitResult {
  /** Computed scale factor applied to sprite */
  scale: number;
  /** Final width after scaling in pixels */
  finalWidth: number;
  /** Final height after scaling in pixels */
  finalHeight: number;
}

/**
 * Fits a sprite into the current viewport while preserving aspect ratio.
 *
 * This function calculates and applies the optimal uniform scale to ensure the sprite
 * fits within the viewport boundaries while maintaining padding on all sides.
 * The padding is calculated as a fraction of the shortest viewport dimension to ensure
 * consistent visual spacing regardless of aspect ratio.
 *
 * @param sprite - Phaser sprite to scale. Must have a loaded texture with valid dimensions.
 * @param viewport - Current viewport dimensions in pixels
 * @param paddingRatio - Fraction of shortest viewport side to reserve as padding.
 *                       Must be in range [0, 0.5). E.g., 0.1 = 10% padding.
 *
 * @returns Object containing computed scale and final dimensions
 *
 * @throws {Error} If sprite texture is not ready (width or height is 0)
 * @throws {Error} If viewport dimensions are invalid (≤ 0)
 * @throws {Error} If paddingRatio is outside valid range [0, 0.5)
 *
 * @example
 * ```ts
 * const sprite = this.add.sprite(0, 0, 'myTexture');
 * const result = fitSpriteIntoViewport(
 *   sprite,
 *   { width: 1920, height: 1080 },
 *   0.1  // 10% padding
 * );
 * console.log(`Scaled to ${result.scale.toFixed(2)}x`);
 * console.log(`Final size: ${result.finalWidth}x${result.finalHeight}px`);
 * ```
 *
 * @remarks
 * **Invariants:**
 * - Returned scale is always > 0
 * - Final dimensions fit within viewport minus padding on both axes
 * - Aspect ratio is preserved (uniform scaling)
 * - Sprite's scale property is directly modified
 * - Padding is calculated from shortest dimension for consistent appearance
 *
 * **Side Effects:**
 * - Modifies sprite.scaleX and sprite.scaleY properties
 *
 * **Performance:**
 * O(1) - Simple arithmetic calculations only
 */
export function fitSpriteIntoViewport(
  sprite: Phaser.GameObjects.Sprite,
  viewport: Viewport,
  paddingRatio: number,
): FitResult {
  // Defensive check: Validate sprite texture is loaded
  const spriteWidth = sprite.width;
  const spriteHeight = sprite.height;

  if (spriteWidth <= 0 || spriteHeight <= 0) {
    throw new Error(
      `fitSpriteIntoViewport: Sprite texture not ready or invalid. ` +
        `Current dimensions: ${spriteWidth}x${spriteHeight}px. ` +
        `Ensure texture is loaded before calling this function.`,
    );
  }

  // Defensive check: Validate viewport dimensions
  if (viewport.width <= 0 || viewport.height <= 0) {
    throw new Error(
      `fitSpriteIntoViewport: Invalid viewport dimensions (${viewport.width}x${viewport.height}). ` +
        `Both width and height must be positive.`,
    );
  }

  // Defensive check: Validate padding ratio
  if (paddingRatio < 0 || paddingRatio >= 0.5) {
    throw new Error(
      `fitSpriteIntoViewport: Invalid paddingRatio (${paddingRatio}). ` +
        `Must be in range [0, 0.5). Values ≥ 0.5 would leave no space for content.`,
    );
  }

  // Calculate padding based on shortest viewport dimension for consistent appearance
  const shortestDimension = Math.min(viewport.width, viewport.height);
  const padding = shortestDimension * paddingRatio;

  // Calculate available space after padding on both sides
  const availableWidth = viewport.width - padding * 2;
  const availableHeight = viewport.height - padding * 2;

  // Defensive check: Ensure padding hasn't consumed all space
  if (availableWidth <= 0 || availableHeight <= 0) {
    throw new Error(
      `fitSpriteIntoViewport: Padding (${padding}px) leaves no available space. ` +
        `Available: ${availableWidth}x${availableHeight}px. Reduce paddingRatio.`,
    );
  }

  // Calculate scale factors for width and height constraints
  const scaleByWidth = availableWidth / spriteWidth;
  const scaleByHeight = availableHeight / spriteHeight;

  // Use smaller scale to ensure sprite fits within both dimensions
  const scale = Math.min(scaleByWidth, scaleByHeight);

  // Invariant check: Ensure scale is positive
  if (scale <= 0) {
    throw new Error(
      `fitSpriteIntoViewport: Computed scale (${scale}) is invalid. ` +
        `This indicates a logic error in scale calculation.`,
    );
  }

  // Apply uniform scale to sprite (maintains aspect ratio)
  sprite.setScale(scale);

  // Calculate final dimensions for return value
  const finalWidth = spriteWidth * scale;
  const finalHeight = spriteHeight * scale;

  // Post-condition invariant check
  if (finalWidth > viewport.width || finalHeight > viewport.height) {
    console.warn(
      `fitSpriteIntoViewport: Final dimensions (${finalWidth}x${finalHeight}) ` +
        `exceed viewport (${viewport.width}x${viewport.height}). This should not happen.`,
    );
  }

  return {
    scale,
    finalWidth,
    finalHeight,
  };
}

/**
 * Centers any display object within the given viewport.
 *
 * This is a pure positioning function that works with any Phaser display object
 * implementing the Transform component (sprites, containers, graphics, text, etc.).
 * The object is positioned such that its origin point aligns with the viewport center.
 *
 * @param obj - Display object to center. Must implement Transform component (has x, y properties).
 * @param viewport - Target viewport dimensions in pixels
 *
 * @throws {Error} If viewport dimensions are invalid (≤ 0)
 * @throws {Error} If object does not implement Transform component
 *
 * @example
 * ```ts
 * // Center a sprite
 * const sprite = this.add.sprite(0, 0, 'myTexture');
 * sprite.setOrigin(0.5); // Ensure origin is center
 * centerDisplayObject(sprite, { width: 1920, height: 1080 });
 *
 * // Center a container
 * const container = this.add.container(0, 0);
 * centerDisplayObject(container, { width: this.cameras.main.width, height: this.cameras.main.height });
 *
 * // Center text
 * const text = this.add.text(0, 0, 'Hello');
 * text.setOrigin(0.5);
 * centerDisplayObject(text, { width: 1920, height: 1080 });
 * ```
 *
 * @remarks
 * **Invariants:**
 * - Object position (x, y) is set to viewport center coordinates
 * - No scaling or rotation is modified
 * - Origin point is not modified (caller must set appropriate origin)
 *
 * **Important:**
 * For proper centering, ensure the object's origin is set appropriately before calling:
 * - Sprites/Images: Use `.setOrigin(0.5, 0.5)` for center
 * - Containers: Origin is always (0, 0), position children accordingly
 * - Text: Use `.setOrigin(0.5, 0.5)` for center alignment
 *
 * **Side Effects:**
 * - Modifies object's x and y position properties
 *
 * **Performance:**
 * O(1) - Simple property assignment
 */
export function centerDisplayObject(
  obj: Phaser.GameObjects.Components.Transform,
  viewport: Viewport,
): void {
  // Defensive check: Validate viewport dimensions
  if (viewport.width <= 0 || viewport.height <= 0) {
    throw new Error(
      `centerDisplayObject: Invalid viewport dimensions (${viewport.width}x${viewport.height}). ` +
        `Both width and height must be positive.`,
    );
  }

  // Defensive check: Validate object has Transform component
  if (
    typeof obj.x !== 'number' ||
    typeof obj.y !== 'number' ||
    !('setPosition' in obj)
  ) {
    throw new Error(
      `centerDisplayObject: Object does not implement Transform component. ` +
        `Ensure object has x, y properties and setPosition method. ` +
        `Type: ${obj.constructor.name}`,
    );
  }

  // Calculate center coordinates
  const centerX = viewport.width / 2;
  const centerY = viewport.height / 2;

  // Apply centered position
  obj.x = centerX;
  obj.y = centerY;

  // Post-condition check (development only for performance)
  if (import.meta.env.DEV) {
    if (obj.x !== centerX || obj.y !== centerY) {
      console.warn(
        `centerDisplayObject: Position assignment may have failed. ` +
          `Expected: (${centerX}, ${centerY}), Got: (${obj.x}, ${obj.y})`,
      );
    }
  }
}
