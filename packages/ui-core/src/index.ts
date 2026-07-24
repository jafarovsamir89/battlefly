import type {
  LinkStateRecord,
  NodeState,
  PlayerState,
  SectorState,
  WorldState,
} from '@battlefly/shared-types';

export interface HudPlayerViewModel {
  readonly id: PlayerState['id'];
  readonly name: string;
  readonly matter: number;
  readonly energy: number;
}

export interface NodeViewModel {
  readonly id: NodeState['id'];
  readonly label: string;
  readonly type: NodeState['type'];
  readonly powered: boolean;
  readonly owner: NodeState['owner'];
  readonly priority: number;
}

export interface LinkPreviewViewModel {
  readonly fromNodeId: NodeState['id'];
  readonly toNodeId: NodeState['id'] | null;
  readonly isValid: boolean;
  readonly matterCost: number;
}

export interface HudViewModel {
  readonly tick: number;
  readonly mapId: string;
  readonly players: readonly HudPlayerViewModel[];
  readonly selectedNode: NodeViewModel | null;
  readonly selectedSector: SectorState | null;
  readonly activeLinks: readonly LinkStateRecord[];
  readonly linkPreview: LinkPreviewViewModel | null;
}

const labelForNode = (node: NodeState): string => {
  switch (node.type) {
    case 'command-core':
      return 'Command Core';
    case 'relay':
      return 'Relay';
    case 'mine':
      return 'Mine';
    case 'reactor':
      return 'Reactor';
    case 'shipyard':
      return 'Shipyard';
  }
};

export const buildHudViewModel = (
  state: WorldState,
  selectedNodeId: NodeState['id'] | null,
  selectedSectorId: SectorState['id'] | null,
  linkPreview: LinkPreviewViewModel | null,
): HudViewModel => {
  const selectedNode = selectedNodeId ? state.nodes.find((node) => node.id === selectedNodeId) ?? null : null;
  const selectedSector = selectedSectorId ? state.sectors.find((sector) => sector.id === selectedSectorId) ?? null : null;
  return {
    tick: state.tick,
    mapId: state.mapId,
    players: state.players.map((player) => ({
      id: player.id,
      name: player.name,
      matter: player.resources.matter,
      energy: player.resources.energy,
    })),
    selectedNode: selectedNode
      ? {
          id: selectedNode.id,
          label: labelForNode(selectedNode),
          type: selectedNode.type,
          powered: selectedNode.powerState === 'powered',
          owner: selectedNode.owner,
          priority: selectedNode.priority,
        }
      : null,
    selectedSector,
    activeLinks: state.links,
    linkPreview,
  };
};

