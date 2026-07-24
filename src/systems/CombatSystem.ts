import { GAME_BALANCE } from '../config/balance';
import type { CombatResult, Point } from '../types/game';
import type { Ship } from '../entities/Ship';

export class CombatSystem {
  public resolveCollision(attacker: Ship, defender: Ship, direction: Point, movementPower: number): CombatResult {
    const critical = attacker.classType === 'interceptor' && movementPower > 0.76;
    const damage = critical ? 1 + attacker.config.criticalDamage : 1;
    let shieldBroken = false;

    if (critical) {
      if (defender.shield > 0) shieldBroken = true;
      defender.shield = 0;
      defender.hull -= damage;
    } else if (defender.shield > 0) {
      defender.shield -= 1;
      shieldBroken = defender.shield === 0;
    } else {
      defender.hull -= damage;
    }

    const destroyed = defender.hull <= 0;
    if (!destroyed) {
      const pushDistance = attacker.config.impactForce * (critical ? 38 : 24);
      defender.x += direction.x * pushDistance;
      defender.y += direction.y * pushDistance;
      defender.x = Math.max(70, Math.min(1210, defender.x));
      defender.y = Math.max(105, Math.min(655, defender.y));
      defender.atBase = false;
      defender.renderVisual();
    }

    return { destroyed, shieldBroken, critical, damage };
  }

  public isHeavyImpact(attacker: Ship, movementPower: number): boolean {
    return attacker.classType === 'defender' && movementPower > GAME_BALANCE.routeBoost;
  }
}
