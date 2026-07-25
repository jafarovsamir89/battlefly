import {
  DEFAULT_INITIAL_ENERGY,
  DEFAULT_INITIAL_MATTER,
  LINK_BASE_INTEGRITY,
  LINK_CAPACITY,
  LINK_MATTER_COST,
  MAP_ID,
  NODE_PRIORITY_DEFAULTS,
  NODE_RULES,
  PLAYERS,
  TEST_NODES,
  TEST_SECTORS,
} from '@battlefly/game-rules';
import type {
  CommandId,
  CommandRejectionReason,
  EventId,
  LinkId,
  LinkState,
  MatchId,
  NodeId,
  NodeState,
  PlayerId,
  PowerState,
  SectorId,
  SectorState,
  SimulationCommand,
  SimulationCommandResult,
  SimulationEvent,
  SnapshotEnvelope,
  WorldState,
} from '@battlefly/shared-types';

type MutablePlayerState = {
  id: PlayerId;
  name: string;
  resources: {
    matter: number;
    energy: number;
  };
};

type MutableSectorState = {
  id: SectorId;
  kind: SectorState['kind'];
  owner: SectorState['owner'];
  index: number;
  label: string;
  center: { x: number; y: number };
  bounds: { x: number; y: number; width: number; height: number };
  connectedSectorIds: readonly SectorId[];
};

type MutableNodeState = {
  id: NodeId;
  sectorId: SectorId;
  owner: PlayerId;
  type: NodeState['type'];
  position: { x: number; y: number };
  priority: number;
  powerState: PowerState;
  networkSupply: number;
  networkDemand: number;
  matterDelta: number;
  energyDelta: number;
  hitPoints: number;
};

type MutableLinkState = {
  id: LinkId;
  owner: PlayerId;
  fromNodeId: NodeId;
  toNodeId: NodeId;
  state: LinkState;
  capacity: number;
  integrity: number;
  length: number;
  matterCost: number;
};

export interface MutableWorldState {
  protocolVersion: number;
  matchId: MatchId;
  mapId: string;
  seed: number;
  tick: number;
  eventSequence: number;
  linkSequence: number;
  players: MutablePlayerState[];
  sectors: MutableSectorState[];
  nodes: MutableNodeState[];
  links: MutableLinkState[];
}

export interface SimulationRuntime {
  readonly state: WorldState;
  submit(command: SimulationCommand): SimulationCommandResult;
  step(steps?: number): readonly SimulationEvent[];
  runUntil(targetTick: number): readonly SimulationEvent[];
  snapshot(): SnapshotEnvelope;
}

export interface SimulationRuntimeOptions {
  readonly seed?: number;
  readonly matchId?: MatchId;
}

const NODE_TYPE_ORDER: Record<NodeState['type'], number> = {
  'command-core': 0,
  reactor: 1,
  relay: 2,
  mine: 3,
  shipyard: 4,
};

const compareStrings = (left: string, right: string): number => {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
};

const sortById = <T extends { id: string }>(values: readonly T[]): T[] =>
  [...values].sort((left, right) => compareStrings(left.id, right.id));

const nextEventSequence = (state: MutableWorldState): number => {
  state.eventSequence += 1;
  return state.eventSequence;
};

const createEventId = (sequence: number): EventId => `event-${sequence}` as EventId;
const createLinkId = (sequence: number): LinkId => `link-${sequence.toString().padStart(6, '0')}` as LinkId;

const compareNodes = (left: MutableNodeState, right: MutableNodeState): number => {
  if (left.priority !== right.priority) {
    return right.priority - left.priority;
  }
  const typeDifference = NODE_TYPE_ORDER[left.type] - NODE_TYPE_ORDER[right.type];
  if (typeDifference !== 0) {
    return typeDifference;
  }
  return compareStrings(left.id, right.id);
};

const clonePlayers = (players: readonly MutablePlayerState[]): MutablePlayerState[] =>
  sortById(players).map((player) => ({
    ...player,
    resources: { ...player.resources },
  }));

const cloneSectors = (sectors: readonly MutableSectorState[]): MutableSectorState[] =>
  sortById(sectors).map((sector) => ({
    ...sector,
    connectedSectorIds: [...sector.connectedSectorIds].sort(compareStrings),
  }));

const cloneNodes = (nodes: readonly MutableNodeState[]): MutableNodeState[] =>
  sortById(nodes).map((node) => ({ ...node }));

