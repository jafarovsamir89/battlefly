import { describe, expect, it } from 'vitest';
import { MISSION_DEADLINE_TICKS, PLAYERS, SECTOR_CAPTURE_REQUIRED_TICKS, TEST_LINK_CANDIDATES } from '@battlefly/game-rules';
import type {
  CommandId,
  CreateEnergyLinkCommand,
  LinkId,
  NodeId,
  PlayerId,
  RemoveEnergyLinkCommand,
  SectorId,
  MoveSquadronCommand,
  QueueSquadronProductionCommand,
  SquadronId,
} from '@battlefly/shared-types';
import {
  checksumWorldState,
  createInitialWorldState,
  createSimulationRuntime,
  createSimulationRuntimeFromSnapshot,
  deserializeWorldState,
  findSectorRoute,
  isSectorSupplied,
  serializeWorldState,
} from '../src/runtime.js';
import { createSnapshotEnvelope, deserializeSnapshot, serializeSnapshot } from '../src/serialization.js';

const protocolVersion = 1;

type WorldStateSnapshot = ReturnType<typeof createInitialWorldState>;

type MutablePlayerState = Omit<WorldStateSnapshot['players'][number], 'resources'> & {
  resources: {
    matter: number;
    energy: number;
  };
};

type MutableSectorState = Omit<WorldStateSnapshot['sectors'][number], 'connectedSectorIds'> & {
  connectedSectorIds: SectorId[];
};

type MutableWorldState = Omit<WorldStateSnapshot, 'players' | 'sectors' | 'nodes' | 'links'> & {
  players: MutablePlayerState[];
  sectors: MutableSectorState[];
  nodes: WorldStateSnapshot['nodes'][number][];
  links: WorldStateSnapshot['links'][number][];
};

const createLinkCommand = (
  commandId: string,
  fromNodeId: string,
  toNodeId: string,
  intendedTick = 0,
  playerId: PlayerId = PLAYERS.alpha,
): CreateEnergyLinkCommand => ({
  type: 'create-energy-link',
  commandId: commandId as CommandId,
  playerId,
  intendedTick,
  protocolVersion,
  payload: {
    fromNodeId: fromNodeId as NodeId,
    toNodeId: toNodeId as NodeId,
  },
});

const createQueueProductionCommand = (
  commandId: string,
  shipyardNodeId: string,
  intendedTick = 0,
  playerId: PlayerId = PLAYERS.alpha,
): QueueSquadronProductionCommand => ({
  type: 'queue-squadron-production',
  commandId: commandId as CommandId,
  playerId,
  intendedTick,
  protocolVersion,
  payload: {
    shipyardNodeId: shipyardNodeId as NodeId,
    squadronType: 'scout',
  },
});

const createMoveSquadronCommand = (
  commandId: string,
  squadronId: string,
  destinationSectorId: string,
  intendedTick = 0,
  playerId: PlayerId = PLAYERS.alpha,
): MoveSquadronCommand => ({
  type: 'move-squadron',
  commandId: commandId as CommandId,
  playerId,
  intendedTick,
  protocolVersion,
  payload: {
    squadronId: squadronId as SquadronId,
    destinationSectorId: destinationSectorId as SectorId,
  },
});

const removeLinkCommand = (
  commandId: string,
  linkId: string,
  intendedTick = 0,
  playerId: PlayerId = PLAYERS.alpha,
): RemoveEnergyLinkCommand => ({
  type: 'remove-energy-link',
  commandId: commandId as CommandId,
  playerId,
  intendedTick,
  protocolVersion,
  payload: {
    linkId: linkId as LinkId,
  },
});

const cloneState = <T>(value: T): T => structuredClone(value);

const reverseCanonicalOrder = (state: WorldStateSnapshot): WorldStateSnapshot => {
  const cloned = cloneState(state) as unknown as MutableWorldState;
  const mutable = cloned as unknown as {
    players: MutablePlayerState[];
    sectors: MutableSectorState[];
    nodes: WorldStateSnapshot['nodes'][number][];
    links: WorldStateSnapshot['links'][number][];
    squadrons: WorldStateSnapshot['squadrons'][number][];
    productionOrders: WorldStateSnapshot['productionOrders'][number][];
  };
  mutable.players.reverse();
  mutable.sectors.reverse();
  mutable.nodes.reverse();
  mutable.links.reverse();
  mutable.squadrons.reverse();
  mutable.productionOrders.reverse();
  for (const sector of mutable.sectors) {
    sector.connectedSectorIds = [...sector.connectedSectorIds].reverse();
  }
  return mutable as unknown as WorldStateSnapshot;
};

