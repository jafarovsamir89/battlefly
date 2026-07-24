import { GameState, type Owner, type RouteAction } from '../types/game';
import type { Ship } from '../entities/Ship';

function element<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`HUD element not found: ${id}`);
  return node as T;
}

export class HUD {
  private readonly turnValue = element<HTMLElement>('turn-value');
  private readonly playerScore = element<HTMLElement>('player-score');
  private readonly botScore = element<HTMLElement>('bot-score');
  private readonly roundValue = element<HTMLElement>('round-value');
  private readonly shipPanel = element<HTMLElement>('ship-panel');
  private readonly shipClassIcon = element<HTMLElement>('ship-class-icon');
  private readonly shipName = element<HTMLElement>('ship-name');
  private readonly shipRole = element<HTMLElement>('ship-role');
  private readonly shipShield = element<HTMLElement>('ship-shield');
  private readonly shipHull = element<HTMLElement>('ship-hull');
  private readonly shipEnergy = element<HTMLElement>('ship-energy');
  private readonly energyMeter = element<HTMLElement>('energy-meter');
  private readonly aimCost = element<HTMLElement>('aim-cost');
  private readonly routePanel = element<HTMLElement>('route-panel');
  private readonly routeActionHelp = element<HTMLElement>('route-action-help');
  private readonly routeButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-route-action]'));
  private readonly reactorValue = element<HTMLElement>('reactor-value');
  private readonly hintValue = element<HTMLElement>('hint-value');
  private readonly resultPanel = element<HTMLElement>('result-panel');
  private readonly resultTitle = element<HTMLElement>('result-title');
  private readonly resultCopy = element<HTMLElement>('result-copy');
  private readonly resultStats = element<HTMLElement>('result-stats');
  private readonly soundButton = element<HTMLButtonElement>('sound-button');
  private readonly newGameButton = element<HTMLButtonElement>('new-game-button');
  private readonly resultButton = element<HTMLButtonElement>('result-button');

  public onNewGame: (() => void) | null = null;
  public onSoundToggle: (() => boolean) | null = null;
  public onRouteAction: ((action: RouteAction) => void) | null = null;

  public constructor() {
    this.newGameButton.addEventListener('click', () => this.onNewGame?.());
    this.resultButton.addEventListener('click', () => this.onNewGame?.());
    this.soundButton.addEventListener('click', () => {
      const enabled = this.onSoundToggle?.() ?? false;
      this.soundButton.textContent = enabled ? 'Звук: вкл.' : 'Звук: выкл.';
      this.soundButton.classList.toggle('active', enabled);
    });
    this.routeButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const action = button.dataset.routeAction as RouteAction;
        this.onRouteAction?.(action);
      });
    });
  }

  public setTurn(state: GameState): void {
    const labels: Record<GameState, string> = {
      [GameState.PLAYER_SELECTING]: 'Ваш ход',
      [GameState.PLAYER_AIMING]: 'Расчёт маршрута',
      [GameState.PLAYER_ACTION]: 'Ваш корабль в движении',
      [GameState.RESOLVING_COMBAT]: 'Разрешение столкновения',
      [GameState.RETURNING_TO_BASE]: 'Гиперпрыжок на базу',
      [GameState.BOT_THINKING]: 'Бот анализирует поле',
      [GameState.BOT_ACTION]: 'Ход бота',
      [GameState.ROUND_END]: 'Синхронизация раунда',
      [GameState.GAME_OVER]: 'Бой завершён',
    };
    this.turnValue.textContent = labels[state];
    this.turnValue.dataset.state = state;
  }

  public setScores(player: number, bot: number, round: number): void {
    this.playerScore.textContent = String(player);
    this.botScore.textContent = String(bot);
    this.roundValue.textContent = String(round);
  }

  public setReactor(owner: Owner | null): void {
    this.reactorValue.textContent = owner === 'player' ? 'под вашим контролем' : owner === 'bot' ? 'под контролем бота' : 'нейтрален';
    this.reactorValue.dataset.owner = owner ?? 'neutral';
  }

  public setSelected(ship: Ship | null): void {
    if (!ship) {
      this.shipPanel.classList.add('hidden');
      this.routePanel.classList.add('hidden');
      return;
    }

    this.shipPanel.classList.remove('hidden');
    this.routePanel.classList.remove('hidden');
    this.shipClassIcon.textContent = ship.config.icon;
    this.shipName.textContent = ship.config.name;
    this.shipRole.textContent = ship.config.role;
    this.shipShield.textContent = ship.shield > 0 ? '●'.repeat(ship.shield) : 'нет';
    this.shipHull.textContent = ship.hull > 0 ? '●'.repeat(ship.hull) : 'нет';
    this.shipEnergy.textContent = `${Math.round(ship.energy)} / ${ship.config.maxEnergy}`;
    this.energyMeter.style.width = `${Math.round((ship.energy / ship.config.maxEnergy) * 100)}%`;
  }

  public setRouteAction(action: RouteAction): void {
    const labels: Record<RouteAction, string> = {
      create: 'Создайте маршрут для следующего хода.',
      extend: 'Продлите свою линию и оставьте угрозу дальше.',
      cut: 'Пересеките вражескую линию, чтобы ослабить или разорвать её.',
    };
    this.routeButtons.forEach((button) => button.classList.toggle('active', button.dataset.routeAction === action));
    this.routeActionHelp.textContent = labels[action];
  }

  public setAim(distance: number, cost: number, maxDistance: number, boosted: boolean): void {
    this.aimCost.textContent = `${Math.round(distance)} м · расход ${cost} энергии · предел ${Math.round(maxDistance)} м${boosted ? ' · ускорение маршрута' : ''}`;
    this.aimCost.dataset.warning = cost > 44 ? 'high' : 'normal';
  }

  public setHint(message: string): void {
    this.hintValue.textContent = message;
  }

  public showResult(won: boolean, score: number, kills: number, breaches: number, round: number): void {
    this.resultPanel.classList.remove('hidden');
    this.resultTitle.textContent = won ? 'ПОБЕДА' : 'ПОРАЖЕНИЕ';
    this.resultTitle.dataset.result = won ? 'win' : 'lose';
    this.resultCopy.textContent = won ? 'Векторная сеть флота сработала.' : 'База потеряла контроль над боевым столом.';
    this.resultStats.textContent = `Счёт ${score} · уничтожено ${kills} · прорывов ${breaches} · раунд ${round}`;
  }

  public hideResult(): void {
    this.resultPanel.classList.add('hidden');
  }
}
