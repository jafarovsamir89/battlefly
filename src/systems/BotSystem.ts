import { BASES } from '../config/balance';
import type { BotAction, Point } from '../types/game';
import { distance } from '../utils/math';
import type { Reactor } from '../entities/Reactor';
import type { Ship } from '../entities/Ship';
import type { RouteSystem } from './RouteSystem';

interface BotContext {
  botShips: Ship[];
  enemyShips: Ship[];
  reactor: Reactor;
  routes: RouteSystem;
  round: number;
}

export class BotSystem {
  public chooseAction(context: BotContext): BotAction | null {
    const candidates: BotAction[] = [];
    const available = context.botShips.filter((ship) => ship.active && !ship.actionUsed);
    const enemies = context.enemyShips.filter((ship) => ship.active);

    available.forEach((ship) => {
      enemies.forEach((enemy) => {
        const target = enemy.point;
        const routePenalty = context.routes.getEnemyCrossing(ship.point, target, 'bot') ? 7 : 0;
        const score = this.scoreAttack(ship, enemy, context) - routePenalty;
        candidates.push({ ship, target, intent: 'attack', score });
      });

      const breachTarget = { x: BASES.player.lineX - 14, y: this.pickBreachLane(ship, enemies) };
      candidates.push({ ship, target: breachTarget, intent: 'breach', score: this.scoreBreach(ship, breachTarget, context) });

      const reactorTarget = context.reactor.center;
      candidates.push({ ship, target: reactorTarget, intent: 'reactor', score: this.scoreReactor(ship, context) });

      const defenderTarget = { x: BASES.bot.lineX - 95, y: this.pickDefenseLane(enemies) };
      candidates.push({ ship, target: defenderTarget, intent: 'defend', score: this.scoreDefense(ship, defenderTarget, context) });
    });

    candidates.sort((a, b) => b.score - a.score);
    if (!candidates.length) return null;
    const top = candidates.slice(0, Math.min(3, candidates.length));
    return top[Math.random() < 0.22 ? Math.floor(Math.random() * top.length) : 0];
  }

  private scoreAttack(ship: Ship, enemy: Ship, context: BotContext): number {
    const distanceToEnemy = distance(ship.point, enemy.point);
    const reach = Math.min(1, this.getReach(ship, distanceToEnemy));
    const nearBase = enemy.x > BASES.player.lineX + 80 ? 16 : 0;
    const vulnerable = enemy.vulnerableTurns > 0 ? 13 : 0;
    const targetValue = enemy.classType === 'defender' ? 8 : 4;
    const routeValue = context.routes.getEnemyCrossing(ship.point, enemy.point, 'bot') ? -6 : 5;
    return 35 + reach * 40 + nearBase + vulnerable + targetValue + routeValue - distanceToEnemy / 60;
  }

  private scoreBreach(ship: Ship, target: Point, context: BotContext): number {
    const distanceToTarget = distance(ship.point, target);
    const reach = this.getReach(ship, distanceToTarget);
    const scoutBonus = ship.classType === 'scout' ? 28 : 0;
    const pressureBonus = context.enemyShips.some((enemy) => enemy.active && enemy.x < BASES.bot.lineX - 120) ? 18 : 0;
    return 22 + reach * 35 + scoutBonus + pressureBonus - distanceToTarget / 65;
  }

  private scoreReactor(ship: Ship, context: BotContext): number {
    const distanceToReactor = distance(ship.point, context.reactor.center);
    const controlBonus = context.reactor.controller === null ? 24 : context.reactor.controller === 'player' ? 31 : 4;
    return 24 + controlBonus + this.getReach(ship, distanceToReactor) * 26 - distanceToReactor / 75;
  }

  private scoreDefense(ship: Ship, target: Point, context: BotContext): number {
    const threat = context.enemyShips
      .filter((enemy) => enemy.active)
      .reduce((total, enemy) => total + (enemy.x > BASES.bot.lineX - 240 ? 20 : 0), 0);
    const defenderBonus = ship.classType === 'defender' ? 24 : 0;
    return 18 + threat + defenderBonus + this.getReach(ship, distance(ship.point, target)) * 20;
  }

  private getReach(ship: Ship, targetDistance: number): number {
    const maxDistance = ship.config.maxDistance * Math.max(0.2, ship.energy / ship.config.maxEnergy);
    return Math.min(1, maxDistance / Math.max(1, targetDistance));
  }

  private pickBreachLane(ship: Ship, enemies: Ship[]): number {
    const danger = enemies
      .filter((enemy) => enemy.active)
      .sort((a, b) => a.y - b.y)[0];
    if (danger && ship.classType !== 'scout') return danger.y > 360 ? BASES.player.gateYs[0] : BASES.player.gateYs[1];
    return ship.classType === 'scout' ? BASES.player.gateYs[0] : BASES.player.gateYs[1];
  }

  private pickDefenseLane(enemies: Ship[]): number {
    const closest = enemies
      .filter((enemy) => enemy.active)
      .sort((a, b) => b.x - a.x)[0];
    return closest?.y ?? 360;
  }
}
