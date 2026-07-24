import Phaser from 'phaser';
import type { Point } from '../types/game';
import type { Ship } from '../entities/Ship';

export class EffectsSystem {
  private readonly scene: Phaser.Scene;

  public constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  public engineTrail(point: Point, color: number): void {
    const mote = this.scene.add.circle(point.x, point.y, Phaser.Math.Between(2, 5), color, 0.45).setDepth(9);
    this.scene.tweens.add({
      targets: mote,
      alpha: 0,
      scale: 0.15,
      duration: 430,
      onComplete: () => mote.destroy(),
    });
  }

  public launch(point: Point, direction: Point, color: number): void {
    const ring = this.scene.add.circle(point.x, point.y, 10).setStrokeStyle(3, color, 0.9).setDepth(18);
    this.scene.tweens.add({
      targets: ring,
      x: point.x + direction.x * 24,
      y: point.y + direction.y * 24,
      radius: 32,
      alpha: 0,
      duration: 260,
      onComplete: () => ring.destroy(),
    });
  }

  public impact(point: Point, color: number): void {
    for (let index = 0; index < 10; index += 1) {
      const particle = this.scene.add.circle(point.x, point.y, Phaser.Math.Between(2, 4), color, 0.8).setDepth(18);
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const distance = Phaser.Math.Between(22, 58);
      this.scene.tweens.add({
        targets: particle,
        x: point.x + Math.cos(angle) * distance,
        y: point.y + Math.sin(angle) * distance,
        alpha: 0,
        duration: 320,
        onComplete: () => particle.destroy(),
      });
    }
  }

  public shieldBreak(point: Point, color: number): void {
    const ring = this.scene.add.circle(point.x, point.y, 22).setStrokeStyle(4, 0xffffff, 0.95).setDepth(19);
    this.scene.tweens.add({
      targets: ring,
      radius: 58,
      alpha: 0,
      duration: 430,
      ease: 'Quad.easeOut',
      onComplete: () => ring.destroy(),
    });
    this.impact(point, color);
  }

  public explosion(point: Point, color: number): void {
    for (let index = 0; index < 26; index += 1) {
      const particle = this.scene.add.circle(point.x, point.y, Phaser.Math.Between(2, 6), index % 4 === 0 ? 0xffffff : color, 0.9).setDepth(22);
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const distance = Phaser.Math.Between(45, 150);
      this.scene.tweens.add({
        targets: particle,
        x: point.x + Math.cos(angle) * distance,
        y: point.y + Math.sin(angle) * distance,
        alpha: 0,
        scale: 0,
        duration: Phaser.Math.Between(420, 780),
        ease: 'Cubic.easeOut',
        onComplete: () => particle.destroy(),
      });
    }
    const ring = this.scene.add.circle(point.x, point.y, 14).setStrokeStyle(6, color, 0.95).setDepth(21);
    this.scene.tweens.add({
      targets: ring,
      radius: 98,
      alpha: 0,
      duration: 520,
      ease: 'Quad.easeOut',
      onComplete: () => ring.destroy(),
    });
  }

  public async hyperjump(ship: Ship, destination: Point, color: number): Promise<void> {
    const origin = { x: ship.x, y: ship.y };
    for (let index = 0; index < 3; index += 1) {
      const ring = this.scene.add.circle(origin.x, origin.y, 22 + index * 9).setStrokeStyle(2, color, 0.7).setDepth(19);
      this.scene.tweens.add({
        targets: ring,
        scale: 1.8,
        alpha: 0,
        delay: index * 45,
        duration: 330,
        onComplete: () => ring.destroy(),
      });
    }

    await new Promise<void>((resolve) => {
      this.scene.tweens.add({
        targets: ship,
        scaleX: 0.08,
        scaleY: 0.08,
        alpha: 0,
        duration: 230,
        ease: 'Quad.easeIn',
        onComplete: () => {
          ship.moveToPoint(destination);
          ship.setVisible(true);
          this.scene.tweens.add({
            targets: ship,
            scaleX: 1,
            scaleY: 1,
            alpha: 1,
            duration: 260,
            ease: 'Back.easeOut',
            onComplete: () => resolve(),
          });
        },
      });
    });
  }

  public floatingText(point: Point, message: string, color = '#ffffff'): void {
    const text = this.scene.add.text(point.x, point.y - 32, message, {
      color,
      fontFamily: 'Avenir Next, sans-serif',
      fontSize: '18px',
      fontStyle: 'bold',
      stroke: '#020617',
      strokeThickness: 5,
    }).setOrigin(0.5).setDepth(40);
    this.scene.tweens.add({
      targets: text,
      y: point.y - 78,
      alpha: 0,
      duration: 900,
      onComplete: () => text.destroy(),
    });
  }

  public flashMessage(message: string, color: string): void {
    const text = this.scene.add.text(640, 360, message, {
      color,
      fontFamily: 'Avenir Next, sans-serif',
      fontSize: '38px',
      fontStyle: 'bold',
      stroke: '#020617',
      strokeThickness: 8,
    }).setOrigin(0.5).setDepth(50).setScale(0.7).setAlpha(0);
    this.scene.tweens.add({
      targets: text,
      alpha: 1,
      scale: 1,
      yoyo: true,
      hold: 240,
      duration: 170,
      onComplete: () => text.destroy(),
    });
  }
}
