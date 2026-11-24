import type { Box, GameDocument, Vec } from "@/shared/types";
import { obbPolygon, worldCell, type Obb } from "./geometry";

export const CRATE_HALF = 0.33;
export const DEFAULT_BEAM_WIDTH = 0.62;
export const DEFAULT_BEAM_LENGTH = 1;

export type ObstacleKind = "wall" | "door" | "crate" | "beam" | "pin" | "boundary" | "gap" | "floor";

export interface CollisionShape {
  id: string;
  kind: ObstacleKind;
  polygon: Vec[];
  edgeIds: string[];
  boxId?: string;
}

export function pinPosition(document: GameDocument["level"], box: Box): Vec {
  const pin = document.pins?.find((item) => item.id === box.pinId);
  if (pin) return worldCell(pin.x, pin.y);
  if (box.pivot) return worldCell(box.pivot.x, box.pivot.y);
  return worldCell(box.x, box.y);
}

export function beamWidth(box: Box): number {
  return box.width ?? DEFAULT_BEAM_WIDTH;
}

export function beamLength(box: Box): number {
  return box.length ?? DEFAULT_BEAM_LENGTH;
}

export function beamObb(box: Box, pivot: Vec, angle: number): Obb {
  const length = beamLength(box);
  const halfWidth = beamWidth(box) / 2;
  return {
    center: {
      x: pivot.x + (Math.cos(angle) * length) / 2,
      y: pivot.y + (Math.sin(angle) * length) / 2,
    },
    // Include rounded end caps while keeping the pivot inside the rectangle.
    hx: length / 2 + halfWidth,
    hy: halfWidth,
    angle,
  };
}

export function shapeForBox(level: GameDocument["level"], box: Box, angleOverride?: number): CollisionShape {
  if (box.shape === "beam") {
    const pivot = pinPosition(level, box);
    const angle = angleOverride ?? box.angle ?? 0;
    const obb = beamObb(box, pivot, angle);
    return {
      id: `shape-${box.id}`,
      boxId: box.id,
      kind: "beam",
      polygon: obbPolygon(obb),
      edgeIds: [
        `${box.id}:side-a`,
        `${box.id}:end-free`,
        `${box.id}:side-b`,
        `${box.id}:end-pin`,
      ],
    };
  }
  const center = worldCell(box.x, box.y);
  const angle = angleOverride ?? box.angle ?? 0;
  return {
    id: `shape-${box.id}`,
    boxId: box.id,
    kind: "crate",
    polygon: obbPolygon({ center, hx: CRATE_HALF, hy: CRATE_HALF, angle }),
    edgeIds: [`${box.id}:n`, `${box.id}:e`, `${box.id}:s`, `${box.id}:w`],
  };
}

export function wallShape(x: number, y: number): CollisionShape {
  const c = worldCell(x, y);
  const h = 0.5;
  return {
    id: `wall-${x}-${y}`,
    kind: "wall",
    polygon: [
      { x: c.x - h, y: c.y - h },
      { x: c.x + h, y: c.y - h },
      { x: c.x + h, y: c.y + h },
      { x: c.x - h, y: c.y + h },
    ],
    edgeIds: [`wall:${x},${y}:n`, `wall:${x},${y}:e`, `wall:${x},${y}:s`, `wall:${x},${y}:w`],
  };
}

export function cellBlockShape(
  id: string,
  x: number,
  y: number,
  kind: ObstacleKind,
  edgePrefix: string,
  inset = 0,
): CollisionShape {
  const c = worldCell(x, y);
  const h = 0.5 - inset;
  return {
    id,
    kind,
    polygon: [
      { x: c.x - h, y: c.y - h },
      { x: c.x + h, y: c.y - h },
      { x: c.x + h, y: c.y + h },
      { x: c.x - h, y: c.y + h },
    ],
    edgeIds: [`${edgePrefix}:n`, `${edgePrefix}:e`, `${edgePrefix}:s`, `${edgePrefix}:w`],
  };
}
