import { describe, expect, it } from 'vitest';
import {
  createInitialWorldState,
  createSimulationRuntime,
  deserializeWorldState,
  serializeWorldState,
  checksumWorldState,
} from '../src/runtime.js';
import { createSnapshotEnvelope } from '../src/serialization.js';
import type { CommandId, CreateEnergyLinkCommand, LinkId, NodeId, RemoveEnergyLinkCommand } from '@battlefly/shared-types';
import { PLAYERS, TEST_LINK_CANDIDATES } from '@battlefly/game-rules';

const protocolVersion = 1;

const createLinkCommand = (commandId: string, fromNodeId: string, toNodeId: string): CreateEnergyLinkCommand => ({
  type: 'create-energy-link',
  commandId: commandId as CommandId,
  playerId: PLAYERS.alpha,
  intendedTick: 0,
  protocolVersion,
  payload: {
    fromNodeId: fromNodeId as NodeId,
    toNodeId: toNodeId as NodeId,
  },
});

const removeLinkCommand = (commandId: string, linkId: string, intendedTick = 0): RemoveEnergyLinkCommand => ({
  type: 'remove-energy-link',
  commandId: commandId as CommandId,
  playerId: PLAYERS.alpha,
  intendedTick,
  protocolVersion,
  payload: {
    linkId: linkId as LinkId,
  },
});

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
    expect(runtime.submit(createLinkCommand('command-2', fromNodeId, toNodeId)).status).toBe('rejected');
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

  it('advances deterministically through the runtime', () => {
    const left = createSimulationRuntime({ seed: 3 });
    const right = createSimulationRuntime({ seed: 3 });
    left.submit(createLinkCommand('command-1', ...TEST_LINK_CANDIDATES.alpha.coreToRelay));
    right.submit(createLinkCommand('command-1', ...TEST_LINK_CANDIDATES.alpha.coreToRelay));
    left.step(3);
    right.step(3);
    expect(checksumWorldState(left.state)).toBe(checksumWorldState(right.state));
  });

  it('keeps link and event sequences in the serialized state', () => {
    const runtime = createSimulationRuntime({ seed: 5 });
    expect(runtime.state.linkSequence).toBe(0);
    expect(runtime.state.eventSequence).toBe(0);
    runtime.submit(createLinkCommand('command-1', ...TEST_LINK_CANDIDATES.alpha.coreToRelay));
    expect(runtime.state.linkSequence).toBe(1);
    expect(runtime.state.eventSequence).toBeGreaterThan(0);
  });
});
