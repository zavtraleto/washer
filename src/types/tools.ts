/**
 * Tool type definitions for the cleaning tool system.
 * Each tool implements different mechanics (scrubbing, power washing, etc.).
 */

/** Base configuration for all tools. */
export interface IToolConfig {
  id: string; // Unique tool identifier (e.g., 'scrubber', 'powerwash').
  name: string; // Display name for UI.
  icon?: string; // Optional icon key for tool buttons.
}

/** Tool interface - all cleaning tools must implement this. */
export interface ITool {
  readonly config: IToolConfig;

  /**
   * Activate tool (called when tool becomes active).
   */
  activate(): void;

  /**
   * Deactivate tool (called when switching to another tool).
   */
  deactivate(): void;

  /**
   * Handle pointer down event.
   * @param worldX - World-space X coordinate.
   * @param worldY - World-space Y coordinate.
   */
  handlePointerDown(worldX: number, worldY: number): void;

  /**
   * Handle pointer move event.
   * @param worldX - World-space X coordinate.
   * @param worldY - World-space Y coordinate.
   */
  handlePointerMove(worldX: number, worldY: number): void;

  /**
   * Handle pointer up event.
   * @param worldX - World-space X coordinate.
   * @param worldY - World-space Y coordinate.
   */
  handlePointerUp(worldX: number, worldY: number): void;

  /**
   * Update tool state (called every frame).
   * @param deltaMs - Time elapsed since last frame in milliseconds.
   */
  update(deltaMs: number): void;

  /**
   * Check if input location is valid for this tool.
   * @param worldX - World-space X coordinate.
   * @param worldY - World-space Y coordinate.
   * @param isOnObject - Whether the point is on the cleanable object.
   * @returns True if tool can be used at this location.
   */
  isValidInputLocation(
    worldX: number,
    worldY: number,
    isOnObject: boolean,
  ): boolean;
}
