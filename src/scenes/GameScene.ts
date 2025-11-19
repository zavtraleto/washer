import Phaser from 'phaser';

import { getCatalog } from '../services/Catalog';
import { SilhouetteClip } from '../systems/SilhouetteClip';
import { DirtSystem } from '../systems/DirtSystem';
import { DirtTextureRenderer } from '../systems/DirtTextureRenderer';
import { ParticlesSystem } from '../systems/ParticlesSystem';
import { DebugOverlay } from '../systems/DebugOverlay';
import { TiltController } from '../systems/TiltController';
import { RNG } from '../services/RNG';
import { MathUtils } from '../utils/MathUtils';
import { GameEvents } from '../types/events';
import { InputHandler } from '../systems/InputHandler';
import { GameContext } from '../services/GameContext';
import { ScrubbingTool } from '../tools/ScrubbingTool';
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

// Win state config.
const WIN_THRESHOLD = 0.95; // Clean percentage required to trigger win (95%).

export default class GameScene extends Phaser.Scene {
  private mesh!: Phaser.GameObjects.Mesh; // Main 3D mesh object for cleaning interaction.
  private objKey!: string; // Texture key tied to the catalog asset for reuse.
  private silhouette!: SilhouetteClip; // Precomputed silhouette mask for clipping logic.

  private dirt!: DirtSystem; // Handles dirt coverage maps and erosion logic.
  private rng!: RNG; // Seeded RNG for repeatable dirt layouts.
  private dirtRenderer!: DirtTextureRenderer; // Renders dirt directly onto mesh texture.
  private progressTimer?: Phaser.Time.TimerEvent; // Periodic progress tick.

  private inputHandler!: InputHandler; // Clean Phaser pointer event handler.

  private scrubbingTool!: ScrubbingTool; // Scrubbing/brush cleaning tool.

  private particles!: ParticlesSystem; // Ballistic spray particle pool.

  private debugOverlay!: DebugOverlay; // Visual debug display.
  private tiltController!: TiltController; // Mesh tilt with spring physics.

  private gameContext!: GameContext; // Centralized game state (seed, coverage, win status).
  private overlayDirty = false; // Track texture refresh requests.

  private readonly handleResize = () => {
    this.layoutObject();
  }; // Reflow object and overlay whenever viewport changes.

  constructor() {
    super('GameScene');
  }

  create(): void {
    // loading catalog dtd + creating mesh with texture
    const catalog = getCatalog();
    const { object, layers } = catalog;
    this.objKey = OBJECT_TEXTURE_KEY; // Ensure we reuse the preload key.

    if (this.objKey !== object.id) {
      this.objKey = object.id; // Fallback if catalog key changes.
    }

    // Initialize GameContext with initial seed and coverage.
    const initialSeed = Math.max(1, Date.now() & 0xffff);
    this.gameContext = new GameContext(initialSeed, DEFAULT_COVERAGE);

    // Create mesh as the main cleanable object.
    this.mesh = this.add.mesh(0, 0, this.objKey);

    Phaser.Geom.Mesh.GenerateGridVerts({
      mesh: this.mesh,
      widthSegments: 8, // More vertices for smooth 3D deformation without warping.
      heightSegments: 8,
      texture: this.objKey,
    });
    this.mesh.hideCCW = false;

    // tech shit
    // Use a square viewport for perspective to prevent aspect ratio distortion.
    // This ensures perspective calculation doesn't stretch based on screen aspect.
    const perspectiveSize = 1000; // Fixed square viewport for consistent projection.
    this.mesh.setPerspective(perspectiveSize, perspectiveSize, 45);
    this.mesh.panZ(1);

    // Create debug overlay for visual feedback.
    this.debugOverlay = new DebugOverlay(this);
    this.debugOverlay.setMesh(this.mesh, () => this.getMeshVisualBounds());

    // Create tilt controller for mesh spring physics (with bounds provider for accurate tilt).
    this.tiltController = new TiltController(this.mesh, SPRING_CONFIG, () =>
      this.getMeshVisualBounds(),
    );

    this.silhouette = new SilhouetteClip(
      this,
      this.objKey,
      SILHOUETTE_SIZE,
      0.5,
    ); // Build silhouette mask once for clipping.

    const maskSize = this.silhouette.getSize();

    this.dirt = new DirtSystem(maskSize, layers, this.silhouette);

    this.dirtRenderer = new DirtTextureRenderer(this, this.mesh, this.objKey);

    this.particles = new ParticlesSystem(this, this.mesh, this.events);

    this.progressTimer = this.time.addEvent({
      delay: 200,
      loop: true,
      callback: () => {
        const unionRatio = this.dirt.getUnionDirtyRatio();
        const cleanPercent = (1 - unionRatio) * 100;
        this.game.events.emit(GameEvents.PROGRESS, cleanPercent); // Emit clean percent to UI; UI lerps for smooth feel.
        if (!this.gameContext.isWon() && cleanPercent >= WIN_THRESHOLD * 100) {
          this.handleWin(cleanPercent);
        }
      },
    }); // Update at ~5 Hz to keep CPU/GPU cost low.

    this.game.events.on(GameEvents.RESTART, this.handleRestart, this);
    this.game.events.on(GameEvents.NEXT, this.handleNext, this);

    // Create scrubbing tool with current catalog config.
    const scrubbingConfig = catalog.tools?.scrubber;

    this.scrubbingTool = new ScrubbingTool(
      this,
      scrubbingConfig,
      this.dirt,
      (wx, wy) => this.worldToLocal(wx, wy),
      this.events,
      this.tiltController,
    );
    this.scrubbingTool.activate();

    // Initialize InputHandler with callback to get active tool and tilt controller.
    this.inputHandler = new InputHandler(
      this,
      () => this.scrubbingTool,
      this.tiltController,
    );

    // Initialize level AFTER all systems are ready.
    this.reinitLevel();

    this.events.on(GameEvents.STAMP_APPLIED, this.handleStampApplied, this);

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
    const screenAspect = width / height;

    // Detect mobile portrait vs PC/landscape.
    const isMobilePortrait = screenAspect < 0.75; // Narrower than 3:4 = portrait.

    let scale: number;
    if (isMobilePortrait) {
      // Mobile portrait: fill most of vertical space, but don't exceed width.
      const maxHeight = height * 0.85; // 85% of screen height.
      const maxWidth = width * 0.95; // Don't exceed 95% of screen width.
      const scaleByHeight = maxHeight / texHeight;
      const scaleByWidth = maxWidth / texWidth;
      scale = Math.min(scaleByHeight, scaleByWidth); // Use smaller to fit both constraints.
    } else {
      // PC/landscape: fill most of horizontal space, max 75% of width.
      const maxWidth = width * 0.75; // Max 75% of screen width.
      const maxHeight = height * 0.9; // Don't exceed 90% of screen height.
      const scaleByWidth = maxWidth / texWidth;
      const scaleByHeight = maxHeight / texHeight;
      scale = Math.min(scaleByWidth, scaleByHeight); // Fit within both constraints.
    }

    // Apply uniform scale (maintains aspect ratio).
    this.mesh.setScale(scale);
    this.mesh.setPosition(width * 0.5, height * 0.5);

    if (this.particles) {
      this.particles.relayout();
    }
  }

