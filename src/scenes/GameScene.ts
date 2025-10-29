import Phaser from 'phaser';

import { getCatalog } from '../services/Catalog';
import { SilhouetteClip } from '../systems/SilhouetteClip';
import { DirtSystem } from '../systems/DirtSystem';
import { DirtTextureRenderer } from '../systems/DirtTextureRenderer';
import { ParticlesSystem } from '../systems/ParticlesSystem';
import { RNG } from '../services/RNG';
import { InputService } from '../services/InputService';
import { StrokeSystem } from '../systems/StrokeSystem';
import type { DirtLayerId } from '../types/config';
import { OBJECT_TEXTURE_KEY } from './PreloadScene';

const UV_EPSILON = 1e-6;
const SILHOUETTE_SIZE = 256;
const DEFAULT_COVERAGE: Record<DirtLayerId, number> = {
  mold: 0.8,
  grease: 0.6,
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
  private static readonly DEBUG = true; // Toggle minimal debug output.

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
  private overlayDirty = false; // Track texture refresh requests.
  private won = false; // Prevent double-win triggers.
  private seed = Math.max(1, Date.now() & 0xffff); // Current level seed.
  private debugTick = 0; // Tracks debug log cadence.
  private readonly maxBoxRatio = 0.85; // Portion of screen reserved for the object (increased for larger mesh).

  // Debug graphics for visualizing mesh bounds.
  private debugGraphics?: Phaser.GameObjects.Graphics;

  // Spring physics state for mesh tilt.
  private currentTiltX = 0; // Current tilt rotation X in radians.
  private currentTiltY = 0; // Current tilt rotation Y in radians.
  private targetTiltX = 0; // Target tilt rotation X based on cursor position.
  private targetTiltY = 0; // Target tilt rotation Y based on cursor position.
  private tiltVelX = 0; // Spring velocity X for smooth return.
  private tiltVelY = 0; // Spring velocity Y for smooth return.
  private isInteracting = false; // Track if pointer is currently down.

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

    // Create debug graphics to visualize mesh bounds.
    // if (GameScene.DEBUG) {
    //   this.debugGraphics = this.add.graphics();
    //   this.debugGraphics.setDepth(1000); // Render on top of everything.
    // }

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
        this.game.events.emit('PROGRESS', cleanPercent); // Emit clean percent to UI; UI lerps for smooth feel.
        if (!this.won && cleanPercent >= 95) {
          this.handleWin(cleanPercent);
        }
        if (GameScene.DEBUG) {
          this.debugTick += 1;
          if (this.debugTick % 5 === 0) {
            // eslint-disable-next-line no-console -- Debug overlay cadence.
            console.log('[Progress]', `clean=${cleanPercent.toFixed(1)}%`);
          }
        }
      },
    }); // Update at ~5 Hz to keep CPU/GPU cost low.

    this.game.events.on('RESTART', this.handleRestart, this);
    this.game.events.on('NEXT', this.handleNext, this);

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

        // Debug: log dirt values to see what's happening
        if (GameScene.DEBUG && Math.random() < 0.05) {
          // eslint-disable-next-line no-console
          console.log(
            '[Particles]',
            `u=${u.toFixed(2)} v=${v.toFixed(2)} dirt=${dirtValue.toFixed(2)}`,
          );
        }

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
      this.isInteracting = true;
      this.stroke.setActive(true);
      this.stroke.handleDown(p.x, p.y, p.t);
      if (GameScene.DEBUG) {
        // eslint-disable-next-line no-console -- Minimal pointer debug.
        console.log('[Input]', 'down', p.x.toFixed(1), p.y.toFixed(1));
      }
    });
    this.inputSvc.onMove((p) => {
      if (this.won) {
        return;
      }
      this.stroke.handleMove(p.x, p.y, p.t);

      // Update tilt target based on pointer position relative to mesh center.
      if (this.isInteracting) {
        this.updateTiltTarget(p.x, p.y);
      }
    });
    this.inputSvc.onUp((p) => {
      if (this.won) {
        return;
      }
      this.isInteracting = false;
      this.targetTiltX = 0;
      this.targetTiltY = 0;
      this.stroke.handleUp(p.x, p.y, p.t);
      if (GameScene.DEBUG) {
        // eslint-disable-next-line no-console -- Minimal pointer debug.
        console.log('[Input]', 'up', p.x.toFixed(1), p.y.toFixed(1));
      }
    });

    if (GameScene.DEBUG) {
      const mask = this.silhouette.getMask();
      const size = this.silhouette.getSize();
      const total = mask.reduce((sum, value) => sum + value, 0);
      const filledRatio = total / (size * size);
      const unionDirty = this.dirt.getUnionDirtyRatio().toFixed(3);
      // eslint-disable-next-line no-console -- Debug hook for silhouette metrics.
      console.log(
        '[Silhouette]',
        'size=',
        size,
        'fill=',
        filledRatio.toFixed(3),
      );
      // eslint-disable-next-line no-console -- Debug dirt initialization output.
      console.log('[Dirt]', 'seed=', this.seed, 'unionDirty=', unionDirty);
    }

    this.layoutObject();
    this.scale.on('resize', this.handleResize, this); // Respond to window/device changes.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this); // Stop listeners when scene ends.

    // Debug mesh structure on first frame after render.
    if (GameScene.DEBUG) {
      this.time.delayedCall(100, () => {
        // eslint-disable-next-line no-console
        console.log('[Mesh Debug]', {
          faces: this.mesh.faces?.length,
          sampleVertex: this.mesh.faces?.[0]?.vertex1,
          displaySize: `${this.mesh.displayWidth.toFixed(0)}x${this.mesh.displayHeight.toFixed(0)}`,
          position: `${this.mesh.x.toFixed(0)},${this.mesh.y.toFixed(0)}`,
        });
      });
    }
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

    // Debug: log mesh size and position.
    if (GameScene.DEBUG) {
      const bounds = this.getMeshVisualBounds();
      // eslint-disable-next-line no-console
      console.log(
        '[Mesh Layout]',
        `displaySize=${this.mesh.displayWidth.toFixed(1)}x${this.mesh.displayHeight.toFixed(1)}`,
        `pos=${this.mesh.x.toFixed(0)},${this.mesh.y.toFixed(0)}`,
        `scale=${finalScale.toFixed(3)}`,
        `texSize=${texWidth}x${texHeight}`,
        bounds
          ? `actualBounds: left=${bounds.left.toFixed(0)} right=${(bounds.left + bounds.width).toFixed(0)} top=${bounds.top.toFixed(0)} bottom=${(bounds.top + bounds.height).toFixed(0)}`
          : 'actualBounds: not available',
      );
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

    // Debug: log UV calculation.
    if (GameScene.DEBUG && Math.random() < 0.05) {
      // eslint-disable-next-line no-console
      console.log(
        '[UV Debug]',
        `cursor=(${x.toFixed(0)},${y.toFixed(0)})`,
        `bounds=(${bounds.left.toFixed(0)},${bounds.top.toFixed(0)},${bounds.width.toFixed(0)}x${bounds.height.toFixed(0)})`,
        `uv=(${uRaw.toFixed(3)},${vRaw.toFixed(3)})`,
      );
    }

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

        // Debug: show the calculation.
        if (GameScene.DEBUG && Math.random() < 0.01) {
          // eslint-disable-next-line no-console
          console.log(
            '[Bounds] vertex-based:',
            `${validVertexCount} vertices`,
            `meshPos=(${meshWorldX.toFixed(0)},${meshWorldY.toFixed(0)})`,
            `screen=(${minX.toFixed(0)},${minY.toFixed(0)}) to (${maxX.toFixed(0)},${maxY.toFixed(0)})`,
            `size=${width.toFixed(0)}x${height.toFixed(0)}`,
          );
        }

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

    if (GameScene.DEBUG && Math.random() < 0.01) {
      // eslint-disable-next-line no-console
      console.log(
        '[Bounds] calculated fallback:',
        `tex=${texWidth}x${texHeight}`,
        `scale=${scale.toFixed(3)}`,
        `panZ=${panZValue.toFixed(2)}`,
        `magnification=${perspectiveMagnification.toFixed(3)}`,
        `visual=${visualWidth.toFixed(0)}x${visualHeight.toFixed(0)}`,
      );
    }

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
    // Apply spring physics to mesh tilt.
    this.updateSpringPhysics(delta / 1000);

    // Update debug visualization.
    if (GameScene.DEBUG && this.debugGraphics) {
      this.drawDebugBounds();
    }

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

  private updateTiltTarget(pointerX: number, pointerY: number): void {
    if (!this.mesh) {
      return;
    }

    // Calculate normalized offset from mesh center (-1..1).
    const dx = (pointerX - this.mesh.x) / (this.mesh.displayWidth * 0.5);
    const dy = (pointerY - this.mesh.y) / (this.mesh.displayHeight * 0.5);

    // Clamp to prevent extreme tilts at edges.
    const clampedDx = Phaser.Math.Clamp(dx, -1, 1);
    const clampedDy = Phaser.Math.Clamp(dy, -1, 1);

    // Convert to radians with max tilt limit.
    const maxTiltRad = Phaser.Math.DegToRad(SPRING_CONFIG.maxTiltDegrees);
    this.targetTiltY = -clampedDx * maxTiltRad; // Y rotation for horizontal cursor movement.
    this.targetTiltX = -clampedDy * maxTiltRad; // X rotation for vertical cursor movement.
  }

  private updateSpringPhysics(dtSeconds: number): void {
    if (!this.mesh || dtSeconds <= 0) {
      return;
    }

    // Lerp toward target when interacting.
    if (this.isInteracting) {
      this.currentTiltX = Phaser.Math.Linear(
        this.currentTiltX,
        this.targetTiltX,
        SPRING_CONFIG.tiltSpeed,
      );
      this.currentTiltY = Phaser.Math.Linear(
        this.currentTiltY,
        this.targetTiltY,
        SPRING_CONFIG.tiltSpeed,
      );
    } else {
      // Spring back to center when not interacting.
      const errorX = -this.currentTiltX;
      const errorY = -this.currentTiltY;

      // Apply spring force.
      this.tiltVelX += errorX * SPRING_CONFIG.stiffness;
      this.tiltVelY += errorY * SPRING_CONFIG.stiffness;

      // Apply damping.
      this.tiltVelX *= SPRING_CONFIG.damping;
      this.tiltVelY *= SPRING_CONFIG.damping;

      // Update positions.
      this.currentTiltX += this.tiltVelX;
      this.currentTiltY += this.tiltVelY;

      // Stop when close enough to avoid jitter.
      if (
        Math.abs(this.currentTiltX) < 0.001 &&
        Math.abs(this.tiltVelX) < 0.001
      ) {
        this.currentTiltX = 0;
        this.tiltVelX = 0;
      }
      if (
        Math.abs(this.currentTiltY) < 0.001 &&
        Math.abs(this.tiltVelY) < 0.001
      ) {
        this.currentTiltY = 0;
        this.tiltVelY = 0;
      }
    }

    // Apply rotation to mesh.
    this.mesh.modelRotation.x = this.currentTiltX;
    this.mesh.modelRotation.y = this.currentTiltY;
  }

  private clampUV(value: number): number {
    return Phaser.Math.Clamp(value, UV_EPSILON, 1 - UV_EPSILON); // Clamp UV with a tiny epsilon for stability.
  }

  private handleWin(cleanPercent: number): void {
    this.won = true;
    if (this.stroke) {
      this.stroke.setActive(false); // Lock input when win condition met.
    }
    this.game.events.emit('WIN');
    if (GameScene.DEBUG) {
      // eslint-disable-next-line no-console -- Report win threshold hit.
      console.log('[Win]', `clean=${cleanPercent.toFixed(1)}%`);
    }
  }

  private handleRestart(): void {
    this.reinitLevel(false); // what: reset with current seed for repeatability.
  }

  private handleNext(): void {
    this.reinitLevel(true); // what: reseed for a fresh layout.
  }

  private drawDebugBounds(): void {
    if (!this.debugGraphics || !this.mesh) {
      return;
    }

    this.debugGraphics.clear();

    const bounds = this.getMeshVisualBounds();
    if (!bounds) {
      return;
    }

    // Draw red rectangle around actual mesh visual bounds from projected vertices.
    this.debugGraphics.lineStyle(2, 0xff0000, 1);
    this.debugGraphics.strokeRect(
      bounds.left,
      bounds.top,
      bounds.width,
      bounds.height,
    );

    // Draw crosshair at mesh center.
    const centerX = bounds.left + bounds.width / 2;
    const centerY = bounds.top + bounds.height / 2;
    this.debugGraphics.lineStyle(1, 0x00ff00, 1);
    this.debugGraphics.beginPath();
    this.debugGraphics.moveTo(centerX - 10, centerY);
    this.debugGraphics.lineTo(centerX + 10, centerY);
    this.debugGraphics.moveTo(centerX, centerY - 10);
    this.debugGraphics.lineTo(centerX, centerY + 10);
    this.debugGraphics.strokePath();
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
    this.game.events.emit('PROGRESS', cleanPercent);
    this.overlayDirty = false;
    this.won = false;
    this.debugTick = 0;
    if (this.stroke) {
      this.stroke.setActive(false); // why: wait for next press after reset.
    }
    if (this.particles) {
      this.particles.clear();
    }
    if (GameScene.DEBUG) {
      // eslint-disable-next-line no-console -- Track level resets.
      console.log(
        '[Level]',
        'seed=',
        this.seed,
        'clean=',
        cleanPercent.toFixed(1),
      );
    }
  }

  private onShutdown(): void {
    this.scale.off('resize', this.handleResize, this); // Remove resize handler when scene shuts down.
    this.progressTimer?.remove();
    if (this.stroke) {
      this.stroke.setActive(false);
    }
    this.game.events.off('RESTART', this.handleRestart, this);
    this.game.events.off('NEXT', this.handleNext, this);
    this.inputSvc.destroy();
    this.dirtRenderer.destroy();
    this.particles.destroy();
  }
}
