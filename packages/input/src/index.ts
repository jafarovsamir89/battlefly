import type { NodeId, SectorId } from '@battlefly/shared-types';

export type InputDeviceKind = 'mouse' | 'touch' | 'gamepad' | 'tv-remote';

export type BattleInputIntent =
  | { readonly type: 'select-sector'; readonly sectorId: SectorId }
  | { readonly type: 'select-node'; readonly nodeId: NodeId }
  | { readonly type: 'pan-camera'; readonly deltaX: number; readonly deltaY: number }
  | { readonly type: 'zoom-camera'; readonly zoomDelta: number }
  | { readonly type: 'begin-link'; readonly nodeId: NodeId }
  | { readonly type: 'preview-link'; readonly nodeId: NodeId | null }
  | { readonly type: 'confirm-link'; readonly fromNodeId: NodeId; readonly toNodeId: NodeId }
  | { readonly type: 'cancel-action' }
  | { readonly type: 'focus-next-object' }
  | { readonly type: 'focus-previous-object' }
  | { readonly type: 'confirm' }
  | { readonly type: 'back' };

export interface LinkInteractionState {
  readonly sourceNodeId: NodeId | null;
  readonly hoveredNodeId: NodeId | null;
  readonly previewTargetNodeId: NodeId | null;
  readonly isActive: boolean;
}

export interface FocusNavigationState {
  readonly orderedNodeIds: readonly NodeId[];
  readonly focusedIndex: number;
}

export const createLinkInteractionState = (): LinkInteractionState => ({
  sourceNodeId: null,
  hoveredNodeId: null,
  previewTargetNodeId: null,
  isActive: false,
});

export const beginLinkInteraction = (_state: LinkInteractionState, nodeId: NodeId): LinkInteractionState => ({
  sourceNodeId: nodeId,
  hoveredNodeId: nodeId,
  previewTargetNodeId: null,
  isActive: true,
});

export const updateLinkPreview = (state: LinkInteractionState, nodeId: NodeId | null): LinkInteractionState => ({
  ...state,
  hoveredNodeId: nodeId,
  previewTargetNodeId: state.isActive ? nodeId : null,
});

export const finishLinkInteraction = (
  state: LinkInteractionState,
  nodeId: NodeId | null,
): { readonly nextState: LinkInteractionState; readonly intent: BattleInputIntent | null } => {
  if (!state.isActive || !state.sourceNodeId || !nodeId || state.sourceNodeId === nodeId) {
    return {
      nextState: createLinkInteractionState(),
      intent: null,
    };
  }
  return {
    nextState: createLinkInteractionState(),
    intent: {
      type: 'confirm-link',
      fromNodeId: state.sourceNodeId,
      toNodeId: nodeId,
    },
  };
};

export const createFocusNavigationState = (orderedNodeIds: readonly NodeId[]): FocusNavigationState => ({
  orderedNodeIds,
  focusedIndex: orderedNodeIds.length > 0 ? 0 : -1,
});

export const moveFocus = (
  state: FocusNavigationState,
  direction: 1 | -1,
): FocusNavigationState => {
  if (state.orderedNodeIds.length === 0) {
    return state;
  }
  const nextIndex = (state.focusedIndex + direction + state.orderedNodeIds.length) % state.orderedNodeIds.length;
  return {
    ...state,
    focusedIndex: nextIndex,
  };
};

export const focusedNodeId = (state: FocusNavigationState): NodeId | null => {
  if (state.focusedIndex < 0) {
    return null;
  }
  return state.orderedNodeIds[state.focusedIndex] ?? null;
};
