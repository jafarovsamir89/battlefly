import Phaser from 'phaser';
import './styles.css';
import { FIXED_TIMESTEP_MS, MAP_HEIGHT, MAP_WIDTH } from '@battlefly/game-rules';
import { BootScene } from './scenes/BootScene.js';
import { MainMenuScene } from './scenes/MainMenuScene.js';
import { StrategyMapScene } from './scenes/StrategyMapScene.js';

const bootOverlay = document.getElementById('boot-overlay');
const bootMessage = document.getElementById('boot-message');
const errorOverlay = document.getElementById('error-overlay');
const errorMessage = document.getElementById('error-message');
const reloadButton = document.getElementById('reload-button');

const showError = (message: string): void => {
  if (errorMessage) {
    errorMessage.textContent = message;
  }
  if (errorOverlay) {
    errorOverlay.hidden = false;
  }
  if (bootOverlay) {
    bootOverlay.hidden = true;
  }
};

window.addEventListener('error', (event) => {
  showError(event.error instanceof Error ? event.error.stack ?? event.error.message : event.message);
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason instanceof Error ? event.reason.stack ?? event.reason.message : String(event.reason);
  showError(reason);
});

if (reloadButton) {
  reloadButton.addEventListener('click', () => window.location.reload());
}

if (bootMessage) {
  bootMessage.textContent = `Preparing fixed timestep at ${Math.round(FIXED_TIMESTEP_MS)}ms.`;
}

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  width: MAP_WIDTH,
  height: MAP_HEIGHT,
  backgroundColor: '#030712',
  banner: false,
  scene: [BootScene, MainMenuScene, StrategyMapScene],
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};

try {
  // eslint-disable-next-line no-new
  new Phaser.Game(config);
} catch (error) {
  showError(error instanceof Error ? error.stack ?? error.message : String(error));
}

