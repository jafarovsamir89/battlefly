import Phaser from 'phaser';
import {
  ARENA,
  BASES,
  FLEET_LAYOUT,
  GAME_BALANCE,
  GAME_HEIGHT,
  GAME_WIDTH,
} from '../config/balance';
import { Asteroid } from '../entities/Asteroid';
import { Base } from '../entities/Base';
import { Reactor } from '../entities/Reactor';
import { Ship } from '../entities/Ship';
import { AudioSystem } from '../systems/AudioSystem';
import { BotSystem } from '../systems/BotSystem';
import { CombatSystem } from '../systems/CombatSystem';
import { EffectsSystem } from '../systems/EffectsSystem';
import { EnergySystem } from '../systems/EnergySystem';
import { RouteSystem } from '../systems/RouteSystem';
import { ScoreSystem } from '../systems/ScoreSystem';
import { HUD } from '../ui/HUD';
import { GameState, type MovementPlan, type Owner, type Point, type RouteAction } from '../types/game';
import { add, clamp, distance, normalize, scale, segmentCircleEntry } from '../utils/math';

interface PathHit {
  end: Point;
  target: Ship | null;
  breach: boolean;
  asteroidHit: boolean;
}

interface Gate {
  owner: Owner;
  lineX: number;
  y: number;
  open: boolean;
}

export class BattleScene extends Phaser.Scene {
  private state = GameState.PLAYER_SELECTING;
  private round = 1;
  private selected: Ship | null = null;
  private aimPoint: Point | null = null;
  private trajectoryGraphics: Phaser.GameObjects.Graphics | null = null;
  private actionToken = 0;
  private routeAction: RouteAction = 'create';
  private readonly gates: Gate[] = [];
  private gateGraphics!: Phaser.GameObjects.Graphics;

  private readonly playerShips: Ship[] = [];
  private readonly botShips: Ship[] = [];
  private readonly asteroids: Asteroid[] = [];
  private readonly allShips: Ship[] = [];
  private reactor!: Reactor;
  private routeSystem!: RouteSystem;
  private energySystem!: EnergySystem;
  private scoreSystem!: ScoreSystem;
  private combatSystem!: CombatSystem;
  private botSystem!: BotSystem;
  private effects!: EffectsSystem;
  private audio!: AudioSystem;
  private hud!: HUD;

  public constructor() {
    super('BattleScene');
  }

  public create(): void {
    this.cameras.main.setBackgroundColor('#050913');
    this.createBackground();
    this.createArena();

    this.routeSystem = new RouteSystem(this);
    this.energySystem = new EnergySystem();
    this.scoreSystem = new ScoreSystem();
    this.combatSystem = new CombatSystem();
    this.botSystem = new BotSystem();
    this.effects = new EffectsSystem(this);
    this.audio = new AudioSystem();
    this.hud = new HUD();
    this.createFleets();
    this.setupInput();

    this.hud.onNewGame = () => this.scene.restart();
    this.hud.onSoundToggle = () => this.audio.toggle();
    this.hud.onRouteAction = (action) => {
      this.routeAction = action;
      this.hud.setRouteAction(action);
      this.hud.setHint(this.routeActionHint(action));
    };
    this.hud.hideResult();
    this.hud.setRouteAction(this.routeAction);
    this.hud.setHint('Выберите корабль, затем потяните в обратную сторону');
    this.setState(GameState.PLAYER_SELECTING);
    this.refreshHud();
    this.hideBootStatus();
  }

  private createBackground(): void {
    const background = this.add.graphics().setDepth(-5);
    background.fillGradientStyle(0x071426, 0x071426, 0x030712, 0x030712, 1);
    background.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    background.fillStyle(0x0ea5e9, 0.055);
    background.fillEllipse(240, 240, 520, 290);
    background.fillStyle(0xfb7185, 0.045);
    background.fillEllipse(1060, 500, 560, 320);

    const starLayer = this.add.container(0, 0).setDepth(-4);
    for (let index = 0; index < 130; index += 1) {
      const star = this.add.circle(
        Phaser.Math.Between(0, GAME_WIDTH),
        Phaser.Math.Between(0, GAME_HEIGHT),
        Phaser.Math.FloatBetween(0.5, 1.8),
        0xffffff,
        Phaser.Math.FloatBetween(0.22, 0.75),
      );
      starLayer.add(star);
      this.tweens.add({
        targets: star,
        alpha: Phaser.Math.FloatBetween(0.12, 0.8),
        duration: Phaser.Math.Between(1800, 3600),
        yoyo: true,
        repeat: -1,
        delay: index * 13,
      });
    }
  }

