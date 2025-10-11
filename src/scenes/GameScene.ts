import Phaser from 'phaser';

import { getCatalog } from '../services/Catalog';
import { SilhouetteClip } from '../systems/SilhouetteClip';
import { DirtSystem } from '../systems/DirtSystem';
import { DirtDebugOverlay } from '../systems/DirtDebugOverlay';
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

export default class GameScene extends Phaser.Scene {
  private static readonly DEBUG = true; // Toggle minimal debug output.

  private obj!: Phaser.GameObjects.Image; // Object sprite shown to the player (cleanable surface).
  private objKey!: string; // Texture key tied to the catalog asset for reuse.
  private silhouette!: SilhouetteClip; // Precomputed silhouette mask for clipping logic.
  private dirt!: DirtSystem; // Handles dirt coverage maps and erosion logic.
  private rng!: RNG; // Seeded RNG for repeatable dirt layouts.
  private overlay!: DirtDebugOverlay; // Union dirt visualization.
  private progressTimer?: Phaser.Time.TimerEvent; // Periodic progress tick.
  private inputSvc!: InputService; // Normalized pointer stream.
  private stroke!: StrokeSystem; // Turns drag path into stamps.
  private overlayDirty = false; // Track overlay refresh requests.
  private overlayCooldown = 0; // Throttle overlay refresh cadence.
  private debugTick = 0; // Tracks debug log cadence.
  private readonly maxBoxRatio = 0.7; // Portion of screen reserved for the object.
  private readonly handleResize = () => {
    this.layoutObject();
    if (this.overlay) {
      this.overlay.relayout();
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
    this.obj = this.add.image(0, 0, this.objKey).setOrigin(0.5); // Center-origin image for clean UV math.
    this.silhouette = new SilhouetteClip(
      this,
      this.objKey,
      SILHOUETTE_SIZE,
      0.5,
    ); // Build silhouette mask once for clipping.

    const seed = Phaser.Math.Between(1, 0x7fffffff);
    this.rng = new RNG(seed);
    const maskSize = this.silhouette.getSize();
    this.dirt = new DirtSystem(maskSize, layers, this.silhouette);
    this.dirt.init(this.rng, DEFAULT_COVERAGE);
    const maps = this.dirt.getMapsForShader();
    this.overlay = new DirtDebugOverlay(this, this.obj, maps.size);
    this.overlay.updateUnion(maps.map0, maps.map1);
    this.overlayDirty = false;
    this.overlayCooldown = 0;
    this.progressTimer = this.time.addEvent({
      delay: 200,
      loop: true,
      callback: () => {
        const unionRatio = this.dirt.getUnionDirtyRatio();
        const cleanPercent = (1 - unionRatio) * 100;
        this.game.events.emit('PROGRESS', cleanPercent); // Emit clean percent to UI; UI lerps for smooth feel.
        if (GameScene.DEBUG) {
          this.debugTick += 1;
          if (this.debugTick % 5 === 0) {
            // eslint-disable-next-line no-console -- Debug overlay cadence.
            console.log('[Progress]', `clean=${cleanPercent.toFixed(1)}%`);
          }
        }
      },
    }); // Update at ~5 Hz to keep CPU/GPU cost low.

    this.inputSvc = new InputService(this); // Normalize pointer events into world-space samples.
    this.stroke = new StrokeSystem(this, catalog.tool, this.dirt, (wx, wy) =>
      this.worldToLocal(wx, wy),
    );
    this.inputSvc.onDown((p) => {
      this.stroke.setActive(true);
      this.stroke.handleDown(p.x, p.y, p.t);
      if (GameScene.DEBUG) {
        // eslint-disable-next-line no-console -- Minimal pointer debug.
        console.log('[Input]', 'down', p.x.toFixed(1), p.y.toFixed(1));
      }
    });
    this.inputSvc.onMove((p) => {
      this.stroke.handleMove(p.x, p.y, p.t);
    });
    this.inputSvc.onUp((p) => {
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
      console.log('[Dirt]', 'seed=', seed, 'unionDirty=', unionDirty);
    }

    this.layoutObject();
    this.scale.on('resize', this.handleResize, this); // Respond to window/device changes.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this); // Stop listeners when scene ends.
  }

  private layoutObject(): void {
    if (!this.obj.texture || this.obj.width === 0 || this.obj.height === 0) {
      return; // Texture not ready yet; skip layout.
    }

    const { width, height } = this.scale.gameSize;
    if (width === 0 || height === 0) {
      return; // Nothing to layout when viewport has no size.
    }

    const shortest = Math.min(width, height);
    const maxSize = shortest * this.maxBoxRatio;
    const scale = Math.min(maxSize / this.obj.width, maxSize / this.obj.height);

    this.obj.setScale(scale);
    this.obj.setPosition(width * 0.5, height * 0.5); // Center and uniformly scale the object to fit mobile/desktop.
    if (this.overlay) {
      this.overlay.relayout();
    }
  }

  public worldToLocal(x: number, y: number): { u: number; v: number } {
    if (!this.obj) {
      return { u: 0.5, v: 0.5 }; // Default to center if object is missing.
    }

    const displayWidth = this.obj.displayWidth;
    const displayHeight = this.obj.displayHeight;
    if (displayWidth === 0 || displayHeight === 0) {
      return { u: 0.5, v: 0.5 }; // Avoid division by zero.
    }

    const localX = x - this.obj.x;
    const localY = y - this.obj.y;
    const uRaw = 0.5 + localX / displayWidth;
    const vRaw = 0.5 + localY / displayHeight;

    return {
      u: this.clampUV(uRaw),
      v: this.clampUV(vRaw),
    }; // Convert a world point to local UV [0..1] for later dirt/brush math.
  }

  public localToWorld(u: number, v: number): { x: number; y: number } {
    if (!this.obj) {
      return { x: 0, y: 0 }; // Nothing to project without the object.
    }

    const clampedU = this.clampUV(u);
    const clampedV = this.clampUV(v);
    const localX = (clampedU - 0.5) * this.obj.displayWidth;
    const localY = (clampedV - 0.5) * this.obj.displayHeight;

    return {
      x: this.obj.x + localX,
      y: this.obj.y + localY,
    }; // Simple mapping: assumes no rotation; good for MVP; revisit if tilt is added.
  }

  public override update(_time: number, delta: number): void {
    if (this.stroke) {
      this.stroke.update(delta);
      if (this.stroke.didStampSinceLastCheck()) {
        this.overlayDirty = true;
      }
    }

    this.overlayCooldown += delta;
    if (this.overlayDirty && this.overlayCooldown >= 90) {
      const { map0, map1 } = this.dirt.getMapsForShader();
      this.overlay.updateUnion(map0, map1);
      this.overlayDirty = false;
      this.overlayCooldown = 0;
    }
  }

  private clampUV(value: number): number {
    return Phaser.Math.Clamp(value, UV_EPSILON, 1 - UV_EPSILON); // Clamp UV with a tiny epsilon for stability.
  }

  private onShutdown(): void {
    this.scale.off('resize', this.handleResize, this); // Remove resize handler when scene shuts down.
    this.progressTimer?.remove();
    if (this.stroke) {
      this.stroke.setActive(false);
    }
    this.inputSvc.destroy();
    this.overlay.destroy();
  }
}
