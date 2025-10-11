import Phaser from 'phaser';

import BootScene from './scenes/BootScene';
import GameScene from './scenes/GameScene';
import PreloadScene from './scenes/PreloadScene';
import UIScene from './scenes/UIScene';

const BASE_WIDTH = 720;
const BASE_HEIGHT = 540;

const GAME_CONFIG: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: BASE_WIDTH,
  height: BASE_HEIGHT,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  backgroundColor: '#10131a',
  scene: [BootScene, PreloadScene, GameScene, UIScene],
};

export default new Phaser.Game(GAME_CONFIG);
