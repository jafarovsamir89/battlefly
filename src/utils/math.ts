import type { Point } from '../types/game';

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function normalize(vector: Point): Point {
  const length = Math.hypot(vector.x, vector.y) || 1;
  return { x: vector.x / length, y: vector.y / length };
}

export function add(a: Point, b: Point): Point {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function scale(point: Point, multiplier: number): Point {
  return { x: point.x * multiplier, y: point.y * multiplier };
}

export function dot(a: Point, b: Point): number {
  return a.x * b.x + a.y * b.y;
}

export function closestPointOnSegment(point: Point, start: Point, end: Point): Point {
  const segment = { x: end.x - start.x, y: end.y - start.y };
  const segmentLengthSquared = dot(segment, segment);
  if (segmentLengthSquared === 0) return start;

  const projection = clamp(dot({ x: point.x - start.x, y: point.y - start.y }, segment) / segmentLengthSquared, 0, 1);
  return add(start, scale(segment, projection));
}

export function distanceToSegment(point: Point, start: Point, end: Point): number {
  return distance(point, closestPointOnSegment(point, start, end));
}

export function segmentIntersection(a: Point, b: Point, c: Point, d: Point): boolean {
  const direction = (start: Point, end: Point, point: Point) =>
    (point.x - start.x) * (end.y - start.y) - (point.y - start.y) * (end.x - start.x);

  const first = direction(a, b, c);
  const second = direction(a, b, d);
  const third = direction(c, d, a);
  const fourth = direction(c, d, b);
  return first * second <= 0 && third * fourth <= 0;
}

export function segmentCircleEntry(start: Point, end: Point, center: Point, radius: number): number | null {
  const direction = { x: end.x - start.x, y: end.y - start.y };
  const offset = { x: start.x - center.x, y: start.y - center.y };
  const a = dot(direction, direction);
  const b = 2 * dot(offset, direction);
  const c = dot(offset, offset) - radius * radius;
  const discriminant = b * b - 4 * a * c;

  if (a === 0 || discriminant < 0) return null;
  const root = Math.sqrt(discriminant);
  const first = (-b - root) / (2 * a);
  const second = (-b + root) / (2 * a);
  const entries = [first, second].filter((value) => value >= 0 && value <= 1);
  return entries.length ? Math.min(...entries) : null;
}
