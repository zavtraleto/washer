/**
 * ToolManager — manages active tool state and switching.
 * Ensures only one tool is active at a time; handles lifecycle transitions.
 */

import type { ITool } from '../types/tools';

export class ToolManager {
  private activeTool: ITool | null = null;

  /**
   * Set the active tool. Deactivates previous tool if any.
   * @param tool - Tool to activate.
   */
  setActiveTool(tool: ITool): void {
    if (this.activeTool === tool) return; // Already active.

    if (this.activeTool) {
      this.activeTool.deactivate();
    }

    this.activeTool = tool;
    tool.activate();
  }

  /**
   * Get the currently active tool.
   */
  getActiveTool(): ITool | null {
    return this.activeTool;
  }

  /**
   * Deactivate the current tool without setting a new one.
   */
  deactivateAll(): void {
    if (this.activeTool) {
      this.activeTool.deactivate();
      this.activeTool = null;
    }
  }

  /**
   * Check if a specific tool is currently active.
   * @param tool - Tool to check.
   */
  isActive(tool: ITool): boolean {
    return this.activeTool === tool;
  }
}