const cloneLinks = (links: readonly MutableLinkState[]): MutableLinkState[] =>
  sortById(links).map((link) => ({ ...link }));

const sameLink = (link: MutableLinkState, left: NodeId, right: NodeId): boolean =>
  (link.fromNodeId === left && link.toNodeId === right) || (link.fromNodeId === right && link.toNodeId === left);

const createBaseState = (options: SimulationRuntimeOptions = {}): MutableWorldState => {
  const seed = options.seed ?? 1;
  const matchId = options.matchId ?? (`match-${seed}` as MatchId);

  const players: MutablePlayerState[] = [
    {
      id: PLAYERS.alpha,
      name: 'Alpha',
      resources: {
        matter: DEFAULT_INITIAL_MATTER,
        energy: DEFAULT_INITIAL_ENERGY,
      },
    },
    {
      id: PLAYERS.omega,
      name: 'Omega',
      resources: {
        matter: DEFAULT_INITIAL_MATTER,
        energy: DEFAULT_INITIAL_ENERGY,
      },
    },
  ];

  const sectors: MutableSectorState[] = TEST_SECTORS.map((sector) => ({
    id: sector.id,
    kind: sector.kind,
    owner: sector.owner,
    index: sector.index,
    label: sector.label,
    center: {
      x: sector.x + sector.width / 2,
      y: sector.y + sector.height / 2,
    },
    bounds: {
      x: sector.x,
      y: sector.y,
      width: sector.width,
      height: sector.height,
    },
    connectedSectorIds: [...sector.connectedSectorIds],
  }));

  const nodes: MutableNodeState[] = TEST_NODES.map((nodeBlueprint) => {
    const rules = NODE_RULES[nodeBlueprint.type];
    return {
      id: nodeBlueprint.id as NodeId,
      sectorId: nodeBlueprint.sectorId,
      owner: nodeBlueprint.owner,
      type: nodeBlueprint.type,
      position: {
        x: nodeBlueprint.x,
        y: nodeBlueprint.y,
      },
      priority: nodeBlueprint.priority ?? NODE_PRIORITY_DEFAULTS[nodeBlueprint.type],
      powerState: 'unpowered',
      networkSupply: rules.networkSupply,
      networkDemand: rules.networkDemand,
      matterDelta: rules.matterDelta,
      energyDelta: rules.energyDelta,
      hitPoints: rules.hitPoints,
    };
  });

  return {
    protocolVersion: 1,
    matchId,
    mapId: MAP_ID,
    seed,
    tick: 0,
    eventSequence: 0,
    linkSequence: 0,
    players,
    sectors,
    nodes,
    links: [],
  };
};

export const createInitialWorldState = (options: SimulationRuntimeOptions = {}): WorldState =>
  serializeWorldState(createBaseState(options));

export const createSimulationRuntime = (options: SimulationRuntimeOptions = {}): SimulationRuntime => {
  const state = createBaseState(options);
  const queue: SimulationCommand[] = [];

  return {
    get state() {
      return serializeWorldState(state);
    },
    submit(command) {
      if (command.protocolVersion !== state.protocolVersion) {
        return rejected(command.commandId, 'protocol-version-mismatch');
      }
      if (command.intendedTick < state.tick) {
        return rejected(command.commandId, 'wrong-tick');
      }
      if (command.intendedTick === state.tick) {
        return applyCommandToState(state, command);
      }
      queue.push(command);
      queue.sort((left, right) =>
        left.intendedTick === right.intendedTick
          ? compareStrings(left.commandId, right.commandId)
          : left.intendedTick - right.intendedTick,
      );
      return accepted(command.commandId);
    },
    step(steps = 1) {
      const events: SimulationEvent[] = [];
      for (let index = 0; index < steps; index += 1) {
        while (queue.length > 0 && queue[0]!.intendedTick <= state.tick) {
          const command = queue.shift()!;
          const result = applyCommandToState(state, command);
          if (result.status === 'accepted') {
            events.push(...result.events);
          }
        }
        events.push(...advanceOneTick(state));
      }
      return events;
    },
    runUntil(targetTick: number) {
      const events: SimulationEvent[] = [];
      while (state.tick < targetTick) {
        events.push(...this.step(1));
      }
      return events;
    },
    snapshot() {
      return createSnapshotEnvelope(state);
    },
  };
};

