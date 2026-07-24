import Phaser from 'phaser';
import './styles.css';
import { GAME_HEIGHT, GAME_WIDTH } from './config/balance';
import { BattleScene } from './scenes/BattleScene';
import { BootScene } from './scenes/BootScene';

const bootStatus = document.getElementById('boot-status');
const bootMessage = document.getElementById('boot-message');

window.addEventListener('error', (event) => {
  if (bootStatus && bootStatus.style.display !== 'none') {
    if (bootMessage) bootMessage.textContent = `Ошибка запуска: ${event.message || 'неизвестная ошибка'}`;
  }
});

window.addEventListener('unhandledrejection', (event) => {
  if (bootStatus && bootStatus.style.display !== 'none') {
    if (bootMessage) bootMessage.textContent = `Ошибка запуска: ${String(event.reason ?? 'неизвестная ошибка')}`;
  }
});

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#050913',
  render: {
    antialias: true,
    pixelArt: false,
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  },
  scene: [BootScene, BattleScene],
};

try {
  new Phaser.Game(config);
} catch (error) {
  if (bootMessage) bootMessage.textContent = `Игра не запустилась: ${error instanceof Error ? error.message : String(error)}`;
}