  public worldToLocal(x: number, y: number): { u: number; v: number } {
    const bounds = this.getMeshVisualBounds();
    if (!bounds) {
      return { u: 0.5, v: 0.5 };
    }

    // Convert world position to UV using actual mesh bounds.
    const u = (x - bounds.left) / bounds.width;
    const v = (y - bounds.top) / bounds.height;

    return {
      u: this.clampUV(u),
      v: this.clampUV(v),
    };
  }

  private getMeshVisualBounds(): {
    left: number;
    top: number;
    width: number;
    height: number;
  } | null {
    if (!this.mesh || !this.mesh.vertices || this.mesh.vertices.length === 0) {
      return null;
    }

    // Mesh vertices are in local space - need to transform to world space.
    const matrix = this.mesh.getWorldTransformMatrix();
    const verts = this.mesh.vertices;
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;

    for (let i = 0; i < verts.length; i++) {
      const v = verts[i];
      if (!v) continue;

      // Transform local vertex to world coordinates.
      const worldX = v.vx * matrix.a + v.vy * matrix.c + matrix.e;
      const worldY = v.vx * matrix.b + v.vy * matrix.d + matrix.f;

      if (worldX < minX) minX = worldX;
      if (worldX > maxX) maxX = worldX;
      if (worldY < minY) minY = worldY;
      if (worldY > maxY) maxY = worldY;
    }

    return {
      left: minX,
      top: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
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
      inputActive: false,
      tiltX: tilt.x,
      tiltY: tilt.y,
      particleCount: this.particles.getActiveCount(),
      seed: this.gameContext.getSeed(),
    });
    this.debugOverlay.update();

    if (this.particles) {
      this.particles.update(delta / 1000); // Simple ballistic motion step.
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
    this.gameContext.setWon();
    this.inputHandler.lock();

    // Instantly wipe remaining dirt (final 5%).
    this.dirt.clearAll();
    const { map0, map1 } = this.dirt.getMapsForShader();
    this.dirtRenderer.updateTexture(map0, map1);

    // Clear all active particles for clean win moment.
    this.particles.clear();
  }

  private handleRestart(): void {
    this.gameContext.reset(); // Reset state to 'playing' with current seed.
    this.reinitLevel(); // what: reset with current seed for repeatability.
  }

  private handleNext(): void {
    this.gameContext.nextLevel(); // Generate new seed and reset state.
    this.reinitLevel(); // what: derive new seed and recreate dirt layout.
  }

  private reinitLevel(): void {
    // Note: seed management now handled by GameContext in handleRestart/handleNext.
    // This method just uses the current seed from context.
    this.rng = new RNG(this.gameContext.getSeed());
    this.dirt.init(this.rng, this.gameContext.getCoverage());
    const { map0, map1 } = this.dirt.getMapsForShader();
    this.dirtRenderer.updateTexture(map0, map1);
    const cleanPercent = (1 - this.dirt.getUnionDirtyRatio()) * 100;
    this.game.events.emit(GameEvents.PROGRESS, cleanPercent);
    this.overlayDirty = false;
    this.inputHandler.unlock();
    if (this.particles) {
      this.particles.clear();
    }
  }

  private handleStampApplied(): void {
    this.overlayDirty = true;
  }

  private onShutdown(): void {
    this.scale.off('resize', this.handleResize, this);
    this.progressTimer?.remove();
    this.game.events.off(GameEvents.RESTART, this.handleRestart, this);
    this.game.events.off(GameEvents.NEXT, this.handleNext, this);
    this.events.off(GameEvents.STAMP_APPLIED, this.handleStampApplied, this);
    this.inputHandler.destroy();
    this.dirtRenderer.destroy();
    this.particles.destroy();
  }
}
