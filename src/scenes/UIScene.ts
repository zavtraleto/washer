import Phaser from 'phaser';

const TOP_PADDING = 24;
const BAR_PADDING = 12;
const BAR_HEIGHT = 8;
const BAR_WIDTH_RATIO = 0.6;
const TEXT_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'Inter, Arial, sans-serif',
  fontSize: '18px',
  color: '#f2f3f5',
};

export default class UIScene extends Phaser.Scene {
  private target = 0; // Latest clean percent from game.
  private value = 0; // Lerped UI value.
  private text!: Phaser.GameObjects.Text;
  private bar!: Phaser.GameObjects.Graphics;
  private barWidth = 0;
  private readonly handleResize = () => this.layout(); // Keep UI centered on resize.

  constructor() {
    super('UIScene');
  }

  create(): void {
    this.text = this.add
      .text(this.scale.width * 0.5, TOP_PADDING, 'Clean: 0.0%', TEXT_STYLE)
      .setOrigin(0.5, 0);
    this.bar = this.add.graphics();
    this.layout();
    this.drawBar();
    this.game.events.on('PROGRESS', this.handleProgress, this); // Listen for clean percent updates.
    this.scale.on('resize', this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);
  }

  public override update(): void {
    this.value += (this.target - this.value) * 0.2; // Smooth progress fill.
    this.text.setText(`Clean: ${this.value.toFixed(1)}%`);
    this.drawBar();
  }

  private handleProgress(percent: number): void {
    this.target = Phaser.Math.Clamp(percent, 0, 100);
  }

  private layout(): void {
    const width = this.scale.width;
    this.text.setX(width * 0.5);
    this.barWidth = width * BAR_WIDTH_RATIO;
    const barX = (width - this.barWidth) * 0.5;
    const barY = this.text.y + this.text.height + BAR_PADDING;
    this.bar.setPosition(barX, barY);
  }

  private drawBar(): void {
    this.bar.clear();
    this.bar.fillStyle(0x1e1f24, 0.65);
    this.bar.fillRoundedRect(0, 0, this.barWidth, BAR_HEIGHT, 4);
    const fillWidth = this.barWidth * Phaser.Math.Clamp(this.value / 100, 0, 1);
    this.bar.fillStyle(0x61d5ff, 0.9);
    this.bar.fillRoundedRect(0, 0, fillWidth, BAR_HEIGHT, 4);
  }

  private onShutdown(): void {
    this.game.events.off('PROGRESS', this.handleProgress, this);
    this.scale.off('resize', this.handleResize, this);
  }
}
