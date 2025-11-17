import Phaser from 'phaser';
import { MathUtils } from '../utils/MathUtils';
import { GameEvents } from '../types/events';

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
  private btnRestart!: Phaser.GameObjects.Text;
  private btnNext!: Phaser.GameObjects.Text;
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
    this.createButtons();
    this.layout(); // Call layout after creating all UI elements.
    this.drawBar();
    this.game.events.on(GameEvents.PROGRESS, this.handleProgress, this); // Listen for clean percent updates.
    this.game.events.on(GameEvents.WIN, this.handleWin, this); // Reveal Next button on win.
    this.game.events.on(GameEvents.RESTART, this.handleReset, this);
    this.game.events.on(GameEvents.NEXT, this.handleReset, this);
    this.scale.on('resize', this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);
  }

  public override update(): void {
    this.value += (this.target - this.value) * 0.2; // Smooth progress fill.
    this.text.setText(`Clean: ${this.value.toFixed(1)}%`);
    this.drawBar();
  }

  private handleProgress(percent: number): void {
    this.target = MathUtils.clamp(percent, 0, 100);
  }

  private layout(): void {
    const width = this.scale.width;
    this.text.setX(width * 0.5);
    this.barWidth = width * BAR_WIDTH_RATIO;
    const barX = (width - this.barWidth) * 0.5;
    const barY = this.text.y + this.text.height + BAR_PADDING;
    this.bar.setPosition(barX, barY);
    if (this.btnRestart) {
      this.btnRestart.setPosition(width - 16, TOP_PADDING);
    }
    if (this.btnNext) {
      this.btnNext.setPosition(width - 16, TOP_PADDING + 24);
    }
  }

  private drawBar(): void {
    this.bar.clear();
    this.bar.fillStyle(0x1e1f24, 0.65);
    this.bar.fillRoundedRect(0, 0, this.barWidth, BAR_HEIGHT, 4);
    const fillWidth = this.barWidth * MathUtils.clamp(this.value / 100, 0, 1);
    this.bar.fillStyle(0x61d5ff, 0.9);
    this.bar.fillRoundedRect(0, 0, fillWidth, BAR_HEIGHT, 4);
  }

  private createButtons(): void {
    const buttonStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: 'Inter, Arial, sans-serif',
      fontSize: '14px',
      color: '#ffffff',
    };
    const width = this.scale.width;
    this.btnRestart = this.add
      .text(width - 16, TOP_PADDING, 'Restart', buttonStyle)
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true });
    this.btnRestart.on('pointerup', () => {
      this.game.events.emit(GameEvents.RESTART); // what: restart requested by player.
    });

    this.btnNext = this.add
      .text(width - 16, TOP_PADDING + 24, 'Next', buttonStyle)
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true })
      .setVisible(false);
    this.btnNext.on('pointerup', () => {
      this.game.events.emit(GameEvents.NEXT); // what: advance to new seed.
    });
  }

  private handleWin(): void {
    this.btnNext.setVisible(true); // why: show Next once win condition met.
  }

  private handleReset(): void {
    this.btnNext.setVisible(false); // why: hide Next until next win.
    this.target = 0;
  }

  private onShutdown(): void {
    this.game.events.off(GameEvents.PROGRESS, this.handleProgress, this);
    this.game.events.off(GameEvents.WIN, this.handleWin, this);
    this.game.events.off(GameEvents.RESTART, this.handleReset, this);
    this.game.events.off(GameEvents.NEXT, this.handleReset, this);
    this.scale.off('resize', this.handleResize, this);
  }
}
