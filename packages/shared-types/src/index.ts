export type Brand<T, Name extends string> = T & { readonly __brand: Name };

export type ProtocolVersion = number;

export type PlayerId = Brand<string, 'PlayerId'>;
export type SectorId = Brand<string, 'SectorId'>;
export type NodeId = Brand<string, 'NodeId'>;
export type LinkId = Brand<string, 'LinkId'>;
export type CommandId = Brand<string, 'CommandId'>;
export type EventId = Brand<string, 'EventId'>;
export type MatchId = Brand<string, 'MatchId'>;

export interface Vector2 {
  readonly x: number;
  readonly y: number;
}

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export type SectorKind = 'home' | 'resource' | 'energy' | 'neutral' | 'frontier';
export type NodeType = 'command-core' | 'relay' | 'mine' | 'reactor' | 'shipyard';
export type LinkState = 'active' | 'overloaded' | 'damaged' | 'offline';
export type PowerState = 'powered' | 'unpowered';
export type CommandStatus = 'accepted' | 'rejected';

export type CommandRejectionReason =
  | 'protocol-version-mismatch'
  | 'duplicate-command'
  | 'wrong-player'
  | 'wrong-tick'
  | 'unknown-node'
  | 'unknown-link'
  | 'same-node'
  | 'not-owned'
  | 'sector-not-linked'
  | 'distance-too-long'
  | 'duplicate-link'
  | 'insufficient-matter'
  | 'link-state-invalid'
  | 'invalid-priority'
  | 'invalid-command';

export interface SimulationCommandBase {
  readonly commandId: CommandId;
  readonly playerId: PlayerId;
  readonly intendedTick: number;
  readonly protocolVersion: ProtocolVersion;
}

export interface CreateEnergyLinkCommand extends SimulationCommandBase {
  readonly type: 'create-energy-link';
  readonly payload: {
    readonly fromNodeId: NodeId;
    readonly toNodeId: NodeId;
  };
}

export interface RemoveEnergyLinkCommand extends SimulationCommandBase {
  readonly type: 'remove-energy-link';
  readonly payload: {
    readonly linkId: LinkId;
  };
}

export interface SetNodePriorityCommand extends SimulationCommandBase {
  readonly type: 'set-node-priority';
  readonly payload: {
    readonly nodeId: NodeId;
    readonly priority: number;
  };
}

export type SimulationCommand =
  | CreateEnergyLinkCommand
  | RemoveEnergyLinkCommand
  | SetNodePriorityCommand;

export interface SimulationCommandResultAccepted {
  readonly status: 'accepted';
  readonly commandId: CommandId;
  readonly events: readonly SimulationEvent[];
}

export interface SimulationCommandResultRejected {
  readonly status: 'rejected';
  readonly commandId: CommandId;
  readonly reason: CommandRejectionReason;
  readonly events: readonly [];
}

export type SimulationCommandResult = SimulationCommandResultAccepted | SimulationCommandResultRejected;

export interface SimulationEventBase {
  readonly eventId: EventId;
  readonly sequence: number;
  readonly tick: number;
  readonly type: string;
}

export interface LinkCreatedEvent extends SimulationEventBase {
  readonly type: 'link-created';
  readonly payload: {
    readonly linkId: LinkId;
    readonly fromNodeId: NodeId;
    readonly toNodeId: NodeId;
  };
}

export interface LinkRemovedEvent extends SimulationEventBase {
  readonly type: 'link-removed';
  readonly payload: {
    readonly linkId: LinkId;
  };
}

export interface NodePriorityChangedEvent extends SimulationEventBase {
  readonly type: 'node-priority-changed';
  readonly payload: {
    readonly nodeId: NodeId;
    readonly priority: number;
  };
}

export interface ResourceTickEvent extends SimulationEventBase {
  readonly type: 'resource-tick';
  readonly payload: {
    readonly playerId: PlayerId;
    readonly matterDelta: number;
    readonly energyDelta: number;
  };
}

export interface PowerResolvedEvent extends SimulationEventBase {
  readonly type: 'power-resolved';
  readonly payload: {
    readonly playerId: PlayerId;
    readonly poweredNodeIds: readonly NodeId[];
    readonly unpoweredNodeIds: readonly NodeId[];
  };
}

export type SimulationEvent =
  | LinkCreatedEvent
  | LinkRemovedEvent
  | NodePriorityChangedEvent
  | ResourceTickEvent
  | PowerResolvedEvent;

export interface PlayerResources {
  readonly matter: number;
  readonly energy: number;
}

export interface PlayerState {
  readonly id: PlayerId;
  readonly name: string;
  readonly resources: PlayerResources;
}

export interface SectorState {
  readonly id: SectorId;
  readonly kind: SectorKind;
  readonly owner: PlayerId | 'neutral';
  readonly index: number;
  readonly label: string;
  readonly center: Vector2;
  readonly bounds: Rect;
  readonly connectedSectorIds: readonly SectorId[];
}

export interface NodeState {
  readonly id: NodeId;
  readonly sectorId: SectorId;
  readonly owner: PlayerId;
  readonly type: NodeType;
  readonly position: Vector2;
  readonly priority: number;
  readonly powerState: PowerState;
  readonly networkSupply: number;
  readonly networkDemand: number;
  readonly matterDelta: number;
  readonly energyDelta: number;
  readonly hitPoints: number;
}

export interface LinkStateRecord {
  readonly id: LinkId;
  readonly owner: PlayerId;
  readonly fromNodeId: NodeId;
  readonly toNodeId: NodeId;
  readonly state: LinkState;
  readonly capacity: number;
  readonly integrity: number;
  readonly length: number;
  readonly matterCost: number;
}

export interface WorldState {
  readonly protocolVersion: ProtocolVersion;
  readonly matchId: MatchId;
  readonly mapId: string;
  readonly seed: number;
  readonly tick: number;
  readonly eventSequence: number;
  readonly linkSequence: number;
  readonly players: readonly PlayerState[];
  readonly sectors: readonly SectorState[];
  readonly nodes: readonly NodeState[];
  readonly links: readonly LinkStateRecord[];
}

export interface SnapshotEnvelope {
  readonly protocolVersion: ProtocolVersion;
  readonly tick: number;
  readonly checksum: string;
  readonly state: WorldState;
}