export const applyCommandToState = (
  state: MutableWorldState,
  command: SimulationCommand,
): SimulationCommandResult => {
  if (command.protocolVersion !== state.protocolVersion) {
    return rejected(command.commandId, 'protocol-version-mismatch');
  }
  if (command.intendedTick !== state.tick) {
    return rejected(command.commandId, 'wrong-tick');
  }

  switch (command.type) {
    case 'create-energy-link':
      return applyCreateEnergyLinkCommand(state, command);
    case 'remove-energy-link':
      return applyRemoveEnergyLinkCommand(state, command);
    case 'set-node-priority':
      return applySetNodePriorityCommand(state, command);
  }
};

export const advanceOneTick = (state: MutableWorldState): readonly SimulationEvent[] => {
  const events: SimulationEvent[] = [];
  const powerResolution = resolvePower(state);
  events.push(...powerResolution.events);
  applyResourceTick(state, powerResolution.powerByNodeId, events);
  updateLinkStates(state, powerResolution.powerByNodeId);
  state.tick += 1;
  return events;
};

export const rejected = (
  commandId: CommandId,
  reason: CommandRejectionReason,
): SimulationCommandResult => ({
  status: 'rejected',
  commandId,
  reason,
  events: [],
});

export const accepted = (commandId: CommandId, events: readonly SimulationEvent[] = []): SimulationCommandResult => ({
  status: 'accepted',
  commandId,
  events,
});

const applyCreateEnergyLinkCommand = (
  state: MutableWorldState,
  command: Extract<SimulationCommand, { type: 'create-energy-link' }>,
): SimulationCommandResult => {
  const fromNode = state.nodes.find((node) => node.id === command.payload.fromNodeId);
  const toNode = state.nodes.find((node) => node.id === command.payload.toNodeId);
  if (!fromNode || !toNode) {
    return rejected(command.commandId, 'unknown-node');
  }
  if (fromNode.id === toNode.id) {
    return rejected(command.commandId, 'same-node');
  }
  if (fromNode.owner !== command.playerId || toNode.owner !== command.playerId) {
    return rejected(command.commandId, 'not-owned');
  }
  if (!areSectorsConnected(state, fromNode.sectorId, toNode.sectorId)) {
    return rejected(command.commandId, 'sector-not-linked');
  }
  if (distance(fromNode.position, toNode.position) > 260) {
    return rejected(command.commandId, 'distance-too-long');
  }
  if (state.links.some((link) => sameLink(link, fromNode.id, toNode.id))) {
    return rejected(command.commandId, 'duplicate-link');
  }

  const player = state.players.find((entry) => entry.id === command.playerId);
  if (!player || player.resources.matter < LINK_MATTER_COST) {
    return rejected(command.commandId, 'insufficient-matter');
  }

  const link: MutableLinkState = {
    id: createLinkId(++state.linkSequence),
    owner: command.playerId,
    fromNodeId: fromNode.id,
    toNodeId: toNode.id,
    state: 'active',
    capacity: LINK_CAPACITY,
    integrity: LINK_BASE_INTEGRITY,
    length: distance(fromNode.position, toNode.position),
    matterCost: LINK_MATTER_COST,
  };

  replacePlayerResources(state, command.playerId, {
    matter: player.resources.matter - LINK_MATTER_COST,
    energy: player.resources.energy,
  });
  state.links = sortById([...state.links, link]);

  const sequence = nextEventSequence(state);
  return accepted(command.commandId, [
    {
      eventId: createEventId(sequence),
      sequence,
      tick: state.tick,
      type: 'link-created',
      payload: {
        linkId: link.id,
        fromNodeId: fromNode.id,
        toNodeId: toNode.id,
      },
    },
  ]);
};

const applyRemoveEnergyLinkCommand = (
  state: MutableWorldState,
  command: Extract<SimulationCommand, { type: 'remove-energy-link' }>,
): SimulationCommandResult => {
  const link = state.links.find((entry) => entry.id === command.payload.linkId);
  if (!link) {
    return rejected(command.commandId, 'unknown-link');
  }
  if (link.owner !== command.playerId) {
    return rejected(command.commandId, 'not-owned');
  }
  state.links = state.links.filter((entry) => entry.id !== link.id);
  const sequence = nextEventSequence(state);
  return accepted(command.commandId, [
    {
      eventId: createEventId(sequence),
      sequence,
      tick: state.tick,
      type: 'link-removed',
      payload: {
        linkId: link.id,
      },
    },
  ]);
};

