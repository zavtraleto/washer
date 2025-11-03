import Phaser from 'phaser';

const TEXTURE_KEY = 'particle_circle';
const DEBUG_PARTICLES = true; // Enable to see particle spawn counts.

// Water particles config (cleaning spray from cursor).
const WATER_CONFIG = {
  maxParticles: 80,
  maxBurst: 10,
  baseBurst: 6,
  burstScale: 5,
  speedMin: 200,
  speedMax: 380,
  angleJitter: 0.35, // ~20° cone for splashy spray.
  gravityMin: 250,
  gravityMax: 350,
  dragMin: 0.91,
  dragMax: 0.95,
  lifeMin: 0.4,
  lifeMax: 0.75,
  scaleMin: 0.6,
  scaleMax: 1.0,
  alphaMin: 0.7,
  alphaMax: 0.95,
  colors: [0x4da6ff, 0x6bb8ff, 0xffffff], // Blue and white water tones.
};

// Dirt particles config (heavy particles from dirty surface).
const DIRT_CONFIG = {
  maxParticles: 100,
  maxBurst: 15,
  baseBurst: 8,
  burstScale: 8,
  speedMin: 180,
  speedMax: 320,
  angleJitter: 0.12, // ~7° cone for directional spray.
  gravityMin: 600,
  gravityMax: 750,
  dragMin: 0.96,
  dragMax: 0.98,
  lifeMin: 0.8,
  lifeMax: 1.4,
  scaleMin: 1.2,
  scaleMax: 2.5,
  alphaMin: 0.8,
  alphaMax: 1.0,
  colors: [0x6b5d54, 0x4a3f38, 0x595550], // Muted dirt tones.
};

interface ParticleConfig {
  maxParticles: number;
  maxBurst: number;
  baseBurst: number;
  burstScale: number;
  speedMin: number;
  speedMax: number;
  angleJitter: number;
  gravityMin: number;
  gravityMax: number;
  dragMin: number;
  dragMax: number;
  lifeMin: number;
  lifeMax: number;
  scaleMin: number;
  scaleMax: number;
  alphaMin: number;
  alphaMax: number;
  colors: number[];
}

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

// Manages two separate particle pools: water (from cursor) and dirt (from dirty surface).
export class ParticlesSystem {
  private readonly waterParticles: ParticleState[] = [];
  private readonly dirtParticles: ParticleState[] = [];
  private waterActiveCount = 0;
  private dirtActiveCount = 0;
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

    // Create water particle pool.
    for (let i = 0; i < WATER_CONFIG.maxParticles; i += 1) {
      this.waterParticles.push(this.createParticle(objectMesh.x, objectMesh.y));
    }

