import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    this.add.rectangle(width / 2, height / 2, width, height, 0x020617).setAlpha(0.92);
    this.add
      .text(width / 2, height / 2, 'Loading Battlefly...', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '28px',
        color: '#67e8f9',
      })
      .setOrigin(0.5);
    this.time.delayedCall(120, () => {
      this.scene.start('MainMenuScene');
    });
  }
}