const createLowMatterRuntime = () => {
  const initialState = cloneState(createInitialWorldState({ seed: 1 })) as unknown as MutableWorldState;
  initialState.players.find((player) => player.id === PLAYERS.alpha)!.resources.matter = 0;
  return createSimulationRuntime({ initialState });
};

const createDisconnectedRuntime = () => {
  const initialState = cloneState(createInitialWorldState({ seed: 1 })) as unknown as MutableWorldState;
  const alphaCoreSector = initialState.sectors.find((sector) => sector.id === 'sector-alpha-core')!;
  alphaCoreSector.connectedSectorIds = [];
  return createSimulationRuntime({ initialState });
};

const createPoweredShipyardRuntime = () => {
  const runtime = createSimulationRuntime({ seed: 1 });
  expect(runtime.submit(createLinkCommand('power-link', ...TEST_LINK_CANDIDATES.alpha.coreToShipyard)).status).toBe('accepted');
  runtime.step(1);
  return runtime;
};

const expectStateUnchanged = (
  runtime: ReturnType<typeof createSimulationRuntime>,
  command: CreateEnergyLinkCommand | RemoveEnergyLinkCommand,
  reason: string,
): void => {
  const before = serializeWorldState(runtime.state);
  const result = runtime.submit(command);
  expect(result.status).toBe('rejected');
  if (result.status === 'rejected') {
    expect(result.reason).toBe(reason);
  }
  expect(result.events).toHaveLength(0);
  expect(serializeWorldState(runtime.state)).toEqual(before);
  expect(checksumWorldState(runtime.state)).toBe(checksumWorldState(before));
  expect(runtime.state.linkSequence).toBe(before.linkSequence);
};

