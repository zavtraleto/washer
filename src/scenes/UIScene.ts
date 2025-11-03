import Phaser from 'phaser';
import { MathUtils } from '../utils/MathUtils';
import { eventBus } from '../services/EventBus';
import { GameEvents } from '../types/events';

const TOP_PADDING = 24;
const BAR_PADDING = 12;
const BAR_HEIGHT = 8;
const BAR_WIDTH_RATIO = 0.6;
const TOOL_BUTTON_SIZE = 48;
const TOOL_BUTTON_SPACING = 8;
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
  private toolButtons!: {
    scrubber: Phaser.GameObjects.Container;
    powerwash: Phaser.GameObjects.Container;
  };
  private activeTool: 'scrubber' | 'powerwash' = 'scrubber';
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
    this.createToolButtons();
    this.layout(); // Call layout after creating all UI elements.
    this.drawBar();
    eventBus.on(GameEvents.PROGRESS, this.handleProgress, this); // Listen for clean percent updates.
    eventBus.on(GameEvents.WIN, this.handleWin, this); // Reveal Next button on win.
    eventBus.on(GameEvents.RESTART, this.handleReset, this);
    eventBus.on(GameEvents.NEXT, this.handleReset, this);
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
    if (this.toolButtons) {
      // Position tool buttons side-by-side at bottom-left corner.
      const bottomY = this.scale.height - 16 - TOOL_BUTTON_SIZE;
      this.toolButtons.scrubber.setPosition(16, bottomY);
      this.toolButtons.powerwash.setPosition(
        16 + TOOL_BUTTON_SIZE + TOOL_BUTTON_SPACING,
        bottomY,
      );
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
      eventBus.emit(GameEvents.RESTART); // what: restart requested by player.
    });

    this.btnNext = this.add
      .text(width - 16, TOP_PADDING + 24, 'Next', buttonStyle)
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true })
      .setVisible(false);
    this.btnNext.on('pointerup', () => {
      eventBus.emit(GameEvents.NEXT); // what: advance to new seed.
    });
  }

  private handleWin(): void {
    this.btnNext.setVisible(true); // why: show Next once win condition met.
  }

  private handleReset(): void {
    this.btnNext.setVisible(false); // why: hide Next until next win.
    this.target = 0;
  }

  private createToolButtons(): void {
    // Create tool button helper.
    const createToolButton = (
      toolId: 'scrubber' | 'powerwash',
      icon: string,
    ): Phaser.GameObjects.Container => {
      const container = this.add.container(0, 0);

      // Background (square button) - use Rectangle instead of Graphics for better hit detection.
      const bg = this.add.rectangle(
        TOOL_BUTTON_SIZE / 2,
        TOOL_BUTTON_SIZE / 2,
        TOOL_BUTTON_SIZE,
        TOOL_BUTTON_SIZE,
        0x2a2d35,
        0.9,
      );
      bg.setStrokeStyle(2, 0x61d5ff, 0);

      // Icon/Label.
      const text = this.add
        .text(TOOL_BUTTON_SIZE / 2, TOOL_BUTTON_SIZE / 2, icon, {
          fontFamily: 'Inter, Arial, sans-serif',
          fontSize: '20px',
          color: '#f2f3f5',
        })
        .setOrigin(0.5);

      container.add([bg, text]);
      container.setSize(TOOL_BUTTON_SIZE, TOOL_BUTTON_SIZE);

      // Make the background rectangle interactive.
      bg.setInteractive({ useHandCursor: true });

      // Store references for visual updates.
      (container as any).bg = bg;
      (container as any).toolId = toolId;

      // Wire up events to the background rectangle.
      bg.on('pointerdown', () => {
        this.switchTool(toolId);
      });

      // Hover effect.
      bg.on('pointerover', () => {
        if (this.activeTool !== toolId) {
          bg.setFillStyle(0x35383f, 0.9);
        }
      });

      bg.on('pointerout', () => {
        this.updateToolButtonVisuals();
      });

      return container;
    };

    // Create buttons for both tools.
    this.toolButtons = {
      scrubber: createToolButton('scrubber', '🧽'),
      powerwash: createToolButton('powerwash', '💧'),
    };

    this.updateToolButtonVisuals();
  }

  private switchTool(toolId: 'scrubber' | 'powerwash'): void {
    if (this.activeTool === toolId) return; // Already active.

    this.activeTool = toolId;
    this.updateToolButtonVisuals();

    // Emit event to GameScene to switch tool.
    eventBus.emit(GameEvents.SWITCH_TOOL, toolId);
  }

  private updateToolButtonVisuals(): void {
    // Update button backgrounds to show active/inactive state.
    for (const [toolId, container] of Object.entries(this.toolButtons)) {
      const bg = (container as any).bg as Phaser.GameObjects.Rectangle;

      if (this.activeTool === toolId) {
        // Active: bright background with border.
        bg.setFillStyle(0x61d5ff, 0.25);
        bg.setStrokeStyle(2, 0x61d5ff, 1);
      } else {
        // Inactive: dark background, no border.
        bg.setFillStyle(0x2a2d35, 0.9);
        bg.setStrokeStyle(2, 0x61d5ff, 0);
      }
    }
  }

  private onShutdown(): void {
    eventBus.off(GameEvents.PROGRESS, this.handleProgress);
    eventBus.off(GameEvents.WIN, this.handleWin);
    eventBus.off(GameEvents.RESTART, this.handleReset);
    eventBus.off(GameEvents.NEXT, this.handleReset);
    this.scale.off('resize', this.handleResize, this);
  }
}