  private createArena(): void {
    const arena = this.add.graphics().setDepth(1);
    arena.fillStyle(0x0b1220, 0.72);
    arena.fillRoundedRect(28, 62, GAME_WIDTH - 56, GAME_HEIGHT - 92, 26);
    arena.lineStyle(2, 0x67e8f9, 0.16);
    arena.strokeRoundedRect(28, 62, GAME_WIDTH - 56, GAME_HEIGHT - 92, 26);
    arena.lineStyle(1, 0x94a3b8, 0.07);
    for (let x = ARENA.left + 20; x < ARENA.right; x += 64) {
      arena.lineBetween(x, ARENA.top, x, ARENA.bottom);
    }
    for (let y = ARENA.top + 20; y < ARENA.bottom; y += 54) {
      arena.lineBetween(ARENA.left, y, ARENA.right, y);
    }

    new Base(this, 'player', BASES.player.x, BASES.player.lineX, BASES.player.color);
    new Base(this, 'bot', BASES.bot.x, BASES.bot.lineX, BASES.bot.color);

    const lines = this.add.graphics().setDepth(3);
    lines.lineStyle(2, BASES.player.color, 0.34);
    lines.lineBetween(BASES.player.lineX, 92, BASES.player.lineX, 650);
    lines.lineStyle(2, BASES.bot.color, 0.34);
    lines.lineBetween(BASES.bot.lineX, 92, BASES.bot.lineX, 650);
    this.gateGraphics = this.add.graphics().setDepth(4);
    BASES.player.gateYs.forEach((y) => this.gates.push({ owner: 'player', lineX: BASES.player.lineX, y, open: false }));
    BASES.bot.gateYs.forEach((y) => this.gates.push({ owner: 'bot', lineX: BASES.bot.lineX, y, open: false }));
    this.drawGates();

    const asteroidData = [
      { x: 355, y: 224, radius: 34 },
      { x: 465, y: 490, radius: 48 },
      { x: 636, y: 222, radius: 32 },
      { x: 650, y: 510, radius: 42 },
      { x: 814, y: 330, radius: 52 },
      { x: 952, y: 518, radius: 31 },
    ];
    asteroidData.forEach((data, index) => this.asteroids.push(new Asteroid(this, data, data.radius, index + 5)));
    this.reactor = new Reactor(this, { x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2 + 14 });
  }

  private createFleets(): void {
    const lanes = [238, 360, 482];
    FLEET_LAYOUT.forEach((classType, index) => {
      const player = new Ship(this, 'player', index, classType, { x: 126, y: lanes[index] });
      const bot = new Ship(this, 'bot', index, classType, { x: GAME_WIDTH - 126, y: lanes[index] });
      bot.rotation = Math.PI;
      this.playerShips.push(player);
      this.botShips.push(bot);
      this.allShips.push(player, bot);
    });
  }