describe('deterministic simulation', () => {
  it('keeps checksum stable for identical world state', () => {
    const left = createInitialWorldState({ seed: 7 });
    const right = createInitialWorldState({ seed: 7 });
    expect(checksumWorldState(left)).toBe(checksumWorldState(right));
    expect(serializeWorldState(left)).toEqual(serializeWorldState(right));
  });

  it('supports serialize and deserialize without loss', () => {
    const world = createInitialWorldState({ seed: 9 });
    const encoded = serializeWorldState(world);
    const decoded = deserializeWorldState(encoded);
    expect(decoded).toEqual(encoded);
    expect(createSnapshotEnvelope(world).checksum).toBe(checksumWorldState(decoded));
  });

  it('creates a valid energy link and spends matter once', () => {
    const runtime = createSimulationRuntime({ seed: 1 });
    const before = runtime.state.players.find((player) => player.id === PLAYERS.alpha)!;
    const [fromNodeId, toNodeId] = TEST_LINK_CANDIDATES.alpha.coreToRelay;
    const result = runtime.submit(createLinkCommand('command-1', fromNodeId, toNodeId));
    expect(result.status).toBe('accepted');
    expect(runtime.state.links).toHaveLength(1);
    expect(runtime.state.players.find((player) => player.id === PLAYERS.alpha)!.resources.matter).toBe(
      before.resources.matter - 12,
    );
    const duplicateResult = runtime.submit(createLinkCommand('command-2', fromNodeId, toNodeId));
    expect(duplicateResult.status).toBe('rejected');
    if (duplicateResult.status === 'rejected') {
      expect(duplicateResult.reason).toBe('duplicate-link');
    }
  });

  it('applies a current-tick command immediately', () => {
    const runtime = createSimulationRuntime({ seed: 1 });
    const [fromNodeId, toNodeId] = TEST_LINK_CANDIDATES.alpha.coreToRelay;
    expect(runtime.state.tick).toBe(0);
    const result = runtime.submit(createLinkCommand('command-1', fromNodeId, toNodeId));
    expect(result.status).toBe('accepted');
    expect(runtime.state.links).toHaveLength(1);
    expect(runtime.state.linkSequence).toBe(1);
  });

  it('applies future commands at the beginning of their tick', () => {
    const runtime = createSimulationRuntime({ seed: 1 });
    const baseline = createSimulationRuntime({ seed: 1 });
    const [fromNodeId, toNodeId] = TEST_LINK_CANDIDATES.alpha.coreToRelay;

    const command = createLinkCommand('command-1', fromNodeId, toNodeId, 2);
    const submitResult = runtime.submit(command);
    expect(submitResult.status).toBe('accepted');
    expect(serializeWorldState(runtime.state)).toEqual(serializeWorldState(baseline.state));

    runtime.step(1);
    baseline.step(1);
    expect(serializeWorldState(runtime.state)).toEqual(serializeWorldState(baseline.state));

    runtime.step(1);
    baseline.step(1);
    expect(runtime.state.tick).toBe(2);
    expect(runtime.state.links).toHaveLength(0);
    expect(runtime.state.linkSequence).toBe(0);

    runtime.step(1);
    baseline.step(1);
    expect(runtime.state.tick).toBe(3);
    expect(runtime.state.links).toHaveLength(1);
    expect(runtime.state.linkSequence).toBe(1);
    expect(serializeWorldState(runtime.state)).not.toEqual(serializeWorldState(baseline.state));
  });

  it('rejects commands from the past', () => {
    const runtime = createSimulationRuntime({ seed: 1 });
    runtime.step(2);
    const [fromNodeId, toNodeId] = TEST_LINK_CANDIDATES.alpha.coreToRelay;
    const result = runtime.submit(createLinkCommand('command-1', fromNodeId, toNodeId, 1));
    expect(result.status).toBe('rejected');
    if (result.status === 'rejected') {
      expect(result.reason).toBe('wrong-tick');
    }
    expect(runtime.state.tick).toBe(2);
    expect(runtime.state.links).toHaveLength(0);
  });

  it('keeps command order deterministic for equal future ticks', () => {
    const left = createSimulationRuntime({ seed: 1 });
    const right = createSimulationRuntime({ seed: 1 });
    const firstCommand = createLinkCommand('command-b', ...TEST_LINK_CANDIDATES.alpha.relayToMine, 2);
    const secondCommand = createLinkCommand('command-a', ...TEST_LINK_CANDIDATES.alpha.coreToRelay, 2);

    expect(left.submit(firstCommand).status).toBe('accepted');
    expect(left.submit(secondCommand).status).toBe('accepted');
    expect(right.submit(secondCommand).status).toBe('accepted');
    expect(right.submit(firstCommand).status).toBe('accepted');

    const leftEvents = [...left.step(3)];
    const rightEvents = [...right.step(3)];

    expect(left.state).toEqual(right.state);
    expect(leftEvents).toEqual(rightEvents);
    expect(checksumWorldState(left.state)).toBe(checksumWorldState(right.state));
  });

  it('uses monotonic link ids even after removals', () => {
    const runtime = createSimulationRuntime({ seed: 1 });
    const [firstFromNodeId, firstToNodeId] = TEST_LINK_CANDIDATES.alpha.coreToRelay;
    const [secondFromNodeId, secondToNodeId] = TEST_LINK_CANDIDATES.alpha.relayToMine;

    expect(runtime.submit(createLinkCommand('command-1', firstFromNodeId, firstToNodeId)).status).toBe('accepted');
    const firstLinkId = runtime.state.links[0]!.id;
    expect(firstLinkId).toBe('link-000001');

    expect(runtime.submit(removeLinkCommand('command-2', firstLinkId)).status).toBe('accepted');
    expect(runtime.state.links).toHaveLength(0);

    expect(runtime.submit(createLinkCommand('command-3', secondFromNodeId, secondToNodeId)).status).toBe('accepted');
    expect(runtime.state.links[0]!.id).toBe('link-000002');
  });

  it('supports snapshot continuation without resetting sequences', () => {
    const runtime = createSimulationRuntime({ seed: 1 });
    const control = createSimulationRuntime({ seed: 1 });

    const firstResult = runtime.submit(createLinkCommand('command-1', ...TEST_LINK_CANDIDATES.alpha.coreToRelay));
    const controlFirstResult = control.submit(createLinkCommand('command-1', ...TEST_LINK_CANDIDATES.alpha.coreToRelay));
    expect(firstResult.status).toBe('accepted');
    expect(controlFirstResult.status).toBe('accepted');
    if (firstResult.status === 'accepted' && controlFirstResult.status === 'accepted') {
      expect(firstResult.events[0]?.eventId).toBe('event-1');
      expect(controlFirstResult.events[0]?.eventId).toBe(firstResult.events[0]?.eventId);
    }

    const snapshot = runtime.snapshot();
    const snapshotCopy = cloneState(snapshot);
    const serialized = serializeSnapshot(snapshot.state);
    const restoredSnapshot = deserializeSnapshot(serialized);
    expect(snapshot).toEqual(snapshotCopy);
    expect(restoredSnapshot.state.linkSequence).toBe(1);
    expect(restoredSnapshot.state.eventSequence).toBe(1);

    const restored = createSimulationRuntimeFromSnapshot(restoredSnapshot);
    const continuationCommand = createLinkCommand('command-2', ...TEST_LINK_CANDIDATES.alpha.relayToMine);
    const restoredResult = restored.submit(continuationCommand);
    const controlResult = control.submit(createLinkCommand('command-2', ...TEST_LINK_CANDIDATES.alpha.relayToMine));

    expect(restoredResult.status).toBe('accepted');
    expect(controlResult.status).toBe('accepted');
    if (restoredResult.status === 'accepted' && controlResult.status === 'accepted') {
      expect(restoredResult.events[0]?.eventId).toBe(controlResult.events[0]?.eventId);
    }
    expect(restored.state.linkSequence).toBe(2);
    expect(restored.state.eventSequence).toBe(snapshot.state.eventSequence + 1);
    expect(checksumWorldState(restored.state)).toBe(checksumWorldState(control.state));
  });

  it('keeps checksum stable when input arrays are permuted', () => {
    const original = createInitialWorldState({ seed: 11 });
    const shuffled = reverseCanonicalOrder(original);
    expect(checksumWorldState(shuffled)).toBe(checksumWorldState(original));
    expect(serializeWorldState(shuffled)).toEqual(serializeWorldState(original));
  });

  it('keeps event ids unique across ticks and snapshot restore', () => {
    const runtime = createSimulationRuntime({ seed: 1 });
    const seenEventIds = new Set<string>();
    const recordEvents = (events: readonly { readonly eventId: string }[]): void => {
      for (const event of events) {
        expect(seenEventIds.has(event.eventId)).toBe(false);
        seenEventIds.add(event.eventId);
      }
    };

    recordEvents(runtime.submit(createLinkCommand('command-1', ...TEST_LINK_CANDIDATES.alpha.coreToRelay)).events);
    recordEvents(runtime.step(1));
    const linkId = runtime.state.links[0]!.id;
    recordEvents(runtime.submit(removeLinkCommand('command-2', linkId, runtime.state.tick)).events);
    recordEvents(runtime.step(1));

    const snapshot = runtime.snapshot();
    const restored = createSimulationRuntimeFromSnapshot(snapshot);
    const restoredResult = restored.submit(
      createLinkCommand('command-3', ...TEST_LINK_CANDIDATES.alpha.relayToMine, snapshot.state.tick),
    );

    expect(restoredResult.status).toBe('accepted');
    if (restoredResult.status === 'accepted') {
      recordEvents(restoredResult.events);
      expect(restoredResult.events[0]?.eventId).toBe(`event-${snapshot.state.eventSequence + 1}`);
    }
    expect(seenEventIds.size).toBeGreaterThan(0);
    expect(restored.state.eventSequence).toBe(snapshot.state.eventSequence + 1);
  });

  it('rejects duplicate command delivery before and after execution', () => {
    const runtime = createSimulationRuntime({ seed: 1 });
    const command = createLinkCommand('command-dup', ...TEST_LINK_CANDIDATES.alpha.coreToRelay, 2);

    const firstResult = runtime.submit(command);
    expect(firstResult.status).toBe('accepted');
    const duplicateWhileQueued = runtime.submit(createLinkCommand('command-dup', ...TEST_LINK_CANDIDATES.alpha.coreToRelay, 2));
    expect(duplicateWhileQueued.status).toBe('rejected');
    if (duplicateWhileQueued.status === 'rejected') {
      expect(duplicateWhileQueued.reason).toBe('duplicate-command');
    }

    runtime.step(3);
    expect(runtime.state.links).toHaveLength(1);

    const duplicateAfterExecution = runtime.submit(createLinkCommand('command-dup', ...TEST_LINK_CANDIDATES.alpha.coreToRelay, 2));
    expect(duplicateAfterExecution.status).toBe('rejected');
    if (duplicateAfterExecution.status === 'rejected') {
      expect(duplicateAfterExecution.reason).toBe('duplicate-command');
    }
    expect(runtime.state.links).toHaveLength(1);
  });

  it('rejects invalid create-energy-link commands without mutating state', () => {
    expectStateUnchanged(
      createSimulationRuntime({ seed: 1 }),
      createLinkCommand('command-same-node', 'alpha-core', 'alpha-core'),
      'same-node',
    );

    expectStateUnchanged(
      createSimulationRuntime({ seed: 1 }),
      createLinkCommand('command-unknown-node', 'alpha-core', 'node-missing'),
      'unknown-node',
    );

    expectStateUnchanged(
      createSimulationRuntime({ seed: 1 }),
      createLinkCommand('command-not-owned', 'alpha-core', 'omega-core'),
      'not-owned',
    );

    expectStateUnchanged(
      createDisconnectedRuntime(),
      createLinkCommand('command-sector-link', 'alpha-core', 'alpha-relay'),
      'sector-not-linked',
    );

    expectStateUnchanged(
      createSimulationRuntime({ seed: 1 }),
      createLinkCommand('command-too-long', 'alpha-relay', 'alpha-reactor'),
      'distance-too-long',
    );

    expectStateUnchanged(
      createLowMatterRuntime(),
      createLinkCommand('command-low-matter', ...TEST_LINK_CANDIDATES.alpha.coreToRelay),
      'insufficient-matter',
    );
  });

  it('rejects invalid remove-energy-link commands without mutating state', () => {
    expectStateUnchanged(
      createSimulationRuntime({ seed: 1 }),
      removeLinkCommand('missing-link', 'link-999999'),
      'unknown-link',
    );

    const foreignOwnerRuntime = createSimulationRuntime({ seed: 1 });
    foreignOwnerRuntime.submit(createLinkCommand('command-1', ...TEST_LINK_CANDIDATES.alpha.coreToRelay));
    const ownedLinkId = foreignOwnerRuntime.state.links[0]!.id;
    expectStateUnchanged(
      foreignOwnerRuntime,
      removeLinkCommand('wrong-owner', ownedLinkId, 0, PLAYERS.omega),
      'not-owned',
    );

    const repeatDeleteRuntime = createSimulationRuntime({ seed: 1 });
    repeatDeleteRuntime.submit(createLinkCommand('command-1', ...TEST_LINK_CANDIDATES.alpha.coreToRelay));
    const existingLinkId = repeatDeleteRuntime.state.links[0]!.id;
    expect(repeatDeleteRuntime.submit(removeLinkCommand('remove-1', existingLinkId)).status).toBe('accepted');
    expectStateUnchanged(repeatDeleteRuntime, removeLinkCommand('remove-2', existingLinkId), 'unknown-link');
  });

  it('rejects links to enemy nodes', () => {
    const runtime = createSimulationRuntime({ seed: 1 });
    const [fromNodeId] = TEST_LINK_CANDIDATES.alpha.coreToRelay;
    const [, toNodeId] = TEST_LINK_CANDIDATES.omega.coreToRelay;
    const result = runtime.submit(createLinkCommand('command-3', fromNodeId, toNodeId));
    expect(result.status).toBe('rejected');
    if (result.status === 'rejected') {
      expect(result.reason).toBe('not-owned');
    }
  });

  it('powers a mine when the network is connected', () => {
    const runtime = createSimulationRuntime({ seed: 1 });
    runtime.submit(createLinkCommand('command-1', ...TEST_LINK_CANDIDATES.alpha.coreToRelay));
    runtime.submit(createLinkCommand('command-2', ...TEST_LINK_CANDIDATES.alpha.relayToMine));
    runtime.submit(createLinkCommand('command-3', ...TEST_LINK_CANDIDATES.alpha.mineToReactor));
    const matterBeforeTick = runtime.state.players.find((player) => player.id === PLAYERS.alpha)!.resources.matter;
    runtime.step(1);
    const alphaMine = runtime.state.nodes.find((node) => node.id === 'alpha-mine')!;
    expect(alphaMine.powerState).toBe('powered');
    const alphaPlayer = runtime.state.players.find((player) => player.id === PLAYERS.alpha)!;
    expect(alphaPlayer.resources.matter).toBe(matterBeforeTick + 4);
  });

  it('disconnects a remote mine after removing the key link', () => {
    const runtime = createSimulationRuntime({ seed: 1 });
    runtime.submit(createLinkCommand('command-1', ...TEST_LINK_CANDIDATES.alpha.coreToRelay));
    runtime.submit(createLinkCommand('command-2', ...TEST_LINK_CANDIDATES.alpha.relayToMine));
    runtime.step(1);
    const linkId = runtime.state.links.find((link) =>
      link.fromNodeId === ('alpha-relay' as NodeId) && link.toNodeId === ('alpha-mine' as NodeId),
    )!.id;
    const removeResult = runtime.submit(removeLinkCommand('command-4', linkId, runtime.state.tick));
    expect(removeResult.status).toBe('accepted');
    runtime.step(1);
    expect(runtime.state.nodes.find((node) => node.id === 'alpha-mine')!.powerState).toBe('unpowered');
  });

  it('finds deterministic sector routes with ordinal tie-breaking', () => {
    const runtime = createSimulationRuntime({ seed: 1 });
    const route = findSectorRoute(runtime.state.sectors, 'sector-alpha-core' as SectorId, 'sector-alpha-reactor' as SectorId);
    expect(route).toEqual([
      'sector-alpha-core',
      'sector-alpha-relay',
      'sector-alpha-reactor',
    ]);
  });

  it('queues and completes scout production on a powered shipyard', () => {
    const runtime = createPoweredShipyardRuntime();
    const matterBefore = runtime.state.players.find((player) => player.id === PLAYERS.alpha)!.resources.matter;
    const queueResult = runtime.submit(createQueueProductionCommand('production-1', 'alpha-shipyard', runtime.state.tick));
    expect(queueResult.status).toBe('accepted');
    expect(runtime.state.productionOrders).toHaveLength(1);
    expect(runtime.state.productionOrders[0]!.status).toBe('building');
    expect(runtime.state.players.find((player) => player.id === PLAYERS.alpha)!.resources.matter).toBe(matterBefore - 8);

    runtime.step(5);
    expect(runtime.state.productionOrders).toHaveLength(0);
    expect(runtime.state.squadrons).toHaveLength(1);
    expect(runtime.state.squadrons[0]!.id).toBe('squadron-000001');
    expect(runtime.state.squadrons[0]!.sectorId).toBe('sector-alpha-core');
    expect(runtime.state.squadrons[0]!.status).toBe('idle');
  });

  it('moves squadrons deterministically and regenerates energy only in supplied sectors', () => {
    const runtime = createPoweredShipyardRuntime();
    runtime.submit(createQueueProductionCommand('production-1', 'alpha-shipyard', runtime.state.tick));
    runtime.step(5);
    const squadronId = runtime.state.squadrons[0]!.id;

    const moveToMine = runtime.submit(createMoveSquadronCommand('move-1', squadronId, 'sector-alpha-mine', runtime.state.tick));
    expect(moveToMine.status).toBe('accepted');
    expect(runtime.state.squadrons[0]!.status).toBe('moving');

    runtime.step(4);
    expect(runtime.state.squadrons[0]!.sectorId).toBe('sector-alpha-mine');
    expect(runtime.state.squadrons[0]!.status).toBe('idle');
    expect(runtime.state.squadrons[0]!.energy).toBe(10);
    expect(isSectorSupplied(runtime.state, PLAYERS.alpha, 'sector-alpha-mine' as SectorId)).toBe(false);

    runtime.step(2);
    expect(runtime.state.squadrons[0]!.energy).toBe(10);

    const moveBack = runtime.submit(createMoveSquadronCommand('move-2', squadronId, 'sector-alpha-core', runtime.state.tick));
    expect(moveBack.status).toBe('accepted');
    runtime.step(4);
    expect(runtime.state.squadrons[0]!.sectorId).toBe('sector-alpha-core');
    expect(runtime.state.squadrons[0]!.status).toBe('idle');
    expect(runtime.state.squadrons[0]!.energy).toBe(8);
    runtime.step(2);
    expect(runtime.state.squadrons[0]!.energy).toBe(10);
    expect(isSectorSupplied(runtime.state, PLAYERS.alpha, 'sector-alpha-core' as SectorId)).toBe(true);
  });

  it('rejects invalid squadron commands without mutating state', () => {
    const runtime = createPoweredShipyardRuntime();
    runtime.submit(createQueueProductionCommand('production-1', 'alpha-shipyard', runtime.state.tick));
    runtime.step(5);
    const squadronId = runtime.state.squadrons[0]!.id;
    const before = serializeWorldState(runtime.state);

    const unknownSquadron = runtime.submit(createMoveSquadronCommand('move-unknown', 'squadron-missing', 'sector-alpha-mine', runtime.state.tick));
    expect(unknownSquadron.status).toBe('rejected');
    if (unknownSquadron.status === 'rejected') {
      expect(unknownSquadron.reason).toBe('unknown-squadron');
    }
    expect(serializeWorldState(runtime.state)).toEqual(before);

    const alreadyThere = runtime.submit(createMoveSquadronCommand('move-same', squadronId, 'sector-alpha-core', runtime.state.tick));
    expect(alreadyThere.status).toBe('rejected');
    if (alreadyThere.status === 'rejected') {
      expect(alreadyThere.reason).toBe('already-in-sector');
    }

    const moveAccepted = runtime.submit(createMoveSquadronCommand('move-busy', squadronId, 'sector-alpha-mine', runtime.state.tick));
    expect(moveAccepted.status).toBe('accepted');
    const busyReject = runtime.submit(createMoveSquadronCommand('move-busy-2', squadronId, 'sector-alpha-core', runtime.state.tick));
    expect(busyReject.status).toBe('rejected');
    if (busyReject.status === 'rejected') {
      expect(busyReject.reason).toBe('squadron-busy');
    }
  });

  it('supports snapshot continuation for building production and moving squadrons', () => {
    const runtime = createPoweredShipyardRuntime();
    const control = createPoweredShipyardRuntime();
    runtime.submit(createQueueProductionCommand('production-1', 'alpha-shipyard', runtime.state.tick));
    control.submit(createQueueProductionCommand('production-1', 'alpha-shipyard', control.state.tick));
    runtime.step(5);
    control.step(5);
    const createdSquadronId = runtime.state.squadrons[0]!.id;
    const moveResult = runtime.submit(createMoveSquadronCommand('move-1', createdSquadronId, 'sector-alpha-mine', runtime.state.tick));
    const controlMoveResult = control.submit(createMoveSquadronCommand('move-1', createdSquadronId, 'sector-alpha-mine', control.state.tick));
    expect(moveResult.status).toBe('accepted');
    expect(controlMoveResult.status).toBe('accepted');

    runtime.step(2);
    control.step(2);

    const snapshot = runtime.snapshot();
    const restored = createSimulationRuntimeFromSnapshot(snapshot);
    const restoredControl = createSimulationRuntimeFromSnapshot(control.snapshot());

    restored.step(2);
    restoredControl.step(2);

    expect(restored.state).toEqual(restoredControl.state);
    expect(checksumWorldState(restored.state)).toBe(checksumWorldState(restoredControl.state));
  });

  it('captures the objective sector and completes the mission deterministically', () => {
    const runtime = createPoweredShipyardRuntime();
    runtime.submit(createQueueProductionCommand('production-capture', 'alpha-shipyard', runtime.state.tick));
    runtime.step(4);
    const squadronId = runtime.state.squadrons[0]!.id;

    const move = runtime.submit(
      createMoveSquadronCommand('move-objective', squadronId, 'sector-center-west', runtime.state.tick),
    );
    expect(move.status).toBe('accepted');
    runtime.step(8);
    expect(runtime.state.squadrons[0]!.sectorId).toBe('sector-center-west');

    const captureEvents = runtime.step(SECTOR_CAPTURE_REQUIRED_TICKS);
    expect(runtime.state.sectors.find((sector) => sector.id === 'sector-center-west')!.owner).toBe(PLAYERS.alpha);
    expect(runtime.state.mission.status).toBe('victory');
    expect(captureEvents.some((event) => event.type === 'sector-captured')).toBe(true);
    expect(captureEvents.some((event) => event.type === 'mission-completed')).toBe(true);
  });

  it('loses the mission when the deterministic deadline expires', () => {
    const runtime = createSimulationRuntime({ seed: 1 });
    const events = runtime.step(MISSION_DEADLINE_TICKS);

    expect(runtime.state.tick).toBe(MISSION_DEADLINE_TICKS);
    expect(runtime.state.mission.status).toBe('defeat');
    expect(events.filter((event) => event.type === 'mission-completed')).toHaveLength(1);
  });
});
