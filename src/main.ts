import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { GameScene } from './scenes/GameScene';
import { UIScene } from './scenes/UIScene';
import { GAME_CONFIG } from './types/constants';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.WEBGL,
  title: 'Washer',
  version: '1.0',
  autoFocus: true,
  input: {
    keyboard: true,
    mouse: true,
    touch: true,
    gamepad: false,
  },
  disableContextMenu: false,
  transparent: false,
  banner: false,
  dom: {
    createContainer: false,
  },
  parent: document.body,
  width: GAME_CONFIG.WIDTH,
  height: GAME_CONFIG.HEIGHT,
  pixelArt: false,
  roundPixels: false,
  antialias: true,
  antialiasGL: true,
  backgroundColor: '#2d2d2d',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_CONFIG.WIDTH,
    height: GAME_CONFIG.HEIGHT,
    min: {
      width: 320,
      height: 180,
    },
    max: {
      width: GAME_CONFIG.WIDTH * 2,
      height: GAME_CONFIG.HEIGHT * 2,
    },
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  scene: [BootScene, PreloadScene, GameScene, UIScene],
};

export const game = new Phaser.Game(config);
