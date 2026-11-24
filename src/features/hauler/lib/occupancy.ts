import { sameCell } from "@/shared/document";
import type { Box, GameDocument, Vec } from "@/shared/types";

export type Occupant = "player" | "box" | null;

/** Grid cells used by a pinned long box. Quarter-turn states use the two end cells. */
export function boxOccupiesCell(box: Box, at: Vec): boolean {
  if (sameCell(box, at)) return true;
  if (box.shape !== "beam") return false;
  const angle = box.angle ?? 0;
  const length = box.length ?? 1;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const aligned =
    Math.abs(cos) < 1e-6 || Math.abs(Math.abs(cos) - 1) < 1e-6
      ? { x: Math.round(cos), y: Math.round(sin) }
      : null;
  if (aligned) {
    const tip = { x: box.x + aligned.x * length, y: box.y + aligned.y * length };
    return sameCell(tip, at);
  }
  // Non-cardinal gear-driven poses can touch several cells. Use the two ends and
  // the axis-aligned bounds as a conservative lookup for keyboard contact.
  const tip = {
    x: Math.floor(box.x + 0.5 + cos * length),
    y: Math.floor(box.y + 0.5 + sin * length),
  };
  if (sameCell(tip, at)) return true;
  const minX = Math.min(box.x, tip.x);
  const maxX = Math.max(box.x, tip.x);
  const minY = Math.min(box.y, tip.y);
  const maxY = Math.max(box.y, tip.y);
  return at.x >= minX && at.x <= maxX && at.y >= minY && at.y <= maxY;
}

export function boxAt(document: GameDocument, at: Vec, ignoreId?: string): Box | undefined {
  return document.level.boxes.find((box) => box.id !== ignoreId && boxOccupiesCell(box, at));
}

export function occupantAt(document: GameDocument, at: Vec, ignoreBoxId?: string): Occupant {
  if (boxAt(document, at, ignoreBoxId)) return "box";
  if (sameCell(document.level.player, at)) return "player";
  return null;
}

export function boxesByKind(document: GameDocument): Record<string, number> {
  const counts: Record<string, number> = { timber: 0, iron: 0, glass: 0, rack: 0 };
  for (const box of document.level.boxes) counts[box.kind] += 1;
  return counts;
}
