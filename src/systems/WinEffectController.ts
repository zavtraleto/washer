import Phaser from 'phaser';

// Handles the win state visual effect: white flash tint on mesh with smooth fade-out.
export class WinEffectController {
  constructor(
    private scene: Phaser.Scene,
    private mesh: Phaser.GameObjects.Mesh,
    private duration: number,
    private color: number,
  ) {}

  // what: play white flash effect and invoke callback when complete.
  play(onComplete: () => void): void {
    // Apply full white tint instantly.
    this.mesh.setTint(this.color);

    // Fade tint back to normal over duration.
    this.scene.tweens.add({
      targets: this.mesh,
      duration: this.duration,
      ease: 'Cubic.Out',
      onComplete: () => {
        this.mesh.clearTint(); // Remove tint to restore original texture.
        onComplete();
      },
    });
  }
}
