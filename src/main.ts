import Phaser from 'phaser';

import BootScene from './scenes/BootScene';
import GameScene from './scenes/GameScene';
import PreloadScene from './scenes/PreloadScene';
import UIScene from './scenes/UIScene';

const GAME_CONFIG: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  input: {
    touch: true,
    mouse: true,
  },
  backgroundColor: '#10131a',
  scene: [BootScene, PreloadScene, GameScene, UIScene],
};

export default new Phaser.Game(GAME_CONFIG);
