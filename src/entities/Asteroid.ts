import Phaser from 'phaser';
import type { Point } from '../types/game';

export class Asteroid extends Phaser.GameObjects.Container {
  public readonly radius: number;
  public readonly center: Point;

  public constructor(scene: Phaser.Scene, center: Point, radius: number, seed: number) {
    super(scene, center.x, center.y);
    scene.add.existing(this);
    this.center = center;
    this.radius = radius;
    this.setDepth(8);

    const graphics = scene.add.graphics();
    const points = Array.from({ length: 9 }, (_, index) => {
      const angle = (Math.PI * 2 * index) / 9;
      const variation = 0.84 + ((seed * (index + 3)) % 17) / 100;
      return {
        x: Math.cos(angle) * radius * variation,
        y: Math.sin(angle) * radius * variation,
      };
    });
    graphics.fillStyle(0x334155, 0.95);
    graphics.lineStyle(2, 0x94a3b8, 0.48);
    graphics.fillPoints(points, true);
    graphics.strokePoints(points, true);
    graphics.fillStyle(0x64748b, 0.32);
    graphics.fillCircle(-radius * 0.25, -radius * 0.2, radius * 0.19);
    graphics.fillCircle(radius * 0.22, radius * 0.17, radius * 0.13);
    this.add(graphics);
  }
}
