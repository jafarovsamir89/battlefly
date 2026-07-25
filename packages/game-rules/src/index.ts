import type { NodeType, PlayerId, SectorId } from '@battlefly/shared-types';

export const PROTOCOL_VERSION = 1;
export const MAP_ID = 'vector-fleet-foundation';
export const MAP_WIDTH = 1600;
export const MAP_HEIGHT = 900;
export const TOTAL_SECTORS = 10;
export const FIXED_TIMESTEP_MS = 1000 / 30;

export const DEFAULT_INITIAL_MATTER = 60;
export const DEFAULT_INITIAL_ENERGY = 20;

export const LINK_MATTER_COST = 12;
export const LINK_MAX_LENGTH = 260;
export const LINK_CAPACITY = 8;
export const LINK_BASE_INTEGRITY = 100;
export const EDGE_PROGRESS_MAX = 1000;
export const SQUADRON_MOVE_PROGRESS_PER_TICK = 250;
export const SQUADRON_EDGE_ENERGY_COST = 2;
export const SQUADRON_MAX_ENERGY = 12;
export const SQUADRON_IDLE_REGEN = 1;
export const SCOUT_PRODUCTION_REQUIRED_PROGRESS = 4;
export const SCOUT_PRODUCTION_MATTER_COST = 8;
export const SCOUT_PRODUCTION_QUEUE_LIMIT = 3;

export const NODE_PRIORITY_DEFAULTS: Record<NodeType, number> = {
  'command-core': 100,
  reactor: 80,
  relay: 60,
  mine: 40,
  shipyard: 20,
};

export const NODE_RULES: Record<
  NodeType,
  {
    readonly networkSupply: number;
    readonly networkDemand: number;
    readonly matterDelta: number;
    readonly energyDelta: number;
    readonly hitPoints: number;
  }
> = {
  'command-core': {
    networkSupply: 3,
    networkDemand: 1,
    matterDelta: 0,
    energyDelta: 2,
    hitPoints: 30,
  },
  relay: {
    networkSupply: 0,
    networkDemand: 1,
    matterDelta: 0,
    energyDelta: 0,
    hitPoints: 10,
  },
  mine: {
    networkSupply: 0,
    networkDemand: 1,
    matterDelta: 4,
    energyDelta: 0,
    hitPoints: 14,
  },
  reactor: {
    networkSupply: 4,
    networkDemand: 2,
    matterDelta: 0,
    energyDelta: 4,
    hitPoints: 18,
  },
  shipyard: {
    networkSupply: 0,
    networkDemand: 2,
    matterDelta: 0,
    energyDelta: -2,
    hitPoints: 16,
  },
};

export interface NodeBlueprint {
  readonly id: string;
  readonly type: NodeType;
  readonly owner: PlayerId;
  readonly sectorId: SectorId;
  readonly x: number;
  readonly y: number;
  readonly priority?: number;
}

export interface SectorBlueprint {
  readonly id: SectorId;
  readonly label: string;
  readonly kind: 'home' | 'resource' | 'energy' | 'neutral' | 'frontier';
  readonly owner: PlayerId | 'neutral';
  readonly index: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly connectedSectorIds: readonly SectorId[];
  readonly nodeIds: readonly string[];
}

export const PLAYERS = {
  alpha: 'player-alpha' as PlayerId,
  omega: 'player-omega' as PlayerId,
} as const;

const sectorId = (value: string) => value as SectorId;

