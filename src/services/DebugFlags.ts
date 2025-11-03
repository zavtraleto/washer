// Centralized debug configuration.
// Toggle categories independently or all at once with hotkey.

interface DebugFlags {
  enabled: boolean; // Master switch for all debug features.
  input: boolean; // Log pointer events and stroke activity.
  progress: boolean; // Log progress updates and win conditions.
  tilt: boolean; // Log mesh tilt physics state.
  particles: boolean; // Log particle spawn/update counts.
  dirt: boolean; // Log dirt system updates and coverage.
  performance: boolean; // Log FPS and frame timing.
}

class DebugConfig {
  private flags: DebugFlags = {
    enabled: false,
    input: false,
    progress: false,
    tilt: false,
    particles: false,
    dirt: false,
    performance: false,
  };

  // Master toggle for all debug output.
  toggle(): void {
    this.flags.enabled = !this.flags.enabled;
    console.log(`[Debug] ${this.flags.enabled ? 'ENABLED' : 'DISABLED'}`);
  }

  get enabled(): boolean {
    return this.flags.enabled;
  }

  get input(): boolean {
    return this.flags.enabled && this.flags.input;
  }

  get progress(): boolean {
    return this.flags.enabled && this.flags.progress;
  }

  get tilt(): boolean {
    return this.flags.enabled && this.flags.tilt;
  }

  get particles(): boolean {
    return this.flags.enabled && this.flags.particles;
  }

  get dirt(): boolean {
    return this.flags.enabled && this.flags.dirt;
  }

  get performance(): boolean {
    return this.flags.enabled && this.flags.performance;
  }

  // Enable specific debug category.
  enable(category: keyof DebugFlags): void {
    this.flags[category] = true;
  }

  // Disable specific debug category.
  disable(category: keyof DebugFlags): void {
    this.flags[category] = false;
  }

  // Set all categories at once (useful for presets).
  setAll(value: boolean): void {
    Object.keys(this.flags).forEach((key) => {
      this.flags[key as keyof DebugFlags] = value;
    });
  }
}

// Singleton instance.
export const debug = new DebugConfig();
