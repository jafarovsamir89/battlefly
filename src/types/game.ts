import type { Ship } from '../entities/Ship';

export type Owner = 'player' | 'bot';

export type ShipClass = 'scout' | 'interceptor' | 'defender';

export type ActionIntent = 'attack' | 'breach' | 'reactor' | 'defend';

export type RouteAction = 'create' | 'extend' | 'cut';

export type RouteStatus = 'active' | 'damaged' | 'captured' | 'destroyed';

export enum GameState {
  PLAYER_SELECTING = 'PLAYER_SELECTING',
  PLAYER_AIMING = 'PLAYER_AIMING',
  PLAYER_ACTION = 'PLAYER_ACTION',
  RESOLVING_COMBAT = 'RESOLVING_COMBAT',
  RETURNING_TO_BASE = 'RETURNING_TO_BASE',
  BOT_THINKING = 'BOT_THINKING',
  BOT_ACTION = 'BOT_ACTION',
  ROUND_END = 'ROUND_END',
  GAME_OVER = 'GAME_OVER',
}

export interface Point {
  x: number;
  y: number;
}

export interface ShipConfig {
  name: string;
  shortName: string;
  role: string;
  icon: string;
  maxEnergy: number;
  maxDistance: number;
  speed: number;
  shields: number;
  hull: number;
  impactForce: number;
  criticalDamage: number;
}

export interface Route {
  id: number;
  owner: Owner;
  start: Point;
  end: Point;
  createdRound: number;
  energy: number;
  status: RouteStatus;
}

export interface MovementPlan {
  start: Point;
  end: Point;
  direction: Point;
  distance: number;
  cost: number;
  routeAction: RouteAction;
  route: Route | null;
  breach: boolean;
  asteroidHit: boolean;
  target: Ship | null;
  boostedByRoute: boolean;
  crossedEnemyRoute: boolean;
}

export interface CombatResult {
  destroyed: boolean;
  shieldBroken: boolean;
  critical: boolean;
  damage: number;
}

export interface BotAction {
  ship: Ship;
  target: Point;
  intent: ActionIntent;
  score: number;
}