const applySetNodePriorityCommand = (
  state: MutableWorldState,
  command: Extract<SimulationCommand, { type: 'set-node-priority' }>,
): SimulationCommandResult => {
  if (!Number.isInteger(command.payload.priority) || command.payload.priority < 0 || command.payload.priority > 255) {
    return rejected(command.commandId, 'invalid-priority');
  }
  const node = state.nodes.find((entry) => entry.id === command.payload.nodeId);
  if (!node) {
    return rejected(command.commandId, 'unknown-node');
  }
  if (node.owner !== command.playerId) {
    return rejected(command.commandId, 'not-owned');
  }
  node.priority = command.payload.priority;
  state.nodes = sortById(state.nodes);
  const sequence = nextEventSequence(state);
  return accepted(command.commandId, [
    {
      eventId: createEventId(sequence),
      sequence,
      tick: state.tick,
      type: 'node-priority-changed',
      payload: {
        nodeId: node.id,
        priority: command.payload.priority,
      },
    },
  ]);
};

interface PowerResolution {
  readonly powerByNodeId: ReadonlyMap<NodeId, boolean>;
  readonly events: readonly SimulationEvent[];
}

const resolvePower = (state: MutableWorldState): PowerResolution => {
  const powerByNodeId = new Map<NodeId, boolean>();
  const events: SimulationEvent[] = [];

  for (const player of state.players) {
    const playerNodes = state.nodes.filter((node) => node.owner === player.id);
    const adjacency = buildAdjacency(playerNodes, state.links.filter((link) => link.owner === player.id));
    const components = connectedComponents(playerNodes, adjacency);
    const poweredNodeIds: NodeId[] = [];
    const unpoweredNodeIds: NodeId[] = [];

    for (const component of components) {
      const ordered = [...component].sort(compareNodes);
      let budget = ordered.reduce((sum, node) => sum + node.networkSupply, 0);
      for (const node of ordered) {
        if (budget >= node.networkDemand) {
          budget -= node.networkDemand;
          powerByNodeId.set(node.id, true);
          poweredNodeIds.push(node.id);
        } else {
          powerByNodeId.set(node.id, false);
          unpoweredNodeIds.push(node.id);
        }
      }
    }

    const sequence = nextEventSequence(state);
    events.push({
      eventId: createEventId(sequence),
      sequence,
      tick: state.tick,
      type: 'power-resolved',
      payload: {
        playerId: player.id,
        poweredNodeIds: [...poweredNodeIds].sort(compareStrings),
        unpoweredNodeIds: [...unpoweredNodeIds].sort(compareStrings),
      },
    });
  }

  return {
    powerByNodeId,
    events,
  };
};

const applyResourceTick = (
  state: MutableWorldState,
  powerByNodeId: ReadonlyMap<NodeId, boolean>,
  events: SimulationEvent[],
): void => {
  for (const player of state.players) {
    const playerNodes = state.nodes.filter((node) => node.owner === player.id);
    const poweredNodes = playerNodes.filter((node) => powerByNodeId.get(node.id));
    const matterDelta = poweredNodes.reduce((sum, node) => sum + node.matterDelta, 0);
    const energyDelta = poweredNodes.reduce((sum, node) => sum + node.energyDelta, 0);
    replacePlayerResources(state, player.id, {
      matter: Math.max(0, player.resources.matter + matterDelta),
      energy: Math.max(0, player.resources.energy + energyDelta),
    });
    const sequence = nextEventSequence(state);
    events.push({
      eventId: createEventId(sequence),
      sequence,
      tick: state.tick,
      type: 'resource-tick',
      payload: {
        playerId: player.id,
        matterDelta,
        energyDelta,
      },
    });
  }

  state.nodes = sortById(
    state.nodes.map((node) => ({
      ...node,
      powerState: powerByNodeId.get(node.id) ? 'powered' : 'unpowered',
    })),
  );
};

const updateLinkStates = (state: MutableWorldState, powerByNodeId: ReadonlyMap<NodeId, boolean>): void => {
  state.links = sortById(
    state.links.map((link) => {
      const fromPowered = powerByNodeId.get(link.fromNodeId) ?? false;
      const toPowered = powerByNodeId.get(link.toNodeId) ?? false;
      let stateLabel: LinkState = 'active';
      if (link.integrity < 50) {
        stateLabel = 'damaged';
      } else if (!fromPowered || !toPowered) {
        stateLabel = 'offline';
      } else if (link.length / 260 > 0.85) {
        stateLabel = 'overloaded';
      }
      return {
        ...link,
        state: stateLabel,
      };
    }),
  );
};

