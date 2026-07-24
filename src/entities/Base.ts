import Phaser from 'phaser';
import type { Owner } from '../types/game';

export class Base extends Phaser.GameObjects.Container {
  public readonly owner: Owner;
  public readonly lineX: number;
  public readonly color: number;

  public constructor(scene: Phaser.Scene, owner: Owner, x: number, lineX: number, color: number) {
    super(scene, x, 360);
    scene.add.existing(this);
    this.owner = owner;
    this.lineX = lineX;
    this.color = color;
    this.setDepth(4);
    this.drawBase();
  }

  private drawBase(): void {
    const graphics = this.scene.add.graphics();
    const direction = this.owner === 'player' ? 1 : -1;
    graphics.fillStyle(this.color, 0.07);
    graphics.fillRect(direction === 1 ? -54 : -146, -272, 200, 544);
    graphics.lineStyle(2, this.color, 0.2);
    graphics.strokeRect(direction === 1 ? -54 : -146, -272, 200, 544);

    const localLine = this.lineX - this.x;
    graphics.lineStyle(4, this.color, 0.9);
    graphics.lineBetween(localLine, -260, localLine, 260);
    graphics.lineStyle(1, this.color, 0.35);
    for (let y = -240; y <= 240; y += 30) {
      graphics.lineBetween(localLine - direction * 11, y, localLine + direction * 11, y);
    }

    graphics.fillStyle(this.color, 0.16);
    graphics.fillCircle(0, 0, 76);
    graphics.lineStyle(2, this.color, 0.45);
    graphics.strokeCircle(0, 0, 76);
    graphics.strokeCircle(0, 0, 54);
    this.add(graphics);

    const label = this.scene.add.text(direction * 8, -300, this.owner === 'player' ? 'ВАША БАЗА' : 'БАЗА БОТА', {
      color: `#${this.color.toString(16).padStart(6, '0')}`,
      fontFamily: 'Avenir Next, sans-serif',
      fontSize: '14px',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.add(label);
  }
}
