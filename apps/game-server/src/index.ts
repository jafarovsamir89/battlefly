import { encodeSnapshotEnvelope } from '@battlefly/networking';
import { checksumWorldState, createSimulationRuntime } from '@battlefly/simulation';
import type { SimulationCommand, SimulationCommandResult, SimulationEvent } from '@battlefly/shared-types';

export interface LocalRoom {
  readonly id: string;
  readonly runtime: ReturnType<typeof createSimulationRuntime>;
  readonly journal: CommandJournalEntry[];
}

export interface CommandJournalEntry {
  readonly command: SimulationCommand;
  readonly result: SimulationCommandResult;
  readonly tick: number;
  readonly events: readonly SimulationEvent[];
}

export const createLocalRoom = (id = 'local-room'): LocalRoom => ({
  id,
  runtime: createSimulationRuntime({ seed: 1 }),
  journal: [],
});

export const submitLocalCommand = (room: LocalRoom, command: SimulationCommand): SimulationCommandResult => {
  const result = room.runtime.submit(command);
  room.journal.push({
    command,
    result,
    tick: room.runtime.state.tick,
    events: result.events,
  });
  return result;
};

export const startLocalLoop = (room: LocalRoom): NodeJS.Timeout => {
  return setInterval(() => {
    room.runtime.step(1);
    const snapshot = room.runtime.snapshot();
    const checksum = checksumWorldState(room.runtime.state);
    console.log(encodeSnapshotEnvelope(snapshot));
    console.log(`room=${room.id} checksum=${checksum} tick=${room.runtime.state.tick}`);
  }, 1000 / 30);
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const room = createLocalRoom();
  startLocalLoop(room);
}
