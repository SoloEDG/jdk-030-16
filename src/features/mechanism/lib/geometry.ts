import type { Vec } from "@/shared/types";

export const SWEEP_ANGLE = Math.PI / 2;
export const CONTACT_EPS = 1e-7;
export const ANGLE_EPS = 1e-7;

export interface Obb {
  center: Vec;
  hx: number;
  hy: number;
  angle: number;
}

export interface FeatureDistance {
  distance: number;
  pointA: Vec;
  pointB: Vec;
  edgeA?: number;
  edgeB?: number;
  vertexA?: number;
  vertexB?: number;
}

export function worldCell(x: number, y: number): Vec {
  return { x: x + 0.5, y: y + 0.5 };
}

export function add(a: Vec, b: Vec): Vec {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function sub(a: Vec, b: Vec): Vec {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function scale(a: Vec, k: number): Vec {
  return { x: a.x * k, y: a.y * k };
}

export function length(a: Vec): number {
  return Math.hypot(a.x, a.y);
}

export function rotateAround(point: Vec, pivot: Vec, angle: number): Vec {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const dx = point.x - pivot.x;
  const dy = point.y - pivot.y;
  // In screen coordinates positive angle turns east toward south.
  return {
    x: pivot.x + dx * c - dy * s,
    y: pivot.y + dx * s + dy * c,
  };
}

export function obbPolygon(obb: Obb): Vec[] {
  const corners: Array<[number, number]> = [
    [-obb.hx, -obb.hy],
    [obb.hx, -obb.hy],
    [obb.hx, obb.hy],
    [-obb.hx, obb.hy],
  ];
  const c = Math.cos(obb.angle);
  const s = Math.sin(obb.angle);
  return corners.map(([x, y]) => ({
    x: obb.center.x + x * c - y * s,
    y: obb.center.y + x * s + y * c,
  }));
}

export function pointSegmentClosest(point: Vec, a: Vec, b: Vec): { point: Vec; distance: number; t: number } {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const lengthSquared = abx * abx + aby * aby;
  if (lengthSquared === 0) {
    return { point: { ...a }, distance: length(sub(point, a)), t: 0 };
  }
  let t = ((point.x - a.x) * abx + (point.y - a.y) * aby) / lengthSquared;
  t = Math.max(0, Math.min(1, t));
  const closest = { x: a.x + abx * t, y: a.y + aby * t };
  return { point: closest, distance: length(sub(point, closest)), t };
}

function polygonAxes(polygon: Vec[]): Vec[] {
  const axes: Vec[] = [];
  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    const edge = sub(b, a);
    const len = length(edge) || 1;
    axes.push({ x: -edge.y / len, y: edge.x / len });
  }
  return axes;
}

/** Positive overlap means real penetration; touching and separation both yield 0. */
export function satPenetration(a: Vec[], b: Vec[], epsilon = 1e-8): number {
  let minimum = Number.POSITIVE_INFINITY;
  for (const polygon of [a, b]) {
    for (const axis of polygonAxes(polygon)) {
      let minA = Number.POSITIVE_INFINITY;
      let maxA = Number.NEGATIVE_INFINITY;
      let minB = Number.POSITIVE_INFINITY;
      let maxB = Number.NEGATIVE_INFINITY;
      for (const p of a) {
        const d = p.x * axis.x + p.y * axis.y;
        minA = Math.min(minA, d);
        maxA = Math.max(maxA, d);
      }
      for (const p of b) {
        const d = p.x * axis.x + p.y * axis.y;
        minB = Math.min(minB, d);
        maxB = Math.max(maxB, d);
      }
      const overlap = Math.min(maxA, maxB) - Math.max(minA, minB);
      if (overlap <= epsilon) return 0;
      minimum = Math.min(minimum, overlap);
    }
  }
  return minimum;
}

export function polygonsPenetrate(a: Vec[], b: Vec[]): boolean {
  return satPenetration(a, b) > 0;
}

/** Minimum distance for disjoint convex polygons. Feature indices are edge indices. */
export function polygonDistance(a: Vec[], b: Vec[]): FeatureDistance {
  let best: FeatureDistance = {
    distance: Number.POSITIVE_INFINITY,
    pointA: { x: 0, y: 0 },
    pointB: { x: 0, y: 0 },
  };

  for (let i = 0; i < a.length; i += 1) {
    const vertex = a[i];
    for (let j = 0; j < b.length; j += 1) {
      const start = b[j];
      const end = b[(j + 1) % b.length];
      const hit = pointSegmentClosest(vertex, start, end);
      if (hit.distance < best.distance) {
        best = {
          distance: hit.distance,
          pointA: { ...vertex },
          pointB: hit.point,
          edgeB: j,
          vertexA: i,
        };
      }
    }
  }

  for (let j = 0; j < b.length; j += 1) {
    const vertex = b[j];
    for (let i = 0; i < a.length; i += 1) {
      const start = a[i];
      const end = a[(i + 1) % a.length];
      const hit = pointSegmentClosest(vertex, start, end);
      if (hit.distance < best.distance) {
        best = {
          distance: hit.distance,
          pointA: hit.point,
          pointB: { ...vertex },
          edgeA: i,
          vertexB: j,
        };
      }
    }
  }

  return best;
}

export function edgeSegment(polygon: Vec[], edgeIndex: number): { a: Vec; b: Vec } {
  const i = ((edgeIndex % polygon.length) + polygon.length) % polygon.length;
  return { a: polygon[i], b: polygon[(i + 1) % polygon.length] };
}

export function normalizeAngle(angle: number): number {
  let next = angle;
  while (next <= -Math.PI) next += Math.PI * 2;
  while (next > Math.PI) next -= Math.PI * 2;
  return next;
}
