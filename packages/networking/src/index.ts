import type {
  ProtocolVersion,
  SimulationCommand,
  SnapshotEnvelope,
  WorldState,
} from '@battlefly/shared-types';

export const NETWORK_PROTOCOL_VERSION = 1 as ProtocolVersion;

export interface CommandEnvelope {
  readonly kind: 'command';
  readonly protocolVersion: ProtocolVersion;
  readonly command: SimulationCommand;
}

export interface SnapshotEnvelopeWire {
  readonly kind: 'snapshot';
  readonly protocolVersion: ProtocolVersion;
  readonly snapshot: SnapshotEnvelope;
}

export interface AckEnvelope {
  readonly kind: 'ack';
  readonly protocolVersion: ProtocolVersion;
  readonly commandId: SimulationCommand['commandId'];
  readonly accepted: boolean;
  readonly reason?: string;
}

export interface TransportConnection {
  send(payload: string): void;
  close(): void;
}

export const encodeCommandEnvelope = (command: SimulationCommand): string =>
  JSON.stringify({
    kind: 'command',
    protocolVersion: NETWORK_PROTOCOL_VERSION,
    command,
  } satisfies CommandEnvelope);

export const encodeSnapshotEnvelope = (snapshot: SnapshotEnvelope): string =>
  JSON.stringify({
    kind: 'snapshot',
    protocolVersion: NETWORK_PROTOCOL_VERSION,
    snapshot,
  } satisfies SnapshotEnvelopeWire);

export const encodeAckEnvelope = (
  commandId: SimulationCommand['commandId'],
  accepted: boolean,
  reason?: string,
): string =>
  JSON.stringify({
    kind: 'ack',
    protocolVersion: NETWORK_PROTOCOL_VERSION,
    commandId,
    accepted,
    ...(reason ? { reason } : {}),
  } satisfies AckEnvelope);

export const decodeEnvelope = (payload: string): CommandEnvelope | SnapshotEnvelopeWire | AckEnvelope => {
  const parsed = JSON.parse(payload) as CommandEnvelope | SnapshotEnvelopeWire | AckEnvelope;
  return parsed;
};

export const isSnapshotStateCompatible = (snapshot: SnapshotEnvelope, state: WorldState): boolean =>
  snapshot.protocolVersion === state.protocolVersion && snapshot.checksum.length > 0;
