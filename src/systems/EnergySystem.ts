import { GAME_BALANCE } from '../config/balance';
import type { Owner } from '../types/game';
import type { Ship } from '../entities/Ship';

export class EnergySystem {
  public getCost(distance: number, maxDistance: number): number {
    const ratio = Math.max(0, Math.min(1, distance / maxDistance));
    return Math.ceil(GAME_BALANCE.minMovementCost + ratio * (GAME_BALANCE.maxMovementCost - GAME_BALANCE.minMovementCost));
  }

  public getMaxDistance(ship: Ship): number {
    const available = Math.max(0, ship.energy - GAME_BALANCE.minMovementCost);
    const total = Math.max(1, ship.config.maxEnergy - GAME_BALANCE.minMovementCost);
    return ship.config.maxDistance * Math.min(1, available / total);
  }

  public regenerate(ship: Ship, reactorController: Owner | null): void {
    if (!ship.active) return;
    if (ship.atBase) {
      ship.energy = ship.config.maxEnergy;
      ship.renderVisual();
      return;
    }

    const reactorBonus = reactorController === ship.owner ? GAME_BALANCE.reactorEnergyBonus : 0;
    ship.energy = Math.min(ship.config.maxEnergy, ship.energy + GAME_BALANCE.roundEnergyRegen + reactorBonus);
    ship.renderVisual();
  }
}
