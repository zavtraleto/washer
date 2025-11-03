import Phaser from 'phaser';

import { getCatalog } from '../services/Catalog';
import { SilhouetteClip } from '../systems/SilhouetteClip';
import { DirtSystem } from '../systems/DirtSystem';
import { DirtTextureRenderer } from '../systems/DirtTextureRenderer';
import { ParticlesSystem } from '../systems/ParticlesSystem';
import { DebugOverlay } from '../systems/DebugOverlay';
import { TiltController } from '../systems/TiltController';
import { RNG } from '../services/RNG';
import { InputService } from '../services/InputService';
import { StrokeSystem } from '../systems/StrokeSystem';
import { MathUtils } from '../utils/MathUtils';
import { eventBus } from '../services/EventBus';
import { GameEvents } from '../types/events';
import type { DirtLayerId } from '../types/config';
import { OBJECT_TEXTURE_KEY } from './PreloadScene';

const UV_EPSILON = 1e-6;
const SILHOUETTE_SIZE = 256;
const DEFAULT_COVERAGE: Record<DirtLayerId, number> = {
  mold: 1.0,
  grease: 1.0,
};

// Spring physics config for mesh tilt interaction.
const SPRING_CONFIG = {
  maxTiltDegrees: 12,
  stiffness: 0.3,
  damping: 0.7,
  tiltSpeed: 0.15,
};

// Dirt rendering config (colors and appearance).
const DIRT_RENDER_CONFIG = {
  moldColor: 0x33ff66, // Green tint for mold.
  greaseColor: 0x8a5a2b, // Brown tint for grease.
  darkenFactor: 0.6, // 60% darkening on dirty areas.
};

export default class GameScene extends Phaser.Scene {
  private mesh!: Phaser.GameObjects.Mesh; // Main 3D mesh object for cleaning interaction.
  private objKey!: string; // Texture key tied to the catalog asset for reuse.
  private silhouette!: SilhouetteClip; // Precomputed silhouette mask for clipping logic.
  private dirt!: DirtSystem; // Handles dirt coverage maps and erosion logic.
  private rng!: RNG; // Seeded RNG for repeatable dirt layouts.
  private dirtRenderer!: DirtTextureRenderer; // Renders dirt directly onto mesh texture.
  private progressTimer?: Phaser.Time.TimerEvent; // Periodic progress tick.
  private inputSvc!: InputService; // Normalized pointer stream.
  private stroke!: StrokeSystem; // Turns drag path into stamps.
  private particles!: ParticlesSystem; // Ballistic spray particle pool.
  private debugOverlay!: DebugOverlay; // Visual debug display.
  private tiltController!: TiltController; // Mesh tilt with spring physics.
  private overlayDirty = false; // Track texture refresh requests.
  private won = false; // Prevent double-win triggers.
  private seed = Math.max(1, Date.now() & 0xffff); // Current level seed.
  private inputActive = false; // Track if pointer is currently pressed.
  private readonly maxBoxRatio = 0.85; // Portion of screen reserved for the object (increased for larger mesh).

  private readonly handleResize = () => {
    this.layoutObject();
    if (this.particles) {
      this.particles.relayout();
    }
  }; // Reflow object and overlay whenever viewport changes.

  constructor() {
    super('GameScene');
  }

