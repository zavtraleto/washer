import Phaser from 'phaser';

const TEXTURE_KEY = 'particle_circle';
const MAX_PARTICLES = 120;
const MAX_BURST = 8;
const BASE_BURST = 4;
const BURST_SCALE = 6;
const SPEED_MIN = 150;
const SPEED_MAX = 280;
const ANGLE_JITTER = 0.4; // ~23° cone for organic spread.
const GRAVITY_MIN = 320;
const GRAVITY_MAX = 360;
const DRAG_MIN = 0.88;
const DRAG_MAX = 0.94;
const LIFE_MIN = 0.35;
const LIFE_MAX = 0.6;
const SCALE_MIN = 0.5;
const SCALE_MAX = 0.9;
const ALPHA_MIN = 0.7;
const ALPHA_MAX = 1.0;
const COLOR_MOLD = 0x33ff66;
const COLOR_GREASE = 0x8a5a2b;
const DEBUG_PARTICLES = false;

interface ParticleState {
  sprite: Phaser.GameObjects.Image;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  drag: number;
  gravity: number;
  baseAlpha: number;
  baseScale: number;
  active: boolean;
}

// Tiny pooled particle images for cheap, pretty spray.
export class ParticlesSystem {
  private readonly particles: ParticleState[] = [];
  private activeCount = 0;
  private depth = 0;
  private scaleFactor = 1;
  private debugTimer = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly objectMesh: Phaser.GameObjects.Mesh,
  ) {
    this.ensureTexture();
    this.depth = this.objectMesh.depth + 1;
    this.scaleFactor = this.computeObjectScale();

    for (let i = 0; i < MAX_PARTICLES; i += 1) {
      const sprite = scene.add
        .image(objectMesh.x, objectMesh.y, TEXTURE_KEY)
        .setActive(false)
        .setVisible(false)
        .setDepth(this.depth)
        .setBlendMode(Phaser.BlendModes.ADD);

      this.particles.push({
        sprite,
        x: objectMesh.x,
        y: objectMesh.y,
        vx: 0,
        vy: 0,
        life: 0,
        maxLife: 0,
        drag: 0.9,
        gravity: 0,
        baseAlpha: 1,
        baseScale: 1,
        active: false,
      });
    }
  }

  spawn(
    x: number,
    y: number,
    dirX: number,
    dirY: number,
    intensity: number,
  ): void {
    const available = MAX_PARTICLES - this.activeCount;
    if (available <= 0) {
      return; // Pool exhausted; skip burst to keep FPS solid.
    }

    const normalized = this.normalizeDirection(dirX, dirY);
    const clampedIntensity = Phaser.Math.Clamp(intensity, 0.3, 1.5);
    const desired = Math.round(BASE_BURST + clampedIntensity * BURST_SCALE);
    const count = Math.min(MAX_BURST, Math.max(1, desired), available);

    for (let i = 0; i < count; i += 1) {
      const particle = this.acquire();
      if (!particle) {
        break;
      }
      this.activateParticle(
        particle,
        x,
        y,
        normalized.x,
        normalized.y,
        clampedIntensity,
      );
    }
  }

  update(dtSeconds: number): void {
    if (dtSeconds <= 0) {
      return;
    }

    const depth = this.objectMesh.depth + 1;

    for (const particle of this.particles) {
      if (!particle.active) {
        continue;
      }

      particle.vy += particle.gravity * dtSeconds;
      particle.x += particle.vx * dtSeconds;
      particle.y += particle.vy * dtSeconds;
      particle.vx *= particle.drag;
      particle.vy *= particle.drag;
      particle.life += dtSeconds;

      const t = particle.life / particle.maxLife;
      if (t >= 1) {
        this.deactivate(particle);
        continue;
      }

      const alpha = particle.baseAlpha * (1 - t);
      const scale = particle.baseScale * (0.7 + 0.3 * (1 - t));

      particle.sprite
        .setAlpha(alpha)
        .setScale(scale)
        .setPosition(particle.x, particle.y)
        .setDepth(depth);
    }

    if (DEBUG_PARTICLES) {
      this.debugTimer += dtSeconds;
      if (this.debugTimer >= 1) {
        // eslint-disable-next-line no-console -- Debug particle count.
        console.log('[Particles]', 'active=', this.activeCount);
        this.debugTimer = 0;
      }
    }
  }

  relayout(): void {
    const newDepth = this.objectMesh.depth + 1;
    const newScale = this.computeObjectScale();
    const scaleRatio = newScale / this.scaleFactor;
    this.scaleFactor = newScale;
    this.depth = newDepth;

    for (const particle of this.particles) {
      particle.sprite.setDepth(newDepth);
      if (particle.active) {
        particle.baseScale *= scaleRatio;
        particle.sprite.setScale(particle.baseScale);
      }
    }
  }

  clear(): void {
    for (const particle of this.particles) {
      if (particle.active) {
        this.deactivate(particle);
      }
    }
    this.debugTimer = 0;
  }

  destroy(): void {
    this.clear();
    for (const particle of this.particles) {
      particle.sprite.destroy();
    }
    this.particles.length = 0;
  }

  private ensureTexture(): void {
    if (this.scene.textures.exists(TEXTURE_KEY)) {
      return;
    }
    const graphics = this.scene.add.graphics({ x: 0, y: 0 });
    graphics.fillStyle(0xffffff, 1);
    graphics.fillCircle(4, 4, 4);
    graphics.generateTexture(TEXTURE_KEY, 8, 8);
    graphics.destroy();
  }

  private activateParticle(
    particle: ParticleState,
    x: number,
    y: number,
    dirX: number,
    dirY: number,
    intensity: number,
  ): void {
    const angleOffset = Phaser.Math.FloatBetween(-ANGLE_JITTER, ANGLE_JITTER);
    const angle = Math.atan2(dirY, dirX) + angleOffset;
    const speed = Phaser.Math.FloatBetween(SPEED_MIN, SPEED_MAX) * intensity;
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;
    const maxLife = Phaser.Math.FloatBetween(LIFE_MIN, LIFE_MAX);
    const gravity = Phaser.Math.FloatBetween(GRAVITY_MIN, GRAVITY_MAX);
    const drag = Phaser.Math.FloatBetween(DRAG_MIN, DRAG_MAX);
    const baseScale =
      Phaser.Math.FloatBetween(SCALE_MIN, SCALE_MAX) * this.scaleFactor;
    const baseAlpha = Phaser.Math.FloatBetween(ALPHA_MIN, ALPHA_MAX);

    particle.x = x;
    particle.y = y;
    particle.vx = vx;
    particle.vy = vy;
    particle.life = 0;
    particle.maxLife = maxLife;
    particle.gravity = gravity;
    particle.drag = drag;
    particle.baseScale = baseScale;
    particle.baseAlpha = baseAlpha;
    particle.active = true;

    particle.sprite
      .setActive(true)
      .setVisible(true)
      .setPosition(x, y)
      .setAlpha(baseAlpha)
      .setScale(baseScale)
      .setDepth(this.depth)
      .setTint(this.pickTint());

    this.activeCount += 1;
  }

  private deactivate(particle: ParticleState): void {
    if (!particle.active) {
      return;
    }
    particle.active = false;
    particle.sprite.setActive(false).setVisible(false);
    this.activeCount = Math.max(0, this.activeCount - 1);
  }

  private normalizeDirection(
    dirX: number,
    dirY: number,
  ): { x: number; y: number } {
    const length = Math.hypot(dirX, dirY);
    if (length <= 0.0001) {
      return { x: 0, y: -1 }; // Default upward blast if direction is undefined.
    }
    return { x: dirX / length, y: dirY / length };
  }

  private acquire(): ParticleState | undefined {
    for (const particle of this.particles) {
      if (!particle.active) {
        return particle;
      }
    }
    return undefined;
  }

  private computeObjectScale(): number {
    // For mesh, use displayWidth/displayHeight directly as scale reference.
    const baseSize =
      Math.max(this.objectMesh.displayWidth, this.objectMesh.displayHeight) ||
      1;
    return baseSize / 512; // Normalize to a typical object size.
  }

  private pickTint(): number {
    const t = Phaser.Math.FloatBetween(0, 1);
    if (t < 0.5) {
      return COLOR_MOLD;
    }
    return COLOR_GREASE;
  }
}
