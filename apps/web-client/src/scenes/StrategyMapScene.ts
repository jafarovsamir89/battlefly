import Phaser from 'phaser';
import {
  FIXED_TIMESTEP_MS,
  PLAYERS,
  SECTOR_CAPTURE_REQUIRED_TICKS,
} from '../../../../packages/game-rules/src/index.js';
import {
  createFocusNavigationState,
  createLinkInteractionState,
  finishLinkInteraction,
  focusedNodeId,
  moveFocus,
  updateLinkPreview,
} from '../../../../packages/input/src/index.js';
import { createSimulationRuntime } from '../../../../packages/simulation/src/index.js';
import type {
  MoveSquadronCommand,
  NodeId,
  NodeState,
  QueueSquadronProductionCommand,
  SectorId,
  SectorState,
  SimulationCommand,
  SquadronId,
  SquadronState,
} from '../../../../packages/shared-types/src/index.js';
import { buildHudViewModel } from '../../../../packages/ui-core/src/index.js';

const PLAYER_ID = PLAYERS.alpha;

const createCommandId = (prefix: string, counter: number): SimulationCommand['commandId'] =>
  `${prefix}-${counter}` as SimulationCommand['commandId'];

export class StrategyMapScene extends Phaser.Scene {
  private runtime = createSimulationRuntime({ seed: 1 });
  private accumulator = 0;
  private commandCounter = 0;
  private selectedNodeId: NodeId | null = null;
  private selectedSectorId: SectorState['id'] | null = null;
  private selectedSquadronId: SquadronId | null = null;
  private hoveredSectorId: SectorId | null = null;
  private linkState = createLinkInteractionState();
  private focusState = createFocusNavigationState([]);
  private backgroundGraphics!: Phaser.GameObjects.Graphics;
  private sectorGraphics!: Phaser.GameObjects.Graphics;
  private linkGraphics!: Phaser.GameObjects.Graphics;
  private previewGraphics!: Phaser.GameObjects.Graphics;
  private squadronGraphics = new Map<SquadronId, Phaser.GameObjects.Arc>();
  private squadronLabels = new Map<SquadronId, Phaser.GameObjects.Text>();
  private nodeGraphics = new Map<NodeId, Phaser.GameObjects.Arc>();
  private nodeLabels = new Map<NodeId, Phaser.GameObjects.Text>();
  private statusText!: Phaser.GameObjects.Text;
  private fitButton!: HTMLButtonElement | null;
  private cancelButton!: HTMLButtonElement | null;
  private queueScoutButton!: HTMLButtonElement | null;
  private moveSquadronButton!: HTMLButtonElement | null;
  private restartMissionButton!: HTMLButtonElement | null;
  private actionStatus = '';
  private missionResultShown = false;
  private lastGamepadButtons: boolean[] = [];
  private readonly fitMapHandler = (): void => this.fitMap();
  private readonly cancelLinkHandler = (): void => this.cancelLinkInteraction();
  private readonly queueScoutHandler = (): void => this.queueScoutProduction();
  private readonly moveSquadronHandler = (): void => this.moveSelectedSquadron();
  private readonly restartMissionHandler = (): void => window.location.reload();
  private readonly resizeHandler = (): void => this.fitMap();

  constructor() {
    super('StrategyMapScene');
  }

  create(): void {
    const bootOverlay = document.getElementById('boot-overlay');
    if (bootOverlay) {
      bootOverlay.hidden = true;
    }
    this.cameras.main.setBackgroundColor('#030712');
    this.cameras.main.setBounds(0, 0, 1600, 900);
    this.cameras.main.centerOn(800, 450);
    this.cameras.main.setZoom(1);

    this.backgroundGraphics = this.add.graphics();
    this.sectorGraphics = this.add.graphics();
    this.linkGraphics = this.add.graphics();
    this.previewGraphics = this.add.graphics();

    this.statusText = this.add
      .text(24, 24, '', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '16px',
        color: '#cbd5e1',
      })
      .setScrollFactor(0);