  create(): void {
    const catalog = getCatalog();
    const { object, layers } = catalog;
    this.objKey = OBJECT_TEXTURE_KEY; // Ensure we reuse the preload key.
    if (this.objKey !== object.id) {
      this.objKey = object.id; // Fallback if catalog key changes.
    }

    // Create mesh as the main cleanable object.
    this.mesh = this.add.mesh(0, 0, this.objKey);
    Phaser.Geom.Mesh.GenerateGridVerts({
      mesh: this.mesh,
      widthSegments: 8, // More vertices for smooth 3D deformation without warping.
      texture: this.objKey,
    });
    this.mesh.hideCCW = false;
    this.mesh.panZ(1.5); // Moderate 3D perspective for visual depth.

    // Create debug overlay for visual feedback.
    this.debugOverlay = new DebugOverlay(this);
    this.debugOverlay.setMesh(this.mesh, () => this.getMeshVisualBounds());

    // Create tilt controller for mesh spring physics.
    this.tiltController = new TiltController(this.mesh, SPRING_CONFIG);

    this.silhouette = new SilhouetteClip(
      this,
      this.objKey,
      SILHOUETTE_SIZE,
      0.5,
    ); // Build silhouette mask once for clipping.

    const maskSize = this.silhouette.getSize();
    this.dirt = new DirtSystem(maskSize, layers, this.silhouette);
    this.dirtRenderer = new DirtTextureRenderer(
      this,
      this.mesh,
      this.objKey,
      DIRT_RENDER_CONFIG,
    );
    this.particles = new ParticlesSystem(this, this.mesh);
    this.reinitLevel(false); // what: seed dirt maps and overlay for first run.

    this.progressTimer = this.time.addEvent({
      delay: 200,
      loop: true,
      callback: () => {
        const unionRatio = this.dirt.getUnionDirtyRatio();
        const cleanPercent = (1 - unionRatio) * 100;
        eventBus.emit(GameEvents.PROGRESS, cleanPercent); // Emit clean percent to UI; UI lerps for smooth feel.
        if (!this.won && cleanPercent >= 95) {
          this.handleWin(cleanPercent);
        }
      },
    }); // Update at ~5 Hz to keep CPU/GPU cost low.

    eventBus.on(GameEvents.RESTART, this.handleRestart, this);
    eventBus.on(GameEvents.NEXT, this.handleNext, this);

    this.inputSvc = new InputService(this); // Normalize pointer events into world-space samples.
    this.stroke = new StrokeSystem(
      this,
      catalog.tool,
      this.dirt,
      (wx, wy) => this.worldToLocal(wx, wy),
      (sx, sy, dirX, dirY, intensity) => {
        // Always spawn water particles at cursor position (cleaning spray).
        this.particles.spawnWater(sx, sy, dirX, dirY, intensity);

        // Check if we're hitting a dirty area and spawn dirt particles.
        const { u, v } = this.worldToLocal(sx, sy);
        const dirtValue = this.dirt.getUnionDirtyValueAt(u, v);

        if (dirtValue > 0.05) {
          // Spawn dirt even on lightly dirty areas
          const dirtIntensity = Math.min(intensity * (dirtValue + 0.5), 2.0);
          this.particles.spawnDirt(sx, sy, dirX, dirY, dirtIntensity);
        }
      },
    );
    this.inputSvc.onDown((p) => {
      if (this.won) {
        return; // why: lock input after win.
      }
      this.inputActive = true;
      this.tiltController.startInteraction();
      this.stroke.setActive(true);
      this.stroke.handleDown(p.x, p.y, p.t);
    });
    this.inputSvc.onMove((p) => {
      if (this.won) {
        return;
      }
      this.stroke.handleMove(p.x, p.y, p.t);

      // Update tilt target based on pointer position.
      this.tiltController.setPointerTarget(p.x, p.y);
    });
    this.inputSvc.onUp((p) => {
      if (this.won) {
        return;
      }
      this.inputActive = false;
      this.tiltController.endInteraction();
      this.stroke.handleUp(p.x, p.y, p.t);
    });

    this.layoutObject();
    this.scale.on('resize', this.handleResize, this); // Respond to window/device changes.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this); // Stop listeners when scene ends.
  }

  private layoutObject(): void {
    const texture = this.textures.get(this.objKey);
    if (!texture || !texture.source[0]) {
      return; // Texture not ready yet; skip layout.
    }

    const { width, height } = this.scale.gameSize;
    if (width === 0 || height === 0) {
      return; // Nothing to layout when viewport has no size.
    }

    const texWidth = texture.source[0].width;
    const texHeight = texture.source[0].height;
    const shortest = Math.min(width, height);
    const maxSize = shortest * this.maxBoxRatio;
    const scale = Math.min(maxSize / texWidth, maxSize / texHeight);

    // Apply 2x larger scale to make mesh more prominent.
    const finalScale = scale * 2.0;
    this.mesh.setScale(finalScale);
    this.mesh.setPosition(width * 0.5, height * 0.5);

    if (this.particles) {
      this.particles.relayout();
    }
  }

