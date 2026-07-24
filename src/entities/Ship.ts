import Phaser from 'phaser';
import { SHIP_CONFIGS } from '../config/balance';
import type { Owner, Point, ShipClass, ShipConfig } from '../types/game';

const OWNER_COLORS: Record<Owner, number> = {
  player: 0x38bdf8,
  bot: 0xfb7185,
};

export class Ship extends Phaser.GameObjects.Container {
  public readonly owner: Owner;
  public readonly id: number;
  public readonly classType: ShipClass;
  public readonly config: ShipConfig;
  public readonly homePosition: Point;
  public shield: number;
  public hull: number;
  public energy: number;
  public actionUsed = false;
  public active = true;
  public atBase = true;
  public vulnerableTurns = 0;

  private readonly bodyGraphic: Phaser.GameObjects.Graphics;
  private readonly glow: Phaser.GameObjects.Graphics;
  private readonly shieldGraphic: Phaser.GameObjects.Graphics;
  private readonly bars: Phaser.GameObjects.Graphics;
  private selected = false;
  private available = false;

  public constructor(scene: Phaser.Scene, owner: Owner, id: number, classType: ShipClass, homePosition: Point) {
    super(scene, homePosition.x, homePosition.y);
    scene.add.existing(this);

    this.owner = owner;
    this.id = id;
    this.classType = classType;
    this.config = SHIP_CONFIGS[classType];
    this.homePosition = { ...homePosition };
    this.shield = this.config.shields;
    this.hull = this.config.hull;
    this.energy = this.config.maxEnergy;

    this.glow = scene.add.graphics();
    this.bodyGraphic = scene.add.graphics();
    this.shieldGraphic = scene.add.graphics();
    this.bars = scene.add.graphics();
    this.add([this.glow, this.shieldGraphic, this.bodyGraphic, this.bars]);
    this.setDepth(20);
    this.renderVisual();
  }

  public get color(): number {
    return OWNER_COLORS[this.owner];
  }

  public get point(): Point {
    return { x: this.x, y: this.y };
  }

  public setSelected(value: boolean): void {
    this.selected = value;
    this.renderVisual();
  }

  public setAvailable(value: boolean): void {
    if (this.available === value) return;
    this.available = value;
    this.renderVisual();
  }

  public moveToPoint(point: Point): this {
    super.setPosition(point.x, point.y);
    return this;
  }

  public resetForRound(): void {
    this.actionUsed = false;
    if (this.vulnerableTurns > 0) this.vulnerableTurns -= 1;
    this.renderVisual();
  }

  public restoreAtBase(): void {
    super.setPosition(this.homePosition.x, this.homePosition.y);
    this.energy = this.config.maxEnergy;
    this.actionUsed = true;
    this.atBase = true;
    this.setVisible(true);
    this.renderVisual();
  }

  public destroyShip(): void {
    this.active = false;
    this.actionUsed = true;
    this.setVisible(false);
    this.renderVisual();
  }

  public renderVisual(): void {
    const scale = this.classType === 'defender' ? 1.12 : this.classType === 'scout' ? 0.9 : 1;
    const color = this.color;
    const accent = this.owner === 'player' ? 0x7dd3fc : 0xfda4af;

    this.glow.clear();
    this.glow.fillStyle(color, this.selected ? 0.22 : this.available ? 0.13 : 0.08);
    this.glow.fillCircle(0, 0, (this.classType === 'defender' ? 38 : 31) * scale);

    this.bodyGraphic.clear();
    this.bodyGraphic.lineStyle(this.selected ? 3 : 1.5, accent, 0.92);
    this.bodyGraphic.fillStyle(color, this.active ? 0.9 : 0.18);
    this.bodyGraphic.setScale(scale);

    if (this.classType === 'scout') {
      this.bodyGraphic.fillTriangle(22, 0, -13, -12, -8, 0);
      this.bodyGraphic.fillTriangle(22, 0, -13, 12, -8, 0);
      this.bodyGraphic.strokeTriangle(22, 0, -13, -12, -8, 0);
      this.bodyGraphic.strokeTriangle(22, 0, -13, 12, -8, 0);
    } else if (this.classType === 'interceptor') {
      this.bodyGraphic.fillPoints([
        { x: 24, y: 0 },
        { x: 5, y: -15 },
        { x: -17, y: -10 },
        { x: -9, y: 0 },
        { x: -17, y: 10 },
        { x: 5, y: 15 },
      ], true);
      this.bodyGraphic.strokePoints([
        { x: 24, y: 0 },
        { x: 5, y: -15 },
        { x: -17, y: -10 },
        { x: -9, y: 0 },
        { x: -17, y: 10 },
        { x: 5, y: 15 },
      ], true);
    } else {
      this.bodyGraphic.fillRoundedRect(-21, -15, 42, 30, 8);
      this.bodyGraphic.strokeRoundedRect(-21, -15, 42, 30, 8);
      this.bodyGraphic.fillStyle(accent, 0.7);
      this.bodyGraphic.fillRect(-5, -19, 10, 38);
      this.bodyGraphic.fillRect(-26, -5, 52, 10);
    }

    this.bodyGraphic.fillStyle(0xffffff, 0.85);
    this.bodyGraphic.fillCircle(8, 0, this.classType === 'defender' ? 4 : 3);

    this.shieldGraphic.clear();
    if (this.active && this.shield > 0) {
      this.shieldGraphic.lineStyle(this.selected ? 3 : 2, accent, this.selected ? 0.82 : 0.48);
      this.shieldGraphic.strokeCircle(0, 0, (this.classType === 'defender' ? 31 : 25) * scale);
    }

    this.bars.clear();
    if (this.active) {
      const width = this.classType === 'defender' ? 48 : 38;
      const energyRatio = Phaser.Math.Clamp(this.energy / this.config.maxEnergy, 0, 1);
      const hullRatio = Phaser.Math.Clamp(this.hull / this.config.hull, 0, 1);
      this.bars.fillStyle(0x020617, 0.82);
      this.bars.fillRect(-width / 2, 25, width, 4);
      this.bars.fillStyle(0x22d3ee, 0.9);
      this.bars.fillRect(-width / 2, 25, width * energyRatio, 4);
      this.bars.fillStyle(0x020617, 0.82);
      this.bars.fillRect(-width / 2, 31, width, 4);
      this.bars.fillStyle(0xfda4af, 0.9);
      this.bars.fillRect(-width / 2, 31, width * hullRatio, 4);
    }

    this.alpha = this.active ? 1 : 0.18;
  }
}