    this.createBackdrop();
    this.createSectorLabels();
    this.createNodeSprites();
    this.createSquadronSprites();
    this.bindPointerControls();
    this.bindKeyboardControls();
    this.bindDomButtons();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.handleShutdown, this);
    this.focusState = createFocusNavigationState(this.getOwnedNodeIds());
    this.scale.on(Phaser.Scale.Events.RESIZE, this.resizeHandler);
    this.time.delayedCall(0, () => this.fitMap());
    this.syncHud();
    this.renderWorld();
  }

  update(_: number, delta: number): void {
    this.accumulator += delta;
    while (this.accumulator >= FIXED_TIMESTEP_MS) {
      this.runtime.step(1);
      this.accumulator -= FIXED_TIMESTEP_MS;
    }
    this.syncSquadronSprites();
    if (this.focusState.orderedNodeIds.length === 0) {
      this.focusState = createFocusNavigationState(this.getOwnedNodeIds());
    }
    this.pollGamepad();
    if (this.selectedNodeId && !this.getOwnedNodeIds().includes(this.selectedNodeId)) {
      this.selectedNodeId = null;
    }
    if (this.selectedSquadronId && !this.runtime.state.squadrons.some((squadron) => squadron.id === this.selectedSquadronId)) {
      this.selectedSquadronId = null;
    }
    this.syncHud();
    this.renderWorld();
  }

  private createBackdrop(): void {
    this.backgroundGraphics.clear();
    this.backgroundGraphics.fillStyle(0x020617, 1);
    this.backgroundGraphics.fillRect(0, 0, 1600, 900);
    for (let index = 0; index < 60; index += 1) {
      const x = 30 + ((index * 133) % 1540);
      const y = 20 + ((index * 97) % 840);
      this.backgroundGraphics.fillStyle(index % 5 === 0 ? 0x67e8f9 : 0x334155, 0.8);
      this.backgroundGraphics.fillCircle(x, y, index % 7 === 0 ? 2 : 1);
    }
  }

  private createSectorLabels(): void {
    this.sectorGraphics.clear();
    for (const sector of this.runtime.state.sectors) {
      this.drawSector(sector);
      this.add
        .text(sector.center.x, sector.center.y - 132, sector.label, {
          fontFamily: 'Trebuchet MS, sans-serif',
          fontSize: '14px',
          color: sector.owner === PLAYER_ID ? '#7dd3fc' : '#cbd5e1',
        })
        .setOrigin(0.5);
    }
  }

  private createNodeSprites(): void {
    for (const node of this.runtime.state.nodes) {
      const nodeGraphics = this.add
        .arc(node.position.x, node.position.y, 26, 0, 360, false, node.owner === PLAYER_ID ? 0x0284c7 : 0xef4444, 1)
        .setStrokeStyle(2, 0xe2e8f0);
      nodeGraphics.setInteractive();
      nodeGraphics.on('pointerdown', () => this.handleNodePointerDown(node.id));
      nodeGraphics.on('pointerover', () => this.handleHover(node.id));
      nodeGraphics.on('pointerout', () => this.handleHover(null));
      this.nodeGraphics.set(node.id, nodeGraphics);

      const label = this.add
        .text(node.position.x, node.position.y + 38, this.labelForNode(node.type), {
          fontFamily: 'Trebuchet MS, sans-serif',
          fontSize: '11px',
          color: '#e2e8f0',
        })
        .setOrigin(0.5);
      this.nodeLabels.set(node.id, label);
    }
  }

  private createSquadronSprites(): void {
    for (const squadron of this.runtime.state.squadrons) {
      this.createSquadronSprite(squadron);
    }
  }

  private createSquadronSprite(squadron: SquadronState): void {
    const sector = this.runtime.state.sectors.find((entry) => entry.id === squadron.sectorId);
    if (!sector) {
      return;
    }
    const sprite = this.add
      .arc(sector.center.x, sector.center.y + 78, 16, 0, 360, false, 0x22c55e, 1)
      .setStrokeStyle(2, 0xe2e8f0);
    sprite.setInteractive();
    sprite.on('pointerdown', () => this.handleSquadronPointerDown(squadron.id));
    sprite.on('pointerover', () => this.handleSquadronHover(squadron.id));
    sprite.on('pointerout', () => this.handleSquadronHover(null));
    this.squadronGraphics.set(squadron.id, sprite);

    const label = this.add
      .text(sector.center.x, sector.center.y + 100, this.labelForSquadron(squadron), {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '11px',
        color: '#e2e8f0',
      })
      .setOrigin(0.5);
    this.squadronLabels.set(squadron.id, label);
  }

  private bindPointerControls(): void {
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      const worldPoint = pointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
      const targetNodeId = this.findNodeAt(worldPoint.x, worldPoint.y);
      if (targetNodeId) {
        this.linkState = updateLinkPreview(this.linkState, targetNodeId);
        this.hoveredSectorId = this.findSectorAt(worldPoint.x, worldPoint.y);
        return;
      }
      this.hoveredSectorId = this.findSectorAt(worldPoint.x, worldPoint.y);
      this.linkState = updateLinkPreview(this.linkState, null);
    });

    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      const worldPoint = pointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
      const targetNodeId = this.findNodeAt(worldPoint.x, worldPoint.y);
      const targetSquadronId = this.findSquadronAt(worldPoint.x, worldPoint.y);
      const targetSectorId = this.findSectorAt(worldPoint.x, worldPoint.y);
      if (targetNodeId) {
        return;
      }
      if (targetSquadronId) {
        this.selectSquadron(targetSquadronId);
      } else if (targetSectorId) {
        this.selectSector(targetSectorId);
        if (this.selectedSquadronId && targetSectorId !== this.getSelectedSquadron()?.sectorId) {
          this.submitMoveSquadronCommand(this.selectedSquadronId, targetSectorId);
        }
      }
    });

    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _gameObjects: Phaser.GameObjects.GameObject[], _deltaX: number, deltaY: number) => {
      const currentZoom = this.cameras.main.zoom;
      const nextZoom = Phaser.Math.Clamp(currentZoom - deltaY * 0.001, 0.65, 1.5);
      this.cameras.main.setZoom(nextZoom);
    });

    let dragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.findNodeAt(pointer.worldX, pointer.worldY) || this.findSquadronAt(pointer.worldX, pointer.worldY) || this.findSectorAt(pointer.worldX, pointer.worldY)) {
        return;
      }
      dragging = true;
      dragStartX = pointer.x;
      dragStartY = pointer.y;
    });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!dragging || !pointer.isDown) {
        return;
      }
      const dx = (dragStartX - pointer.x) / this.cameras.main.zoom;
      const dy = (dragStartY - pointer.y) / this.cameras.main.zoom;
      this.cameras.main.scrollX += dx;
      this.cameras.main.scrollY += dy;
      dragStartX = pointer.x;
      dragStartY = pointer.y;
    });
    this.input.on('pointerup', () => {
      dragging = false;
    });
  }

  private bindKeyboardControls(): void {
    this.input.keyboard?.on('keydown-ESC', () => this.cancelLinkInteraction());
    this.input.keyboard?.on('keydown-SPACE', () => this.confirmFocusedNode());
    this.input.keyboard?.on('keydown-ENTER', () => this.confirmFocusedNode());
    this.input.keyboard?.on('keydown-RIGHT', () => this.focusNextNode(1));
    this.input.keyboard?.on('keydown-LEFT', () => this.focusNextNode(-1));
    this.input.keyboard?.on('keydown-UP', () => this.focusNextNode(-1));
    this.input.keyboard?.on('keydown-DOWN', () => this.focusNextNode(1));
  }

  private pollGamepad(): void {
    const gamepad = typeof navigator !== 'undefined' ? navigator.getGamepads()[0] ?? null : null;
    if (!gamepad || !gamepad.connected) {
      this.lastGamepadButtons = [];
      return;
    }
    const pressed = gamepad.buttons.map((button) => button.pressed);
    const justPressed = (index: number): boolean => pressed[index] === true && this.lastGamepadButtons[index] !== true;
    if (justPressed(14) || justPressed(12)) {
      this.focusNextNode(-1);
    }
    if (justPressed(15) || justPressed(13)) {
      this.focusNextNode(1);
    }
    if (justPressed(0)) {
      this.confirmFocusedNode();
    }
    if (justPressed(1) || justPressed(2)) {
      this.cancelLinkInteraction();
    }
    this.lastGamepadButtons = pressed;
  }

  private bindDomButtons(): void {
    this.fitButton = document.getElementById('fit-map') as HTMLButtonElement | null;
    this.cancelButton = document.getElementById('cancel-link') as HTMLButtonElement | null;
    this.queueScoutButton = document.getElementById('queue-scout') as HTMLButtonElement | null;
    this.moveSquadronButton = document.getElementById('move-squadron') as HTMLButtonElement | null;
    this.restartMissionButton = document.getElementById('restart-mission') as HTMLButtonElement | null;
    this.fitButton?.addEventListener('click', this.fitMapHandler);
    this.cancelButton?.addEventListener('click', this.cancelLinkHandler);
    this.queueScoutButton?.addEventListener('click', this.queueScoutHandler);
    this.moveSquadronButton?.addEventListener('click', this.moveSquadronHandler);
    this.restartMissionButton?.addEventListener('click', this.restartMissionHandler);
  }

  private fitMap(): void {
    const viewportWidth = Math.max(1, this.scale.width);
    const viewportHeight = Math.max(1, this.scale.height);
    const zoom = Math.min(viewportWidth / 1600, viewportHeight / 900) * 0.96;
    this.cameras.main.centerOn(800, 450);
    this.cameras.main.setZoom(Phaser.Math.Clamp(zoom, 0.5, 1.2));
  }

  private focusNextNode(direction: 1 | -1): void {
    const ownedNodes = this.getOwnedNodeIds();
    if (ownedNodes.length === 0) {
      return;
    }
    if (this.linkState.isActive && this.linkState.sourceNodeId) {
      const current = focusedNodeId(this.focusState) ?? this.linkState.sourceNodeId;
      const currentIndex = ownedNodes.indexOf(current);
      const nextIndex = (currentIndex + direction + ownedNodes.length) % ownedNodes.length;
      this.linkState = updateLinkPreview(this.linkState, ownedNodes[nextIndex] ?? null);
      this.selectedNodeId = ownedNodes[nextIndex] ?? null;
      this.focusState = {
        orderedNodeIds: ownedNodes,
        focusedIndex: nextIndex,
      };
      return;
    }
    this.focusState = moveFocus(this.focusState, direction);
    this.selectedNodeId = focusedNodeId(this.focusState);
  }

  private confirmFocusedNode(): void {
    const nodeId = focusedNodeId(this.focusState);
    if (!nodeId) {
      return;
    }
    if (!this.linkState.isActive) {
      this.beginLink(nodeId);
      return;
    }
    if (this.linkState.sourceNodeId) {
      const result = finishLinkInteraction(this.linkState, nodeId);
      this.linkState = result.nextState;
      if (result.intent?.type === 'confirm-link') {
        this.submitLinkCommand(result.intent.fromNodeId, result.intent.toNodeId);
      }
    }
  }

  private beginLink(nodeId: NodeId): void {
    if (!this.isOwnedNode(nodeId)) {
      return;
    }
    this.linkState = createLinkInteractionState();
    this.linkState = {
      sourceNodeId: nodeId,
      hoveredNodeId: nodeId,
      previewTargetNodeId: null,
      isActive: true,
    };
    this.selectedNodeId = nodeId;
  }

  private cancelLinkInteraction(): void {
    this.linkState = createLinkInteractionState();
  }

  private selectSector(sectorId: SectorId | null): void {
    this.selectedSectorId = sectorId;
  }

  private selectSquadron(squadronId: SquadronId | null): void {
    this.selectedSquadronId = squadronId;
    const squadron = squadronId ? this.runtime.state.squadrons.find((entry) => entry.id === squadronId) ?? null : null;
    if (squadron) {
      this.selectedSectorId = squadron.sectorId;
    }
  }

  private getSelectedSquadron() {
    return this.selectedSquadronId ? this.runtime.state.squadrons.find((entry) => entry.id === this.selectedSquadronId) ?? null : null;
  }

  private handleNodePointerDown(nodeId: NodeId): void {
    const node = this.runtime.state.nodes.find((entry) => entry.id === nodeId) ?? null;
    if (!node || !this.isOwnedNode(nodeId)) {
      this.selectedNodeId = nodeId;
      return;
    }
    this.selectedNodeId = nodeId;
    if (node.type === 'shipyard' && !this.linkState.isActive) {
      return;
    }
    if (!this.linkState.isActive) {
      this.beginLink(nodeId);
      return;
    }
    const result = finishLinkInteraction(this.linkState, nodeId);
    this.linkState = result.nextState;
    if (result.intent?.type === 'confirm-link') {
      this.submitLinkCommand(result.intent.fromNodeId, result.intent.toNodeId);
    }
  }

  private handleHover(nodeId: NodeId | null): void {
    if (this.linkState.isActive) {
      this.linkState = updateLinkPreview(this.linkState, nodeId);
    }
  }

  private handleSquadronPointerDown(squadronId: SquadronId): void {
    this.selectSquadron(squadronId);
  }

  private handleSquadronHover(squadronId: SquadronId | null): void {
    this.hoveredSectorId = squadronId ? this.runtime.state.squadrons.find((entry) => entry.id === squadronId)?.sectorId ?? this.hoveredSectorId : this.hoveredSectorId;
  }

  private queueScoutProduction(): void {
    const shipyard = this.runtime.state.nodes.find(
      (node) => node.id === this.selectedNodeId && node.type === 'shipyard' && node.owner === PLAYER_ID,
    );
    if (!shipyard) {
      this.setStatus('Select your powered shipyard to queue a scout.');
      return;
    }
    this.commandCounter += 1;
    const result = this.runtime.submit({
      type: 'queue-squadron-production',
      commandId: createCommandId('production', this.commandCounter),
      playerId: PLAYER_ID,
      intendedTick: this.runtime.state.tick,
      protocolVersion: this.runtime.state.protocolVersion,
      payload: {
        shipyardNodeId: shipyard.id,
        squadronType: 'scout',
      },
    } satisfies QueueSquadronProductionCommand);
    this.setStatus(result.status === 'accepted' ? 'Scout production queued.' : `Production rejected: ${result.reason}`);
  }

  private moveSelectedSquadron(destinationSectorId: SectorId | null = this.selectedSectorId): void {
    const squadron = this.getSelectedSquadron();
    if (!squadron) {
      this.setStatus('Select a squadron first.');
      return;
    }
    if (!destinationSectorId) {
      this.setStatus('Select a destination sector.');
      return;
    }
    this.submitMoveSquadronCommand(squadron.id, destinationSectorId);
  }

  private submitLinkCommand(fromNodeId: NodeId, toNodeId: NodeId): void {
    this.commandCounter += 1;
    const result = this.runtime.submit({
      type: 'create-energy-link',
      commandId: createCommandId('link', this.commandCounter),
      playerId: PLAYER_ID,
      intendedTick: this.runtime.state.tick,
      protocolVersion: this.runtime.state.protocolVersion,
      payload: {
        fromNodeId,
        toNodeId,
      },
    });
    if (result.status === 'rejected') {
      this.setStatus(`Link rejected: ${result.reason}`);
    } else {
      this.setStatus(`Link created: ${fromNodeId} -> ${toNodeId}`);
    }
  }

  private submitMoveSquadronCommand(squadronId: SquadronId, destinationSectorId: SectorId): void {
    this.commandCounter += 1;
    const result = this.runtime.submit({
      type: 'move-squadron',
      commandId: createCommandId('move', this.commandCounter),
      playerId: PLAYER_ID,
      intendedTick: this.runtime.state.tick,
      protocolVersion: this.runtime.state.protocolVersion,
      payload: {
        squadronId,
        destinationSectorId,
      },
    } satisfies MoveSquadronCommand);
    this.setStatus(result.status === 'accepted' ? 'Squadron moving.' : `Move rejected: ${result.reason}`);
  }

  private setStatus(message: string): void {
    this.actionStatus = message;
    this.time.delayedCall(2200, () => {
      if (this.actionStatus === message) {
        this.actionStatus = '';
      }
    });
    if (this.statusText) {
      this.statusText.setText(message);
    }
  }

  private handleShutdown(): void {
    this.fitButton?.removeEventListener('click', this.fitMapHandler);
    this.cancelButton?.removeEventListener('click', this.cancelLinkHandler);
    this.queueScoutButton?.removeEventListener('click', this.queueScoutHandler);
    this.moveSquadronButton?.removeEventListener('click', this.moveSquadronHandler);
    this.restartMissionButton?.removeEventListener('click', this.restartMissionHandler);
    this.scale.off(Phaser.Scale.Events.RESIZE, this.resizeHandler);
    this.input.removeAllListeners();
    this.input.keyboard?.removeAllListeners();
    this.lastGamepadButtons = [];
  }

  private getOwnedNodeIds(): NodeId[] {
    return this.runtime.state.nodes.filter((node) => node.owner === PLAYER_ID).map((node) => node.id);
  }

  private syncSquadronSprites(): void {
    const state = this.runtime.state;
    for (const [squadronId, sprite] of this.squadronGraphics) {
      const squadron = state.squadrons.find((entry) => entry.id === squadronId);
      const label = this.squadronLabels.get(squadronId);
      if (!squadron) {
        sprite.destroy();
        label?.destroy();
        this.squadronGraphics.delete(squadronId);
        this.squadronLabels.delete(squadronId);
        continue;
      }
      const sector = state.sectors.find((entry) => entry.id === squadron.sectorId);
      if (!sector) {
        continue;
      }
      sprite.setPosition(sector.center.x, sector.center.y + 78);
      sprite.setFillStyle(
        squadron.status === 'moving'
          ? 0x22c55e
          : squadron.status === 'waiting-for-energy'
            ? 0xf59e0b
            : 0x38bdf8,
        1,
      );
      sprite.setStrokeStyle(this.selectedSquadronId === squadron.id ? 4 : 2, this.selectedSquadronId === squadron.id ? 0xfbbf24 : 0xe2e8f0);
      label?.setPosition(sector.center.x, sector.center.y + 100);
      if (label) {
        label.setText(this.labelForSquadron(squadron));
      }
    }

    for (const squadron of state.squadrons) {
      if (this.squadronGraphics.has(squadron.id)) {
        continue;
      }
      this.createSquadronSprite(squadron);
    }
  }

  private isOwnedNode(nodeId: NodeId): boolean {
    return this.runtime.state.nodes.some((node) => node.id === nodeId && node.owner === PLAYER_ID);
  }

  private findNodeAt(x: number, y: number): NodeId | null {
    const node = this.runtime.state.nodes.find((entry) => Phaser.Math.Distance.Between(entry.position.x, entry.position.y, x, y) <= 28);
    return node ? node.id : null;
  }

  private findSquadronAt(x: number, y: number): SquadronId | null {
    const squadron = this.runtime.state.squadrons.find((entry) => {
      const sector = this.runtime.state.sectors.find((sectorEntry) => sectorEntry.id === entry.sectorId);
      return sector ? Phaser.Math.Distance.Between(sector.center.x, sector.center.y + 78, x, y) <= 18 : false;
    });
    return squadron ? squadron.id : null;
  }

  private findSectorAt(x: number, y: number): SectorId | null {
    const sector = this.runtime.state.sectors.find(
      (entry) => x >= entry.bounds.x && x <= entry.bounds.x + entry.bounds.width && y >= entry.bounds.y && y <= entry.bounds.y + entry.bounds.height,
    );
    return sector ? sector.id : null;
  }

  private labelForNode(type: NodeState['type']): string {
    switch (type) {
      case 'command-core':
        return 'Core';
      case 'relay':
        return 'Relay';
      case 'mine':
        return 'Mine';
      case 'reactor':
        return 'Reactor';
      case 'shipyard':
        return 'Shipyard';
      default:
        return 'Node';
    }
  }

  private labelForSquadron(squadron: SquadronState): string {
    const progress = squadron.status === 'capturing' ? ` ${squadron.captureProgress}/${SECTOR_CAPTURE_REQUIRED_TICKS}` : '';
    return `Scout ${squadron.id.slice(-3)} · ${squadron.status}${progress} · ${squadron.energy}/${squadron.maxEnergy}`;
  }

  private drawSector(sector: SectorState): void {
    const color = sector.owner === PLAYER_ID ? 0x0f172a : sector.owner === 'neutral' ? 0x111827 : 0x2a1220;
    this.sectorGraphics.lineStyle(1, sector.owner === PLAYER_ID ? 0x38bdf8 : 0x475569, 0.38);
    this.sectorGraphics.fillStyle(color, 0.34);
    this.sectorGraphics.fillRoundedRect(sector.bounds.x, sector.bounds.y, sector.bounds.width, sector.bounds.height, 22);
    this.sectorGraphics.strokeRoundedRect(sector.bounds.x, sector.bounds.y, sector.bounds.width, sector.bounds.height, 22);
  }

  private renderWorld(): void {
    const state = this.runtime.state;
    this.linkGraphics.clear();
    this.previewGraphics.clear();
    this.sectorGraphics.clear();
    for (const sector of state.sectors) {
      const color =
        this.selectedSectorId === sector.id
          ? 0x1d4ed8
          : this.hoveredSectorId === sector.id
            ? 0x0f766e
            : sector.owner === PLAYER_ID
              ? 0x0f172a
              : sector.owner === 'neutral'
                ? 0x111827
              : 0x2a1220;
      const isObjective = sector.id === state.mission.objectiveSectorId;
      this.sectorGraphics.lineStyle(
        isObjective ? 4 : 1,
        isObjective ? 0xfbbf24 : sector.owner === PLAYER_ID ? 0x38bdf8 : 0x475569,
        this.selectedSectorId === sector.id || isObjective ? 0.9 : 0.38,
      );
      this.sectorGraphics.fillStyle(color, this.selectedSectorId === sector.id ? 0.52 : 0.34);
      this.sectorGraphics.fillRoundedRect(sector.bounds.x, sector.bounds.y, sector.bounds.width, sector.bounds.height, 22);
      this.sectorGraphics.strokeRoundedRect(sector.bounds.x, sector.bounds.y, sector.bounds.width, sector.bounds.height, 22);
    }

    for (const link of state.links) {
      const fromNode = state.nodes.find((node) => node.id === link.fromNodeId);
      const toNode = state.nodes.find((node) => node.id === link.toNodeId);
      if (!fromNode || !toNode) {
        continue;
      }
      const color = link.state === 'active' ? 0x67e8f9 : link.state === 'overloaded' ? 0xfbbf24 : link.state === 'damaged' ? 0xfb7185 : 0x475569;
      this.linkGraphics.lineStyle(4, color, 0.85);
      this.linkGraphics.beginPath();
      this.linkGraphics.moveTo(fromNode.position.x, fromNode.position.y);
      this.linkGraphics.lineTo(toNode.position.x, toNode.position.y);
      this.linkGraphics.strokePath();
    }

    for (const squadron of state.squadrons) {
      const sector = state.sectors.find((entry) => entry.id === squadron.sectorId);
      if (!sector) {
        continue;
      }
      const target = this.selectedSquadronId === squadron.id && this.selectedSectorId && this.selectedSectorId !== squadron.sectorId
        ? state.sectors.find((entry) => entry.id === this.selectedSectorId)
        : null;
      if (target) {
        this.previewGraphics.lineStyle(2, 0x86efac, 0.8);
        this.previewGraphics.beginPath();
        this.previewGraphics.moveTo(sector.center.x, sector.center.y);
        this.previewGraphics.lineTo(target.center.x, target.center.y);
        this.previewGraphics.strokePath();
      }
    }

    if (this.linkState.isActive && this.linkState.sourceNodeId) {
      const fromNode = state.nodes.find((node) => node.id === this.linkState.sourceNodeId);
      if (fromNode) {
        const targetNode = this.linkState.previewTargetNodeId
          ? state.nodes.find((node) => node.id === this.linkState.previewTargetNodeId)
          : null;
        const targetX = targetNode ? targetNode.position.x : this.input.activePointer.worldX;
        const targetY = targetNode ? targetNode.position.y : this.input.activePointer.worldY;
        const isValid = !!targetNode && targetNode.owner === PLAYER_ID && targetNode.id !== fromNode.id;
        this.previewGraphics.lineStyle(3, isValid ? 0xa7f3d0 : 0xfca5a5, 0.95);
        this.previewGraphics.beginPath();
        this.previewGraphics.moveTo(fromNode.position.x, fromNode.position.y);
        this.previewGraphics.lineTo(targetX, targetY);
        this.previewGraphics.strokePath();
      }
    }

    for (const node of state.nodes) {
      const graphics = this.nodeGraphics.get(node.id);
      if (!graphics) {
        continue;
      }
      const isSelected = this.selectedNodeId === node.id;
      const isFocused = focusedNodeId(this.focusState) === node.id;
      graphics.setFillStyle(node.owner === PLAYER_ID ? 0x0284c7 : 0xef4444, node.powerState === 'powered' ? 1 : 0.55);
      graphics.setStrokeStyle(isSelected ? 4 : isFocused ? 3 : 2, isSelected ? 0xfbbf24 : isFocused ? 0x7dd3fc : 0xe2e8f0);
      graphics.setRadius(node.powerState === 'powered' ? 28 : 24);

      const label = this.nodeLabels.get(node.id);
      if (label) {
        label.setText(`${this.labelForNode(node.type)} · ${node.powerState === 'powered' ? 'powered' : 'offline'}`);
        label.setPosition(node.position.x, node.position.y + 40);
      }
    }

    for (const squadron of state.squadrons) {
      const graphics = this.squadronGraphics.get(squadron.id);
      const label = this.squadronLabels.get(squadron.id);
      const sector = state.sectors.find((entry) => entry.id === squadron.sectorId);
      if (!graphics || !label || !sector) {
        continue;
      }
      graphics.setPosition(sector.center.x, sector.center.y + 78);
      graphics.setFillStyle(
        squadron.status === 'moving' ? 0x22c55e : squadron.status === 'waiting-for-energy' ? 0xf59e0b : 0x38bdf8,
        1,
      );
      graphics.setStrokeStyle(this.selectedSquadronId === squadron.id ? 4 : 2, this.selectedSquadronId === squadron.id ? 0xfbbf24 : 0xe2e8f0);
      label.setPosition(sector.center.x, sector.center.y + 100);
      label.setText(this.labelForSquadron(squadron));
    }
  }

  private syncHud(): void {
    const state = this.runtime.state;
    const selectedNode = this.selectedNodeId ? state.nodes.find((node) => node.id === this.selectedNodeId) ?? null : null;
    const focusNode = focusedNodeId(this.focusState);
    const previewTarget = this.linkState.previewTargetNodeId;
    const linkPreview = this.linkState.isActive && this.linkState.sourceNodeId
      ? {
          fromNodeId: this.linkState.sourceNodeId,
          toNodeId: previewTarget,
          isValid:
            !!previewTarget &&
            previewTarget !== this.linkState.sourceNodeId &&
            this.isOwnedNode(previewTarget),
          matterCost: 12,
        }
      : null;

    const hud = buildHudViewModel(state, selectedNode?.id ?? focusNode ?? null, this.selectedSectorId, linkPreview);
    const hudTick = document.getElementById('hud-tick');
    const hudResources = document.getElementById('hud-resources');
    const hudStatus = document.getElementById('hud-status');
    const hudMission = document.getElementById('hud-mission');
    const hudCountdown = document.getElementById('hud-countdown');
    const hudSelected = document.getElementById('hud-selected');
    const hudLink = document.getElementById('hud-link');
    const squadronSummary = state.squadrons
      .map(
        (squadron) =>
          `${squadron.id.slice(-3)}:${squadron.status}:${squadron.energy}/${squadron.maxEnergy} @ ${squadron.sectorId}`,
      )
      .join('<br/>');
    const productionSummary = state.productionOrders
      .map(
        (order) =>
          `${order.id.slice(-3)}:${order.status}:${order.progress}/${order.requiredProgress} ${order.squadronType} @ ${order.shipyardNodeId}`,
      )
      .join('<br/>');

    if (hudTick) {
      hudTick.textContent = String(hud.tick);
    }
    if (hudResources) {
      hudResources.innerHTML = hud.players
        .map((player) => `<div>${player.name}: matter ${player.matter} | energy ${player.energy}</div>`)
        .join('');
    }
    if (hudStatus) {
      hudStatus.textContent = this.currentInstruction(state);
    }
    if (hudMission) {
      hudMission.textContent = state.mission.status === 'active' ? 'Capture the gold Center West sector' : state.mission.status === 'victory' ? 'Sector secured' : 'Omega breached the network';
    }
    if (hudCountdown) {
      const ticksRemaining = Math.max(0, state.mission.deadlineTick - state.tick);
      const secondsRemaining = Math.ceil((ticksRemaining * FIXED_TIMESTEP_MS) / 1000);
      hudCountdown.textContent = state.mission.status === 'active' ? `Omega breach in ${secondsRemaining}s` : state.mission.status.toUpperCase();
    }
    if (hudSelected) {
      const squadron = this.getSelectedSquadron();
      if (squadron) {
        hudSelected.textContent = `Squadron ${squadron.id} (${squadron.status}) in ${squadron.sectorId}`;
      } else {
        hudSelected.textContent = hud.selectedNode
          ? `${hud.selectedNode.label} (${hud.selectedNode.powered ? 'powered' : 'offline'})`
          : 'Nothing selected';
      }
    }
    if (hudLink) {
      hudLink.textContent = hud.linkPreview
        ? `Preview: ${hud.linkPreview.fromNodeId} -> ${hud.linkPreview.toNodeId ?? '...'} | ${hud.linkPreview.isValid ? 'valid' : 'invalid'} | cost ${hud.linkPreview.matterCost}`
        : 'Link preview disabled';
    }
    const squadronSection = document.getElementById('hud-squadrons');
    if (squadronSection) {
      squadronSection.innerHTML = squadronSummary || 'No squadrons yet';
    }
    const productionSection = document.getElementById('hud-production');
    if (productionSection) {
      productionSection.innerHTML = productionSummary || 'No production queued';
    }
    if (this.queueScoutButton) {
      this.queueScoutButton.disabled = !hud.selectedNode || hud.selectedNode.type !== 'shipyard' || !hud.selectedNode.powered;
    }
    if (this.moveSquadronButton) {
      this.moveSquadronButton.disabled = !this.getSelectedSquadron() || !this.selectedSectorId;
    }
    this.syncMissionResult(state.mission.status);
  }

  private currentInstruction(state: ReturnType<typeof createSimulationRuntime>['state']): string {
    if (this.actionStatus) {
      return this.actionStatus;
    }
    if (this.linkState.isActive && this.linkState.sourceNodeId) {
      return 'Connection mode: click a second blue node. Connect Core to Shipyard first.';
    }
    const shipyard = state.nodes.find((node) => node.id === 'alpha-shipyard');
    const shipyardLinked = state.links.some(
      (link) => link.fromNodeId === 'alpha-shipyard' || link.toNodeId === 'alpha-shipyard',
    );
    if (!shipyardLinked) {
      return 'Step 1: click the blue Core, then click the blue Shipyard.';
    }
    if (shipyard?.powerState !== 'powered') {
      return 'Power is resolving. The Shipyard will come online on the next tick.';
    }
    if (state.productionOrders.length === 0 && state.squadrons.length === 0) {
      return 'Step 2: click the powered Shipyard, then press Build scout.';
    }
    if (state.productionOrders.length > 0) {
      return 'Scout construction in progress. Hold the line.';
    }
    const capturing = state.squadrons.find((squadron) => squadron.status === 'capturing');
    if (capturing) {
      return `Capturing Center West: ${capturing.captureProgress}/${SECTOR_CAPTURE_REQUIRED_TICKS}.`;
    }
    return 'Step 3: click your Scout, then click the gold Center West sector.';
  }

  private syncMissionResult(status: 'active' | 'victory' | 'defeat'): void {
    if (status === 'active' || this.missionResultShown) {
      return;
    }
    this.missionResultShown = true;
    const overlay = document.getElementById('mission-overlay');
    const title = document.getElementById('mission-result-title');
    const message = document.getElementById('mission-result-message');
    if (title) {
      title.textContent = status === 'victory' ? 'Center West secured' : 'Network breach';
    }
    if (message) {
      message.textContent = status === 'victory'
        ? 'Your scout established the first forward sector before Omega could break through.'
        : 'Omega reached the network first. Build and deploy the scout before the countdown expires.';
    }
    if (overlay) {
      overlay.hidden = false;
    }
  }
}