  public worldToLocal(x: number, y: number): { u: number; v: number } {
    if (!this.mesh) {
      return { u: 0.5, v: 0.5 }; // Default to center if object is missing.
    }

    // Get the actual projected bounds of the mesh vertices.
    const bounds = this.getMeshVisualBounds();
    if (!bounds) {
      return { u: 0.5, v: 0.5 };
    }

    // Calculate UV based on actual visual bounds from projected vertices.
    const localX = (x - bounds.left) / bounds.width;
    const localY = (y - bounds.top) / bounds.height;

    const uRaw = localX;
    const vRaw = localY;

    return {
      u: this.clampUV(uRaw),
      v: this.clampUV(vRaw),
    }; // Map screen coords to UV using actual projected vertex bounds.
  }

  private getMeshVisualBounds(): {
    left: number;
    top: number;
    width: number;
    height: number;
  } | null {
    if (!this.mesh) {
      return null;
    }

    // Get texture for validation.
    const texture = this.mesh.texture;
    if (!texture || !texture.source[0]) {
      return null;
    }

    const texWidth = texture.source[0].width;
    const texHeight = texture.source[0].height;

    // Strategy 1: Try to use projected vertex coordinates (vx, vy).
    // These are populated during render, so may not be available immediately.
    const faces = this.mesh.faces;

    if (faces && faces.length > 0) {
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      let validVertexCount = 0;

      // Get mesh world position to offset the local vertex coordinates.
      const meshWorldX = this.mesh.x;
      const meshWorldY = this.mesh.y;

      // Iterate through all face vertices to find screen-space bounds.
      for (let i = 0; i < faces.length; i += 1) {
        const face = faces[i];
        if (!face) {
          continue;
        }

        // Each face has vertex1, vertex2, vertex3.
        const vertices = [face.vertex1, face.vertex2, face.vertex3];

        for (const vertex of vertices) {
          if (!vertex) {
            continue;
          }

          // Vertices have vx, vy which are in local/model space relative to mesh origin.
          // We need to transform them to world/screen space by adding mesh position.
          const localX = vertex.vx;
          const localY = vertex.vy;

          if (Number.isFinite(localX) && Number.isFinite(localY)) {
            // Transform from local mesh space to world screen space.
            const screenX = meshWorldX + localX;
            const screenY = meshWorldY + localY;

            minX = Math.min(minX, screenX);
            maxX = Math.max(maxX, screenX);
            minY = Math.min(minY, screenY);
            maxY = Math.max(maxY, screenY);
            validVertexCount += 1;
          }
        }
      }

      // If we got valid bounds from vertices, use them.
      if (
        validVertexCount > 3 &&
        Number.isFinite(minX) &&
        Number.isFinite(maxX) &&
        Number.isFinite(minY) &&
        Number.isFinite(maxY)
      ) {
        const width = maxX - minX;
        const height = maxY - minY;

        return {
          left: minX,
          top: minY,
          width,
          height,
        };
      }
    }

    // Strategy 2: Calculate bounds manually accounting for panZ perspective.
    // panZ creates a perspective effect that enlarges the mesh visually.
    // For panZ(1.5), the visual magnification is approximately 1.3-1.4x.
    const scale = this.mesh.scaleX;

    // Calculate perspective magnification from panZ.
    // The mesh.modelPosition.z (set by panZ) affects the perceived size.
    const panZValue = this.mesh.modelPosition.z;
    const perspectiveMagnification = 1 + panZValue * 0.2; // Approximate formula

    const visualWidth = texWidth * scale * perspectiveMagnification;
    const visualHeight = texHeight * scale * perspectiveMagnification;

    return {
      left: this.mesh.x - visualWidth / 2,
      top: this.mesh.y - visualHeight / 2,
      width: visualWidth,
      height: visualHeight,
    };
  }
  public localToWorld(u: number, v: number): { x: number; y: number } {
    if (!this.mesh) {
      return { x: 0, y: 0 }; // Nothing to project without the object.
    }

    const bounds = this.getMeshVisualBounds();
    if (!bounds) {
      return { x: 0, y: 0 };
    }

    const clampedU = this.clampUV(u);
    const clampedV = this.clampUV(v);

    // Convert UV back to world position using actual projected bounds.
    const x = bounds.left + clampedU * bounds.width;
    const y = bounds.top + clampedV * bounds.height;

    return { x, y }; // Convert UV back to screen coords using actual visual bounds.
  }
  public override update(_time: number, delta: number): void {
    // Update tilt controller.
    this.tiltController.update(delta / 1000);

    // Update debug overlay with current stats.
    const unionRatio = this.dirt.getUnionDirtyRatio();
    const cleanPercent = (1 - unionRatio) * 100;
    const tilt = this.tiltController.getTiltDegrees();
    this.debugOverlay.updateStats({
      dirtProgress: cleanPercent,
      inputActive: this.inputActive,
      tiltX: tilt.x,
      tiltY: tilt.y,
      particleCount: this.particles.getActiveCount(),
      seed: this.seed,
    });
    this.debugOverlay.update();

    if (this.particles) {
      this.particles.update(delta / 1000); // Simple ballistic motion step.
    }
    if (this.stroke) {
      this.stroke.update(delta);
      if (this.stroke.didStampSinceLastCheck()) {
        this.overlayDirty = true;
      }
    }

    // Update dirt texture every frame for satisfying real-time feedback.
    if (this.overlayDirty) {
      const { map0, map1 } = this.dirt.getMapsForShader();
      this.dirtRenderer.updateTexture(map0, map1);
      this.overlayDirty = false;
    }
  }

