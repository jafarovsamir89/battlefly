import Phaser from 'phaser';
import type { Owner, Point } from '../types/game';
import { distance } from '../utils/math';
import type { Ship } from './Ship';

export class Reactor extends Phaser.GameObjects.Container {
  public readonly center: Point;
  public readonly radius = 70;
  public controller: Owner | null = null;

  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;

  public constructor(scene: Phaser.Scene, center: Point) {
    super(scene, center.x, center.y);
    scene.add.existing(this);
    this.center = center;
    this.setDepth(6);
    this.graphics = scene.add.graphics();
    this.add(this.graphics);
    this.label = scene.add.text(0, 88, 'РЕАКТОР', {
      color: '#a5f3fc',
      fontFamily: 'Avenir Next, sans-serif',
      fontSize: '12px',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.add(this.label);
    this.render();
  }

  public updateControl(ships: Ship[]): Owner | null {
    const nearby = ships.filter((ship) => ship.active && distance(ship.point, this.center) < this.radius);
    const playerPresent = nearby.some((ship) => ship.owner === 'player');
    const botPresent = nearby.some((ship) => ship.owner === 'bot');
    this.controller = playerPresent === botPresent ? null : playerPresent ? 'player' : 'bot';
    this.render();
    return this.controller;
  }

  private render(): void {
    const color = this.controller === 'player' ? 0x38bdf8 : this.controller === 'bot' ? 0xfb7185 : 0x67e8f9;
    this.graphics.clear();
    this.graphics.fillStyle(color, 0.06);
    this.graphics.fillCircle(0, 0, this.radius);
    this.graphics.lineStyle(2, color, 0.5);
    this.graphics.strokeCircle(0, 0, this.radius);
    this.graphics.lineStyle(2, color, 0.3);
    this.graphics.strokeCircle(0, 0, this.radius - 15);
    this.graphics.lineStyle(1, color, 0.24);
    this.graphics.lineBetween(-this.radius, 0, this.radius, 0);
    this.graphics.lineBetween(0, -this.radius, 0, this.radius);
    this.graphics.fillStyle(color, 0.8);
    this.graphics.fillCircle(0, 0, 14);
    this.graphics.fillStyle(0xffffff, 0.85);
    this.graphics.fillCircle(0, 0, 4);
    this.label.setColor(`#${color.toString(16).padStart(6, '0')}`);
  }
}