    // Create dirt particle pool.
    for (let i = 0; i < DIRT_CONFIG.maxParticles; i += 1) {
      this.dirtParticles.push(this.createParticle(objectMesh.x, objectMesh.y));
    }
  }

  // Get total active particle count for debug display.
  getActiveCount(): number {
    return this.waterActiveCount + this.dirtActiveCount;
  }

  // Spawn water particles (always from cursor when cleaning).
  spawnWater(
    x: number,
    y: number,
    dirX: number,
    dirY: number,
    intensity: number,
  ): void {
    this.spawnBurst(
      this.waterParticles,
      WATER_CONFIG,
      x,
      y,
      dirX,
      dirY,
      intensity,
      () => {
        this.waterActiveCount += 1;
      },
    );
  }

  // Spawn dirt particles (only when hitting dirty areas).
  spawnDirt(
    x: number,
    y: number,
    dirX: number,
    dirY: number,
    intensity: number,
  ): void {
    if (DEBUG_PARTICLES && Math.random() < 0.1) {
      // eslint-disable-next-line no-console
      console.log(
        '[Particles] Spawning dirt at',
        x.toFixed(0),
        y.toFixed(0),
        'intensity=',
        intensity.toFixed(2),
      );
    }
    this.spawnBurst(
      this.dirtParticles,
      DIRT_CONFIG,
      x,
      y,
      dirX,
      dirY,
      intensity,
      () => {
        this.dirtActiveCount += 1;
      },
    );
  }

  update(dtSeconds: number): void {
    if (dtSeconds <= 0) {
      return;
    }

    const depth = this.objectMesh.depth + 1;

    // Update water particles.
    for (const particle of this.waterParticles) {
      if (particle.active) {
        this.updateParticle(particle, dtSeconds, depth);
        if (particle.life >= particle.maxLife) {
          this.deactivate(particle, () => {
            this.waterActiveCount = Math.max(0, this.waterActiveCount - 1);
          });
        }
      }
    }

    // Update dirt particles.
    for (const particle of this.dirtParticles) {
      if (particle.active) {
        this.updateParticle(particle, dtSeconds, depth);
        if (particle.life >= particle.maxLife) {
          this.deactivate(particle, () => {
            this.dirtActiveCount = Math.max(0, this.dirtActiveCount - 1);
          });
        }
      }
    }

    if (DEBUG_PARTICLES) {
      this.debugTimer += dtSeconds;
      if (this.debugTimer >= 1) {
        // eslint-disable-next-line no-console -- Debug particle count.
        console.log(
          '[Particles]',
          'water=',
          this.waterActiveCount,
          'dirt=',
          this.dirtActiveCount,
        );
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

    const allParticles = [...this.waterParticles, ...this.dirtParticles];
    for (const particle of allParticles) {
      particle.sprite.setDepth(newDepth);
      if (particle.active) {
        particle.baseScale *= scaleRatio;
        particle.sprite.setScale(particle.baseScale);
      }
    }
  }

  clear(): void {
    for (const particle of this.waterParticles) {
      if (particle.active) {
        this.deactivate(particle, () => {
          this.waterActiveCount = Math.max(0, this.waterActiveCount - 1);
        });
      }
    }
    for (const particle of this.dirtParticles) {
      if (particle.active) {
        this.deactivate(particle, () => {
          this.dirtActiveCount = Math.max(0, this.dirtActiveCount - 1);
        });
      }
    }
    this.debugTimer = 0;
  }

  destroy(): void {
    this.clear();
    const allParticles = [...this.waterParticles, ...this.dirtParticles];
    for (const particle of allParticles) {
      particle.sprite.destroy();
    }
    this.waterParticles.length = 0;
    this.dirtParticles.length = 0;
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

  private createParticle(x: number, y: number): ParticleState {
    const sprite = this.scene.add
      .image(x, y, TEXTURE_KEY)
      .setActive(false)
      .setVisible(false)
      .setDepth(this.depth)
      .setBlendMode(Phaser.BlendModes.NORMAL);

    return {
      sprite,
      x,
      y,
      vx: 0,
      vy: 0,
      life: 0,
      maxLife: 0,
      drag: 0.9,
      gravity: 0,
      baseAlpha: 1,
      baseScale: 1,
      active: false,
    };
  }

  private spawnBurst(
    pool: ParticleState[],
    config: ParticleConfig,
    x: number,
    y: number,
    dirX: number,
    dirY: number,
    intensity: number,
    onActivate: () => void,
  ): void {
    const activeCount = pool.filter((p) => p.active).length;
    const available = config.maxParticles - activeCount;
    if (available <= 0) {
      return; // Pool exhausted; skip burst to keep FPS solid.
    }

    const normalized = this.normalizeDirection(dirX, dirY);
    const clampedIntensity = Phaser.Math.Clamp(intensity, 0.3, 1.5);
    const desired = Math.round(
      config.baseBurst + clampedIntensity * config.burstScale,
    );
    const count = Math.min(config.maxBurst, Math.max(1, desired), available);

    for (let i = 0; i < count; i += 1) {
      const particle = this.acquire(pool);
      if (!particle) {
        break;
      }
      this.activateParticle(
        particle,
        config,
        x,
        y,
        normalized.x,
        normalized.y,
        clampedIntensity,
      );
      onActivate();
    }
  }

  private activateParticle(
    particle: ParticleState,
    config: ParticleConfig,
    x: number,
    y: number,
    dirX: number,
    dirY: number,
    intensity: number,
  ): void {
    const angleOffset = Phaser.Math.FloatBetween(
      -config.angleJitter,
      config.angleJitter,
    );
    const angle = Math.atan2(dirY, dirX) + angleOffset;
    const speed =
      Phaser.Math.FloatBetween(config.speedMin, config.speedMax) * intensity;
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;
    const maxLife = Phaser.Math.FloatBetween(config.lifeMin, config.lifeMax);
    const gravity = Phaser.Math.FloatBetween(
      config.gravityMin,
      config.gravityMax,
    );
    const drag = Phaser.Math.FloatBetween(config.dragMin, config.dragMax);
    const baseScale =
      Phaser.Math.FloatBetween(config.scaleMin, config.scaleMax) *
      this.scaleFactor;
    const baseAlpha = Phaser.Math.FloatBetween(
      config.alphaMin,
      config.alphaMax,
    );

    // Add shape variation for dirt particles (squish/stretch).
    const scaleX = baseScale * Phaser.Math.FloatBetween(0.7, 1.3);
    const scaleY = baseScale * Phaser.Math.FloatBetween(0.7, 1.3);

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
      .setScale(scaleX, scaleY)
      .setDepth(this.depth)
      .setTint(this.pickColor(config.colors));
  }

  private updateParticle(
    particle: ParticleState,
    dtSeconds: number,
    depth: number,
  ): void {
    particle.vy += particle.gravity * dtSeconds;
    particle.x += particle.vx * dtSeconds;
    particle.y += particle.vy * dtSeconds;
    particle.vx *= particle.drag;
    particle.vy *= particle.drag;
    particle.life += dtSeconds;

    const t = particle.life / particle.maxLife;
    const alpha = particle.baseAlpha * (1 - t);
    const scale = particle.baseScale * (0.7 + 0.3 * (1 - t));

    particle.sprite
      .setAlpha(alpha)
      .setScale(scale)
      .setPosition(particle.x, particle.y)
      .setDepth(depth);
  }

  private deactivate(particle: ParticleState, onDeactivate: () => void): void {
    if (!particle.active) {
      return;
    }
    particle.active = false;
    particle.sprite.setActive(false).setVisible(false);
    onDeactivate();
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

  private acquire(pool: ParticleState[]): ParticleState | undefined {
    for (const particle of pool) {
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

  private pickColor(colors: number[]): number {
    const index = Math.floor(Math.random() * colors.length);
    return colors[index] ?? 0xffffff;
  }
}