  private clampUV(value: number): number {
    return MathUtils.clamp(value, UV_EPSILON, 1 - UV_EPSILON); // Clamp UV with a tiny epsilon for stability.
  }

  private handleWin(_cleanPercent: number): void {
    this.won = true;
    if (this.stroke) {
      this.stroke.setActive(false); // Lock input when win condition met.
    }
    eventBus.emit(GameEvents.WIN);
  }

  private handleRestart(): void {
    this.reinitLevel(false); // what: reset with current seed for repeatability.
  }

  private handleNext(): void {
    this.reinitLevel(true); // what: reseed for a fresh layout.
  }

  private reinitLevel(reseed: boolean): void {
    if (reseed) {
      const randomOffset = Phaser.Math.Between(1, 0xffff);
      this.seed = Math.max(1, (Date.now() & 0xffff) ^ randomOffset); // why: derive new seed while avoiding zero.
    }
    this.rng = new RNG(this.seed);
    this.dirt.init(this.rng, DEFAULT_COVERAGE);
    const { map0, map1 } = this.dirt.getMapsForShader();
    this.dirtRenderer.updateTexture(map0, map1);
    const cleanPercent = (1 - this.dirt.getUnionDirtyRatio()) * 100;
    eventBus.emit(GameEvents.PROGRESS, cleanPercent);
    this.overlayDirty = false;
    this.won = false;
    if (this.stroke) {
      this.stroke.setActive(false); // why: wait for next press after reset.
    }
    if (this.particles) {
      this.particles.clear();
    }
  }

  private onShutdown(): void {
    this.scale.off('resize', this.handleResize, this); // Remove resize handler when scene shuts down.
    this.progressTimer?.remove();
    if (this.stroke) {
      this.stroke.setActive(false);
    }
    eventBus.off(GameEvents.RESTART, this.handleRestart);
    eventBus.off(GameEvents.NEXT, this.handleNext);
    this.inputSvc.destroy();
    this.dirtRenderer.destroy();
    this.particles.destroy();
  }
}