export const TEST_SECTORS: readonly SectorBlueprint[] = [
  {
    id: sectorId('sector-alpha-core'),
    label: 'Alpha Core',
    kind: 'home',
    owner: PLAYERS.alpha,
    index: 0,
    x: 0,
    y: 120,
    width: 140,
    height: 660,
    connectedSectorIds: [sectorId('sector-alpha-relay'), sectorId('sector-alpha-mine')],
    nodeIds: ['alpha-core', 'alpha-shipyard'],
  },
  {
    id: sectorId('sector-alpha-relay'),
    label: 'Alpha Relay',
    kind: 'frontier',
    owner: PLAYERS.alpha,
    index: 1,
    x: 140,
    y: 120,
    width: 140,
    height: 660,
    connectedSectorIds: [
      sectorId('sector-alpha-core'),
      sectorId('sector-alpha-mine'),
      sectorId('sector-alpha-reactor'),
    ],
    nodeIds: ['alpha-relay'],
  },
  {
    id: sectorId('sector-alpha-mine'),
    label: 'Alpha Mine',
    kind: 'resource',
    owner: PLAYERS.alpha,
    index: 2,
    x: 280,
    y: 120,
    width: 150,
    height: 660,
    connectedSectorIds: [
      sectorId('sector-alpha-core'),
      sectorId('sector-alpha-relay'),
      sectorId('sector-alpha-reactor'),
      sectorId('sector-center-west'),
    ],
    nodeIds: ['alpha-mine'],
  },
  {
    id: sectorId('sector-alpha-reactor'),
    label: 'Alpha Reactor',
    kind: 'energy',
    owner: PLAYERS.alpha,
    index: 3,
    x: 430,
    y: 120,
    width: 170,
    height: 660,
    connectedSectorIds: [
      sectorId('sector-alpha-relay'),
      sectorId('sector-alpha-mine'),
      sectorId('sector-center-west'),
    ],
    nodeIds: ['alpha-reactor'],
  },
  {
    id: sectorId('sector-center-west'),
    label: 'Center West',
    kind: 'neutral',
    owner: 'neutral',
    index: 4,
    x: 600,
    y: 120,
    width: 150,
    height: 660,
    connectedSectorIds: [
      sectorId('sector-alpha-mine'),
      sectorId('sector-alpha-reactor'),
      sectorId('sector-center-east'),
      sectorId('sector-omega-reactor'),
    ],
    nodeIds: [],
  },
  {
    id: sectorId('sector-center-east'),
    label: 'Center East',
    kind: 'neutral',
    owner: 'neutral',
    index: 5,
    x: 750,
    y: 120,
    width: 150,
    height: 660,
    connectedSectorIds: [
      sectorId('sector-center-west'),
      sectorId('sector-omega-reactor'),
      sectorId('sector-omega-mine'),
      sectorId('sector-omega-relay'),
    ],
    nodeIds: [],
  },
  {
    id: sectorId('sector-omega-reactor'),
    label: 'Omega Reactor',
    kind: 'energy',
    owner: PLAYERS.omega,
    index: 6,
    x: 900,
    y: 120,
    width: 170,
    height: 660,
    connectedSectorIds: [
      sectorId('sector-center-west'),
      sectorId('sector-center-east'),
      sectorId('sector-omega-mine'),
      sectorId('sector-omega-relay'),
    ],
    nodeIds: ['omega-reactor'],
  },
  {
    id: sectorId('sector-omega-mine'),
    label: 'Omega Mine',
    kind: 'resource',
    owner: PLAYERS.omega,
    index: 7,
    x: 1070,
    y: 120,
    width: 150,
    height: 660,
    connectedSectorIds: [
      sectorId('sector-center-east'),
      sectorId('sector-omega-reactor'),
      sectorId('sector-omega-relay'),
      sectorId('sector-omega-core'),
    ],
    nodeIds: ['omega-mine'],
  },
  {
    id: sectorId('sector-omega-relay'),
    label: 'Omega Relay',
    kind: 'frontier',
    owner: PLAYERS.omega,
    index: 8,
    x: 1220,
    y: 120,
    width: 140,
    height: 660,
    connectedSectorIds: [
      sectorId('sector-center-east'),
      sectorId('sector-omega-reactor'),
      sectorId('sector-omega-mine'),
      sectorId('sector-omega-core'),
    ],
    nodeIds: ['omega-relay'],
  },
  {
    id: sectorId('sector-omega-core'),
    label: 'Omega Core',
    kind: 'home',
    owner: PLAYERS.omega,
    index: 9,
    x: 1360,
    y: 120,
    width: 240,
    height: 660,
    connectedSectorIds: [sectorId('sector-omega-mine'), sectorId('sector-omega-relay')],
    nodeIds: ['omega-core', 'omega-shipyard'],
  },
] as const;

export const TEST_NODES: readonly NodeBlueprint[] = [
  { id: 'alpha-core', type: 'command-core', owner: PLAYERS.alpha, sectorId: sectorId('sector-alpha-core'), x: 62, y: 320 },
  { id: 'alpha-shipyard', type: 'shipyard', owner: PLAYERS.alpha, sectorId: sectorId('sector-alpha-core'), x: 88, y: 430 },
  { id: 'alpha-relay', type: 'relay', owner: PLAYERS.alpha, sectorId: sectorId('sector-alpha-relay'), x: 194, y: 320 },
  { id: 'alpha-mine', type: 'mine', owner: PLAYERS.alpha, sectorId: sectorId('sector-alpha-mine'), x: 352, y: 315 },
  { id: 'alpha-reactor', type: 'reactor', owner: PLAYERS.alpha, sectorId: sectorId('sector-alpha-reactor'), x: 512, y: 320 },
  { id: 'omega-reactor', type: 'reactor', owner: PLAYERS.omega, sectorId: sectorId('sector-omega-reactor'), x: 1088, y: 320 },
  { id: 'omega-mine', type: 'mine', owner: PLAYERS.omega, sectorId: sectorId('sector-omega-mine'), x: 1156, y: 315 },
  { id: 'omega-relay', type: 'relay', owner: PLAYERS.omega, sectorId: sectorId('sector-omega-relay'), x: 1296, y: 320 },
  { id: 'omega-core', type: 'command-core', owner: PLAYERS.omega, sectorId: sectorId('sector-omega-core'), x: 1518, y: 320 },
  { id: 'omega-shipyard', type: 'shipyard', owner: PLAYERS.omega, sectorId: sectorId('sector-omega-core'), x: 1458, y: 430 },
] as const;

export const TEST_LINK_CANDIDATES = {
  alpha: {
    coreToRelay: ['alpha-core', 'alpha-relay'] as const,
    relayToMine: ['alpha-relay', 'alpha-mine'] as const,
    mineToReactor: ['alpha-mine', 'alpha-reactor'] as const,
    coreToShipyard: ['alpha-core', 'alpha-shipyard'] as const,
  },
  omega: {
    coreToRelay: ['omega-core', 'omega-relay'] as const,
    relayToMine: ['omega-relay', 'omega-mine'] as const,
    mineToReactor: ['omega-mine', 'omega-reactor'] as const,
    coreToShipyard: ['omega-core', 'omega-shipyard'] as const,
  },
} as const;
