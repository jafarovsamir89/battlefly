import type { SnapshotEnvelope, WorldState } from '@battlefly/shared-types';
import { checksumWorldState, deserializeWorldState, serializeWorldState } from './state.js';

export const createSnapshotEnvelope = (state: WorldState): SnapshotEnvelope => ({
  protocolVersion: state.protocolVersion,
  tick: state.tick,
  checksum: checksumWorldState(state),
  state: serializeWorldState(state),
});

export const serializeSnapshot = (state: WorldState): string => JSON.stringify(createSnapshotEnvelope(state));

export const deserializeSnapshot = (payload: string): SnapshotEnvelope => {
  const parsed = JSON.parse(payload) as SnapshotEnvelope;
  return {
    ...parsed,
    state: deserializeWorldState(parsed.state),
  };
};

