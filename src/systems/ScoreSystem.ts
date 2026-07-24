import { GAME_BALANCE } from '../config/balance';
import type { Owner } from '../types/game';

export class ScoreSystem {
  private readonly scores: Record<Owner, number> = { player: 0, bot: 0 };
  private readonly kills: Record<Owner, number> = { player: 0, bot: 0 };
  private readonly breaches: Record<Owner, number> = { player: 0, bot: 0 };

  public awardKill(owner: Owner): number {
    this.scores[owner] += GAME_BALANCE.killScore;
    this.kills[owner] += 1;
    return this.scores[owner];
  }

  public awardBreach(owner: Owner): number {
    this.scores[owner] += GAME_BALANCE.breachScore;
    this.breaches[owner] += 1;
    return this.scores[owner];
  }

  public get(owner: Owner): number {
    return this.scores[owner];
  }

  public hasWon(owner: Owner): boolean {
    return this.scores[owner] >= GAME_BALANCE.winScore;
  }

  public getStats(owner: Owner): { score: number; kills: number; breaches: number } {
    return { score: this.scores[owner], kills: this.kills[owner], breaches: this.breaches[owner] };
  }
}
