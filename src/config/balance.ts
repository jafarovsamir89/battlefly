import type { ShipClass, ShipConfig } from '../types/game';

export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

export const ARENA = {
  left: 44,
  right: GAME_WIDTH - 44,
  top: 76,
  bottom: GAME_HEIGHT - 34,
};

export const BASES = {
  player: {
    x: 112,
    lineX: 238,
    color: 0x38bdf8,
    gateYs: [238, 482],
  },
  bot: {
    x: GAME_WIDTH - 112,
    lineX: GAME_WIDTH - 238,
    color: 0xfb7185,
    gateYs: [238, 482],
  },
};

export const SHIP_CONFIGS: Record<ShipClass, ShipConfig> = {
  scout: {
    name: 'Разведчик',
    shortName: 'SCOUT',
    role: 'быстрый прорыв',
    icon: '◇',
    maxEnergy: 108,
    maxDistance: 390,
    speed: 560,
    shields: 1,
    hull: 1,
    impactForce: 0.7,
    criticalDamage: 0,
  },
  interceptor: {
    name: 'Перехватчик',
    shortName: 'INTERCEPTOR',
    role: 'точечная атака',
    icon: '✦',
    maxEnergy: 100,
    maxDistance: 305,
    speed: 470,
    shields: 1,
    hull: 1,
    impactForce: 1,
    criticalDamage: 1,
  },
  defender: {
    name: 'Защитник',
    shortName: 'DEFENDER',
    role: 'контроль центра',
    icon: '⬢',
    maxEnergy: 92,
    maxDistance: 230,
    speed: 370,
    shields: 2,
    hull: 2,
    impactForce: 1.35,
    criticalDamage: 0,
  },
};

export const FLEET_LAYOUT: ShipClass[] = ['scout', 'interceptor', 'defender'];

export const GAME_BALANCE = {
  minAimDistance: 18,
  minMovementDistance: 42,
  minMovementCost: 10,
  maxMovementCost: 52,
  roundEnergyRegen: 13,
  reactorEnergyBonus: 8,
  routeLifetime: 3,
  routeBoost: 1.14,
  routeStartingEnergy: 100,
  routeExtendCost: 24,
  routeCutDamage: 1,
  gateRadius: 58,
  routeDebuffTurns: 1,
  killScore: 1,
  breachScore: 2,
  winScore: 6,
  actionDurationMin: 280,
  actionDurationMax: 1450,
  botThinkDelay: 680,
  collisionRadius: 25,
  asteroidPadding: 25,
};
