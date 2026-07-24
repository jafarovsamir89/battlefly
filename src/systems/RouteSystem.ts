import Phaser from 'phaser';
import { GAME_BALANCE } from '../config/balance';
import type { Owner, Point, Route, RouteStatus, ShipClass } from '../types/game';
import { distanceToSegment, segmentIntersection } from '../utils/math';

export class RouteSystem {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly routes: Route[] = [];
  private nextId = 1;

  public constructor(scene: Phaser.Scene) {
    this.graphics = scene.add.graphics().setDepth(5);
  }

  public addRoute(owner: Owner, start: Point, end: Point, round: number): Route {
    const route: Route = {
      id: this.nextId++,
      owner,
      start: { ...start },
      end: { ...end },
      createdRound: round,
      energy: GAME_BALANCE.routeStartingEnergy,
      status: 'active',
    };
    this.routes.push(route);
    this.render(round);
    return route;
  }

  public advanceRound(round: number): void {
    const freshRoutes = this.routes.filter((route) => route.status !== 'destroyed' && round - route.createdRound < GAME_BALANCE.routeLifetime);
    this.routes.splice(0, this.routes.length, ...freshRoutes);
    this.render(round);
  }

  public crossesRoute(start: Point, end: Point, owner: Owner): Route | null {
    return this.routes.find((route) => {
      if (route.status === 'destroyed') return false;
      if (segmentIntersection(start, end, route.start, route.end)) return true;
      return route.owner === owner && (distanceToSegment(start, route.start, route.end) < 18 || distanceToSegment(end, route.start, route.end) < 18);
    }) ?? null;
  }

  public findOwnRoute(start: Point, end: Point, owner: Owner): Route | null {
    return this.routes.find((route) =>
      route.status !== 'destroyed' &&
      route.owner === owner &&
      (segmentIntersection(start, end, route.start, route.end) || distanceToSegment(start, route.start, route.end) < 42),
    ) ?? null;
  }

  public getEnemyCrossing(start: Point, end: Point, owner: Owner): Route | null {
    return this.routes.find((route) => route.status !== 'destroyed' && route.owner !== owner && segmentIntersection(start, end, route.start, route.end)) ?? null;
  }

  public extendRoute(route: Route, end: Point, round: number): void {
    if (route.status === 'destroyed') return;
    route.end = { ...end };
    route.energy = Math.max(0, route.energy - GAME_BALANCE.routeExtendCost);
    route.createdRound = round;
    route.status = route.energy > 0 ? 'active' : 'damaged';
    this.render(round);
  }

  public damageRoute(route: Route, attackerClass: ShipClass, round: number): RouteStatus {
    if (route.status === 'destroyed') return route.status;
    if (attackerClass === 'defender') {
      route.owner = route.owner === 'player' ? 'bot' : 'player';
      route.status = 'captured';
    } else if (attackerClass === 'interceptor' || route.status === 'damaged') {
      route.status = 'destroyed';
    } else {
      route.status = 'damaged';
      route.energy = Math.max(0, route.energy - 45);
    }
    route.createdRound = round;
    this.render(round);
    return route.status;
  }

  public hasRouteNear(point: Point, owner: Owner): boolean {
    return this.routes.some((route) => route.status !== 'destroyed' && route.owner === owner && distanceToSegment(point, route.start, route.end) < 78);
  }

  public getAll(): readonly Route[] {
    return this.routes;
  }

  private render(round: number): void {
    this.graphics.clear();
    this.routes.forEach((route) => {
      if (route.status === 'destroyed') return;
      const age = round - route.createdRound;
      const alpha = Phaser.Math.Clamp((route.status === 'damaged' ? 0.32 : 0.62) - age * 0.15, 0.12, 0.62);
      const color = route.owner === 'player' ? 0x38bdf8 : 0xfb7185;
      this.graphics.lineStyle(route.status === 'captured' ? 5 : route.status === 'damaged' ? 1 : 3, color, alpha);
      this.graphics.lineBetween(route.start.x, route.start.y, route.end.x, route.end.y);
      this.graphics.lineStyle(1, 0xffffff, alpha * 0.55);
      const segments = 8;
      for (let index = 0; index <= segments; index += 1) {
        const t = index / segments;
        const x = Phaser.Math.Linear(route.start.x, route.end.x, t);
        const y = Phaser.Math.Linear(route.start.y, route.end.y, t);
        this.graphics.strokeCircle(x, y, index % 2 === 0 ? 6 : 3);
      }
      this.graphics.fillStyle(color, alpha + 0.15);
      this.graphics.fillCircle(route.start.x, route.start.y, 7);
      this.graphics.fillCircle(route.end.x, route.end.y, 7);
    });
  }
}
