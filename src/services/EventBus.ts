/**
 * EventBus — simple type-safe pub/sub for decoupled scene communication.
 * Replaces direct Phaser game.events usage for better testability and clarity.
 */

type EventHandler<T = any> = (data: T) => void;

export class EventBus {
  private listeners = new Map<string, Set<EventHandler>>();

  /**
   * Subscribe to an event.
   * @param event - Event name to listen for.
   * @param handler - Callback function to invoke when event is emitted.
   * @param context - Optional 'this' context for the handler.
   */
  on<T = any>(event: string, handler: EventHandler<T>, context?: any): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    const boundHandler = context ? handler.bind(context) : handler;
    this.listeners.get(event)!.add(boundHandler);
  }

  /**
   * Unsubscribe from an event.
   * @param event - Event name to stop listening to.
   * @param handler - Original handler function to remove.
   */
  off<T = any>(event: string, handler: EventHandler<T>): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  /**
   * Emit an event with optional data payload.
   * @param event - Event name to emit.
   * @param data - Optional data to pass to handlers.
   */
  emit<T = any>(event: string, data?: T): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach((handler) => handler(data));
    }
  }

  /**
   * Remove all listeners for a specific event or all events.
   * @param event - Optional event name; if omitted, clears all listeners.
   */
  clear(event?: string): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  /**
   * Check if an event has any listeners.
   */
  hasListeners(event: string): boolean {
    return this.listeners.has(event) && this.listeners.get(event)!.size > 0;
  }
}

// Singleton instance for global access.
export const eventBus = new EventBus();