  private setupInput(): void {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.state !== GameState.PLAYER_SELECTING) return;
      const hit = this.playerShips.find((ship) => ship.active && !ship.actionUsed && distance(ship.point, pointer) < 36);
      if (!hit) return;
      this.selected = hit;
      this.aimPoint = { x: pointer.worldX, y: pointer.worldY };
      this.selected.setSelected(true);
      this.trajectoryGraphics = this.add.graphics().setDepth(30);
      this.audio.play('select');
      this.setState(GameState.PLAYER_AIMING);
      this.hud.setHint('Потяните от корабля в сторону, противоположную рывку');
      this.drawAim();
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.state !== GameState.PLAYER_AIMING || !this.aimPoint) return;
      this.aimPoint = { x: pointer.worldX, y: pointer.worldY };
      this.drawAim();
    });

    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (this.state !== GameState.PLAYER_AIMING || !this.selected) return;
      this.aimPoint = { x: pointer.worldX, y: pointer.worldY };
      const plan = this.buildPlanFromPointer(this.selected, this.aimPoint);
      if (!plan || plan.distance < GAME_BALANCE.minMovementDistance || plan.cost > this.selected.energy) {
        this.cancelAim();
        return;
      }
      const unit = this.selected;
      this.cancelAim();
      void this.executeAction(unit, plan, 'player');
    });
  }

  private buildPlanFromPointer(ship: Ship, pointer: Point): MovementPlan | null {
    const pull = { x: ship.x - pointer.x, y: ship.y - pointer.y };
    const pullDistance = Math.hypot(pull.x, pull.y);
    if (pullDistance < GAME_BALANCE.minAimDistance) return null;
    return this.buildPlan(ship, normalize(pull), Math.min(pullDistance, ship.config.maxDistance), this.routeAction);
  }

  private buildPlanToTarget(ship: Ship, target: Point, routeAction: RouteAction = 'create'): MovementPlan | null {
    const vector = { x: target.x - ship.x, y: target.y - ship.y };
    const targetDistance = Math.hypot(vector.x, vector.y);
    if (targetDistance < 1) return null;
    const maxDistance = Math.min(ship.config.maxDistance, this.energySystem.getMaxDistance(ship));
    return this.buildPlan(ship, normalize(vector), Math.min(targetDistance, maxDistance), routeAction);
  }

  private buildPlan(ship: Ship, direction: Point, requestedDistance: number, routeAction: RouteAction): MovementPlan | null {
    const energyDistance = this.energySystem.getMaxDistance(ship);
    const baseDistance = Math.min(requestedDistance, energyDistance, ship.config.maxDistance);
    if (baseDistance < GAME_BALANCE.minMovementDistance) return null;

    const start = ship.point;
    let end = this.clampToArena(add(start, scale(direction, baseDistance)));
    const initialRoute = this.routeSystem.crossesRoute(start, end, ship.owner);
    const boostedByRoute = initialRoute?.owner === ship.owner;
    if (boostedByRoute) {
      end = this.clampToArena(add(start, scale(direction, Math.min(ship.config.maxDistance, baseDistance * GAME_BALANCE.routeBoost))));
    }

    const route = routeAction === 'extend'
      ? this.routeSystem.findOwnRoute(start, end, ship.owner)
      : routeAction === 'cut'
        ? this.routeSystem.getEnemyCrossing(start, end, ship.owner)
        : null;
    if ((routeAction === 'extend' || routeAction === 'cut') && !route) return null;

    const hit = this.tracePath(ship, start, end);
    const finalDistance = distance(start, hit.end);
    const cost = this.energySystem.getCost(finalDistance, ship.config.maxDistance);
    if (finalDistance < GAME_BALANCE.minMovementDistance || cost > ship.energy) return null;

    return {
      start,
      end: hit.end,
      direction,
      distance: finalDistance,
      cost,
      routeAction,
      route,
      breach: hit.breach,
      asteroidHit: hit.asteroidHit,
      target: hit.target,
      boostedByRoute,
      crossedEnemyRoute: routeAction !== 'cut' && this.routeSystem.getEnemyCrossing(start, hit.end, ship.owner) !== null,
    };
  }

  private tracePath(ship: Ship, start: Point, desiredEnd: Point): PathHit {
    let firstT = 1;
    let target: Ship | null = null;
    let asteroidHit = false;
    let breach = false;
    const enemies = ship.owner === 'player' ? this.botShips : this.playerShips;

    enemies.filter((enemy) => enemy.active).forEach((enemy) => {
      const entry = segmentCircleEntry(start, desiredEnd, enemy.point, GAME_BALANCE.collisionRadius);
      if (entry !== null && entry < firstT) {
        firstT = entry;
        target = enemy;
        asteroidHit = false;
        breach = false;
      }
    });

    this.asteroids.forEach((asteroid) => {
      const entry = segmentCircleEntry(start, desiredEnd, asteroid.center, asteroid.radius + GAME_BALANCE.asteroidPadding);
      if (entry !== null && entry < firstT) {
        firstT = entry;
        target = null;
        asteroidHit = true;
        breach = false;
      }
    });

    const baseLine = ship.owner === 'player' ? BASES.bot.lineX : BASES.player.lineX;
    const deltaX = desiredEnd.x - start.x;
    if (Math.abs(deltaX) > 0.001) {
      const baseT = (baseLine - start.x) / deltaX;
      const movingTowardBase = ship.owner === 'player' ? deltaX > 0 : deltaX < 0;
      if (movingTowardBase && baseT >= 0 && baseT <= firstT) {
        const crossingY = Phaser.Math.Linear(start.y, desiredEnd.y, baseT);
        const targetOwner: Owner = ship.owner === 'player' ? 'bot' : 'player';
        firstT = baseT;
        target = null;
        asteroidHit = false;
        breach = this.isGateOpen(targetOwner, crossingY);
      }
    }

    return {
      end: {
        x: Phaser.Math.Linear(start.x, desiredEnd.x, firstT),
        y: Phaser.Math.Linear(start.y, desiredEnd.y, firstT),
      },
      target,
      breach,
      asteroidHit,
    };
  }

  private drawAim(): void {
    if (!this.trajectoryGraphics || !this.selected || !this.aimPoint) return;
    const plan = this.buildPlanFromPointer(this.selected, this.aimPoint);
    this.trajectoryGraphics.clear();
    if (!plan) {
      this.hud.setHint('Слишком короткий рывок или недостаточно энергии');
      return;
    }

    const color = plan.routeAction === 'cut' ? 0xfbbf24 : plan.cost > this.selected.energy ? 0xfbbf24 : 0x67e8f9;
    this.trajectoryGraphics.lineStyle(4, color, 0.84);
    this.trajectoryGraphics.lineBetween(plan.start.x, plan.start.y, plan.end.x, plan.end.y);
    this.trajectoryGraphics.lineStyle(1, 0xffffff, 0.18);
    this.trajectoryGraphics.lineBetween(plan.start.x, plan.start.y, this.aimPoint.x, this.aimPoint.y);
    this.trajectoryGraphics.fillStyle(color, 0.92);
    this.trajectoryGraphics.fillCircle(plan.end.x, plan.end.y, plan.breach || plan.target ? 10 : 7);
    this.trajectoryGraphics.lineStyle(2, 0xffffff, 0.36);
    this.trajectoryGraphics.strokeCircle(plan.end.x, plan.end.y, 18);
    this.hud.setAim(plan.distance, plan.cost, this.energySystem.getMaxDistance(this.selected), plan.boostedByRoute);
    this.hud.setSelected(this.selected);
    this.audio.play('charge');
  }

  private cancelAim(restoreState = true): void {
    this.trajectoryGraphics?.destroy();
    this.trajectoryGraphics = null;
    this.selected?.setSelected(false);
    this.selected = null;
    this.aimPoint = null;
    this.hud.setSelected(null);
    if (restoreState) {
      this.setState(GameState.PLAYER_SELECTING);
      this.hud.setHint('Выберите доступный корабль, затем задайте вектор движения');
    }
  }

  private async executeAction(unit: Ship, plan: MovementPlan, owner: Owner): Promise<void> {
    if (!unit.active || unit.actionUsed || this.state === GameState.GAME_OVER) return;
    const token = ++this.actionToken;
    unit.actionUsed = true;
    unit.atBase = false;
    unit.energy = Math.max(0, unit.energy - plan.cost);
    unit.renderVisual();
    this.setState(owner === 'player' ? GameState.PLAYER_ACTION : GameState.BOT_ACTION);
    this.hud.setSelected(unit);
    this.hud.setHint(plan.breach ? 'Прорыв защитной линии: +2 очка' : 'Корабль прокладывает энергетический маршрут');
    this.effects.launch(plan.start, plan.direction, unit.color);
    this.audio.play('launch');

    const trailEvent = this.time.addEvent({
      delay: 28,
      loop: true,
      callback: () => this.effects.engineTrail(unit.point, unit.color),
    });
    await this.moveShip(unit, plan);
    trailEvent.remove(false);
    if (token !== this.actionToken || !unit.active) return;

    this.applyRouteAction(unit, plan);
    if (plan.crossedEnemyRoute) this.applyRouteDebuff(unit);

    if (plan.target) {
      await this.resolveCollision(unit, plan.target, plan);
    } else if (plan.breach) {
      await this.resolveBreach(unit);
    } else if (plan.asteroidHit) {
      this.effects.impact(unit.point, 0x94a3b8);
      this.audio.play('impact');
      this.hud.setHint('Астероид остановил корабль. Следующий маршрут уже виден на поле.');
    }

    this.finishAction(owner);
  }

  private applyRouteAction(unit: Ship, plan: MovementPlan): void {
    if (plan.routeAction === 'create') {
      this.routeSystem.addRoute(unit.owner, plan.start, plan.end, this.round);
      this.effects.floatingText(plan.end, 'МАРШРУТ СОЗДАН', unit.owner === 'player' ? '#67e8f9' : '#fda4af');
      return;
    }

    if (!plan.route) return;
    if (plan.routeAction === 'extend') {
      this.routeSystem.extendRoute(plan.route, plan.end, this.round);
      this.effects.floatingText(plan.end, 'МАРШРУТ ПРОДЛЕН', unit.owner === 'player' ? '#67e8f9' : '#fda4af');
      return;
    }

    const result = this.routeSystem.damageRoute(plan.route, unit.classType, this.round);
    const message = result === 'destroyed' ? 'МАРШРУТ ПЕРЕРЕЗАН' : result === 'captured' ? 'УЧАСТОК ЗАХВАЧЕН' : 'МАРШРУТ ПОВРЕЖДЕН';
    this.effects.floatingText(plan.end, message, '#fbbf24');
    this.audio.play('impact');
  }

  private moveShip(unit: Ship, plan: MovementPlan): Promise<void> {
    const duration = Phaser.Math.Clamp(
      (plan.distance / unit.config.speed) * 1000,
      GAME_BALANCE.actionDurationMin,
      GAME_BALANCE.actionDurationMax,
    );
    unit.rotation = Math.atan2(plan.direction.y, plan.direction.x);

    return new Promise<void>((resolve) => {
      this.tweens.add({
        targets: unit,
        x: plan.end.x,
        y: plan.end.y,
        duration,
        ease: 'Quad.easeOut',
        onUpdate: () => unit.renderVisual(),
        onComplete: () => resolve(),
      });
    });
  }

  private applyRouteDebuff(unit: Ship): void {
    unit.vulnerableTurns = GAME_BALANCE.routeDebuffTurns;
    if (unit.shield > 0) {
      unit.shield -= 1;
      this.effects.shieldBreak(unit.point, unit.owner === 'player' ? BASES.player.color : BASES.bot.color);
      this.audio.play('shield');
      this.effects.floatingText(unit.point, 'МАРШРУТ: ЩИТ СНИЖЕН', '#fbbf24');
    } else {
      this.effects.floatingText(unit.point, 'МАРШРУТ: УЯЗВИМ', '#fbbf24');
    }
    unit.renderVisual();
  }

  private async resolveCollision(attacker: Ship, defender: Ship, plan: MovementPlan): Promise<void> {
    this.setState(GameState.RESOLVING_COMBAT);
    const result = this.combatSystem.resolveCollision(attacker, defender, plan.direction, plan.distance / attacker.config.maxDistance);
    this.audio.play(result.critical ? 'destroy' : 'impact');
    this.effects.impact(defender.point, defender.color);

    if (result.shieldBroken) {
      this.effects.shieldBreak(defender.point, defender.color);
      this.effects.floatingText(defender.point, 'ЩИТ РАЗРУШЕН', '#bae6fd');
      this.audio.play('shield');
    }

    if (!result.destroyed) {
      this.hud.setHint(result.critical ? 'Критический удар пробил защиту' : 'Попадание принято: щит поглощает удар');
      return;
    }

    const position = defender.point;
    defender.destroyShip();
    this.scoreSystem.awardKill(attacker.owner);
    this.effects.explosion(position, defender.color);
    this.effects.flashMessage(attacker.owner === 'player' ? 'ЦЕЛЬ УНИЧТОЖЕНА  +1' : 'ВАШ КОРАБЛЬ УНИЧТОЖЕН', attacker.owner === 'player' ? '#67e8f9' : '#fda4af');
    this.cameras.main.shake(220, 0.006);
    this.hud.setHint('Уничтожение даёт 1 очко. Атакующий возвращается на базу.');
    this.audio.play('score');
    await this.returnToBase(attacker);
  }

  private async resolveBreach(unit: Ship): Promise<void> {
    this.scoreSystem.awardBreach(unit.owner);
    this.effects.flashMessage(unit.owner === 'player' ? 'ПРОРЫВ  +2' : 'ВРАГ ПРОРВАЛ БАЗУ', unit.owner === 'player' ? '#67e8f9' : '#fda4af');
    this.effects.floatingText(unit.point, '+2 ОЧКА ЗА ПРОРЫВ', unit.owner === 'player' ? '#67e8f9' : '#fda4af');
    this.audio.play('score');
    await this.returnToBase(unit);
  }

  private async returnToBase(unit: Ship): Promise<void> {
    this.setState(GameState.RETURNING_TO_BASE);
    this.audio.play('hyperjump');
    await this.effects.hyperjump(unit, unit.homePosition, unit.color);
    unit.restoreAtBase();
    this.hud.setHint('Гиперпрыжок завершён. Энергия восстановлена на базе.');
  }

  private finishAction(owner: Owner): void {
    if (this.checkGameOver()) return;
    if (owner === 'player') {
      this.setState(GameState.BOT_THINKING);
      this.hud.setSelected(null);
      this.hud.setHint('Бот анализирует угрозы, реактор и возможный прорыв…');
      this.time.delayedCall(GAME_BALANCE.botThinkDelay, () => this.performBotTurn());
    } else {
      this.endRound();
    }
  }

  private performBotTurn(): void {
    if (this.state !== GameState.BOT_THINKING) return;
    const action = this.botSystem.chooseAction({
      botShips: this.botShips,
      enemyShips: this.playerShips,
      reactor: this.reactor,
      routes: this.routeSystem,
      round: this.round,
    });
    if (!action) {
      this.endRound();
      return;
    }

    const routeAction: RouteAction = action.intent === 'attack' && this.routeSystem.getEnemyCrossing(action.ship.point, action.target, 'bot')
      ? 'cut'
      : action.intent === 'defend' && this.routeSystem.findOwnRoute(action.ship.point, action.target, 'bot')
        ? 'extend'
        : 'create';
    const plan = this.buildPlanToTarget(action.ship, action.target, routeAction);
    if (!plan) {
      action.ship.actionUsed = true;
      this.endRound();
      return;
    }

    this.hud.setHint(`Бот: ${this.intentLabel(action.intent)} · ${action.ship.config.name}`);
    void this.executeAction(action.ship, plan, 'bot');
  }

  private endRound(): void {
    if (this.checkGameOver()) return;
    this.setState(GameState.ROUND_END);
    this.round += 1;
    this.routeSystem.advanceRound(this.round);
    this.reactor.updateControl(this.allShips);
    this.allShips.forEach((ship) => {
      ship.resetForRound();
      this.energySystem.regenerate(ship, this.reactor.controller);
    });
    this.refreshHud();
    this.time.delayedCall(260, () => {
      if (this.state !== GameState.ROUND_END) return;
      this.setState(GameState.PLAYER_SELECTING);
      this.hud.setHint('Выберите следующий корабль. Следы живут ещё несколько раундов.');
    });
  }

  private checkGameOver(): boolean {
    const playerWon = this.scoreSystem.hasWon('player') || this.botShips.every((ship) => !ship.active);
    const botWon = this.scoreSystem.hasWon('bot') || this.playerShips.every((ship) => !ship.active);
    if (!playerWon && !botWon) {
      this.refreshHud();
      return false;
    }

    this.setState(GameState.GAME_OVER);
    this.cancelAim(false);
    const won = playerWon && !botWon;
    const stats = this.scoreSystem.getStats('player');
    this.hud.showResult(won, stats.score, stats.kills, stats.breaches, this.round);
    this.effects.flashMessage(won ? 'ПОБЕДА' : 'ПОРАЖЕНИЕ', won ? '#67e8f9' : '#fda4af');
    this.audio.play(won ? 'win' : 'lose');
    return true;
  }

  private refreshHud(): void {
    this.reactor.updateControl(this.allShips);
    this.updateGates();
    this.hud.setScores(this.scoreSystem.get('player'), this.scoreSystem.get('bot'), this.round);
    this.hud.setReactor(this.reactor.controller);
    this.hud.setSelected(this.selected);
  }

  private setState(state: GameState): void {
    this.state = state;
    this.hud?.setTurn(state);
    this.playerShips.forEach((ship) => ship.setAvailable(state === GameState.PLAYER_SELECTING && ship.active && !ship.actionUsed));
  }

  private clampToArena(point: Point): Point {
    return {
      x: clamp(point.x, ARENA.left + 18, ARENA.right - 18),
      y: clamp(point.y, ARENA.top + 18, ARENA.bottom - 18),
    };
  }

  private isGateOpen(owner: Owner, y: number): boolean {
    return this.gates.some((gate) => gate.owner === owner && gate.open && Math.abs(gate.y - y) <= GAME_BALANCE.gateRadius);
  }

  private updateGates(): void {
    this.gates.forEach((gate) => {
      gate.open = this.routeSystem.hasRouteNear({ x: gate.lineX, y: gate.y }, gate.owner) || this.reactor.controller === gate.owner;
    });
    this.drawGates();
  }

  private drawGates(): void {
    if (!this.gateGraphics) return;
    this.gateGraphics.clear();
    this.gates.forEach((gate) => {
      const color = gate.owner === 'player' ? BASES.player.color : BASES.bot.color;
      const alpha = gate.open ? 0.88 : 0.2;
      this.gateGraphics.lineStyle(gate.open ? 4 : 2, color, alpha);
      this.gateGraphics.strokeRect(gate.lineX - 16, gate.y - 42, 32, 84);
      this.gateGraphics.lineBetween(gate.lineX - 28, gate.y - 48, gate.lineX + 28, gate.y - 48);
      this.gateGraphics.lineBetween(gate.lineX - 28, gate.y + 48, gate.lineX + 28, gate.y + 48);
      if (gate.open) {
        this.gateGraphics.fillStyle(color, 0.2);
        this.gateGraphics.fillRect(gate.lineX - 8, gate.y - 34, 16, 68);
      }
    });
  }

  private routeActionHint(action: RouteAction): string {
    const hints: Record<RouteAction, string> = {
      create: 'Постройте линию: она может открыть шлюз через несколько ходов.',
      extend: 'Продлите собственную линию, чтобы подготовить следующий маршрут.',
      cut: 'Перережьте чужую линию: перехватчик разрушает её полностью, защитник захватывает.',
    };
    return hints[action];
  }

  private intentLabel(intent: string): string {
    const labels: Record<string, string> = {
      attack: 'атака',
      breach: 'прорыв',
      reactor: 'реактор',
      defend: 'оборона',
    };
    return labels[intent] ?? intent;
  }

  private hideBootStatus(): void {
    const boot = document.getElementById('boot-status');
    if (boot) boot.style.display = 'none';
  }

  public update(): void {
    if (!this.reactor) return;
    this.reactor.updateControl(this.allShips);
    this.updateGates();
    this.hud?.setReactor(this.reactor.controller);
    this.playerShips.forEach((ship) => ship.setAvailable(this.state === GameState.PLAYER_SELECTING && ship.active && !ship.actionUsed));
  }
}
