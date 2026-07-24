import Phaser from 'phaser';

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super('MainMenuScene');
  }

  create(): void {
    const bootOverlay = document.getElementById('boot-overlay');
    if (bootOverlay) {
      bootOverlay.hidden = true;
    }
    const width = this.scale.width;
    const height = this.scale.height;
    this.add.rectangle(width / 2, height / 2, width, height, 0x020617).setAlpha(0.9);
    this.add
      .text(width / 2, height / 2 - 80, 'Battlefly', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '56px',
        fontStyle: '700',
        color: '#f8fafc',
      })
      .setOrigin(0.5);
    this.add
      .text(width / 2, height / 2 - 18, 'Vector Fleet: Network War', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '24px',
        color: '#7dd3fc',
      })
      .setOrigin(0.5);
    const startButton = this.add
      .text(width / 2, height / 2 + 68, 'Enter tactical map', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '18px',
        color: '#e0f2fe',
        backgroundColor: '#0f172a',
        padding: { x: 16, y: 12 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    startButton.on('pointerdown', () => {
      this.scene.start('StrategyMapScene');
    });
  }
}