const buildAdjacency = (
  nodes: readonly MutableNodeState[],
  links: readonly MutableLinkState[],
): ReadonlyMap<NodeId, readonly NodeId[]> => {
  const adjacency = new Map<NodeId, NodeId[]>();
  for (const node of nodes) {
    adjacency.set(node.id, []);
  }
  for (const link of links) {
    const fromList = adjacency.get(link.fromNodeId);
    const toList = adjacency.get(link.toNodeId);
    if (!fromList || !toList) {
      continue;
    }
    fromList.push(link.toNodeId);
    toList.push(link.fromNodeId);
  }
  for (const neighbors of adjacency.values()) {
    neighbors.sort(compareStrings);
  }
  return adjacency;
};

const connectedComponents = (
  nodes: readonly MutableNodeState[],
  adjacency: ReadonlyMap<NodeId, readonly NodeId[]>,
): MutableNodeState[][] => {
  const nodeById = new Map(nodes.map((node) => [node.id, node] as const));
  const visited = new Set<NodeId>();
  const components: MutableNodeState[][] = [];

  for (const node of sortById(nodes)) {
    if (visited.has(node.id)) {
      continue;
    }
    const stack = [node.id];
    const component: MutableNodeState[] = [];
    visited.add(node.id);
    while (stack.length > 0) {
      const currentId = stack.pop()!;
      const currentNode = nodeById.get(currentId);
      if (currentNode) {
        component.push(currentNode);
      }
      for (const neighbor of adjacency.get(currentId) ?? []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          stack.push(neighbor);
        }
      }
    }
    components.push(component);
  }

  return components;
};

const areSectorsConnected = (state: MutableWorldState, left: SectorId, right: SectorId): boolean => {
  if (left === right) {
    return true;
  }
  const sector = state.sectors.find((entry) => entry.id === left);
  return sector ? sector.connectedSectorIds.includes(right) : false;
};

const replacePlayerResources = (
  state: MutableWorldState,
  playerId: PlayerId,
  resources: MutablePlayerState['resources'],
): void => {
  state.players = sortById(
    state.players.map((player) => (player.id === playerId ? { ...player, resources: { ...resources } } : player)),
  );
};

export const distance = (left: { readonly x: number; readonly y: number }, right: { readonly x: number; readonly y: number }): number =>
  Math.hypot(right.x - left.x, right.y - left.y);

export const serializeWorldState = (state: WorldState): WorldState => ({
  protocolVersion: state.protocolVersion,
  matchId: state.matchId,
  mapId: state.mapId,
  seed: state.seed,
  tick: state.tick,
  eventSequence: state.eventSequence,
  linkSequence: state.linkSequence,
  players: clonePlayers(state.players as readonly MutablePlayerState[]),
  sectors: cloneSectors(state.sectors as readonly MutableSectorState[]),
  nodes: cloneNodes(state.nodes as readonly MutableNodeState[]),
  links: cloneLinks(state.links as readonly MutableLinkState[]),
});

export const deserializeWorldState = (value: WorldState): WorldState =>
  serializeWorldState({
    protocolVersion: value.protocolVersion,
    matchId: value.matchId,
    mapId: value.mapId,
    seed: value.seed,
    tick: value.tick,
    eventSequence: value.eventSequence,
    linkSequence: value.linkSequence,
    players: value.players.map((player) => ({
      id: player.id,
      name: player.name,
      resources: { ...player.resources },
    })),
    sectors: value.sectors.map((sector) => ({
      id: sector.id,
      kind: sector.kind,
      owner: sector.owner,
      index: sector.index,
      label: sector.label,
      center: { ...sector.center },
      bounds: { ...sector.bounds },
      connectedSectorIds: [...sector.connectedSectorIds],
    })),
    nodes: value.nodes.map((node) => ({
      ...node,
      position: { ...node.position },
    })),
    links: value.links.map((link) => ({ ...link })),
  });

export const checksumWorldState = (state: WorldState): string => {
  const serialized = JSON.stringify(serializeWorldState(state));
  let hash = 0x811c9dc5;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index)!;
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, '0')}`;
};

const createSnapshotEnvelope = (state: WorldState): SnapshotEnvelope => ({
  protocolVersion: state.protocolVersion,
  tick: state.tick,
  checksum: checksumWorldState(state),
  state: serializeWorldState(state),
});
