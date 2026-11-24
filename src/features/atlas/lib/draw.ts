import { tileCenter } from "./grid";
import type { Box, Door, FloorPatch, GameDocument, Plate, SwingPreview } from "@/shared/types";

export const TILE = 46;

const ink = "#1c1610";
const plank = "#3a2a1c";
const brass = "#c9a36a";
const moss = "#7d9b6a";
const rust = "#b56a32";
const steel = "#8a93a0";
const glass = "#7ec8c8";
const pit = "#0b0907";

export function sizeCanvas(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  tile = TILE,
): CanvasRenderingContext2D {
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const w = width * tile;
  const h = height * tile;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法创建画布");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

export function paintStage(
  ctx: CanvasRenderingContext2D,
  document: GameDocument,
  tile = TILE,
  preview?: SwingPreview | null,
  activeEdgeId?: string | null,
): void {
  const { level } = document;
  ctx.clearRect(0, 0, level.width * tile, level.height * tile);
  ctx.fillStyle = pit;
  ctx.fillRect(0, 0, level.width * tile, level.height * tile);
  for (let y = 0; y < level.height; y++) {
    for (let x = 0; x < level.width; x++) {
      paintTile(ctx, x, y, level.tiles[y][x], tile);
    }
  }
  for (const floor of level.floors) paintFloor(ctx, floor, tile);
  for (const plate of level.plates) paintPlate(ctx, plate, tile);
  for (const door of level.doors) paintDoor(ctx, door, tile);
  for (const box of level.boxes) paintBox(ctx, box, tile, document);
  for (const pin of level.pins ?? []) paintPin(ctx, pin, tile);
  if (preview) paintPreview(ctx, preview, tile, activeEdgeId);
  paintPlayer(ctx, level.player.x, level.player.y, tile, document.attempt.status === "cleared");
}

function paintTile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  kind: string,
  tile: number,
): void {
  const px = x * tile;
  const py = y * tile;
  if (kind === "wall") {
    ctx.fillStyle = plank;
    ctx.fillRect(px, py, tile, tile);
    ctx.strokeStyle = "#2a1d14";
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 4, py + 4, tile - 8, tile - 8);
    ctx.fillStyle = "rgba(201,163,106,0.18)";
    ctx.fillRect(px + 8, py + 10, tile - 16, 3);
    return;
  }
  if (kind === "gap") {
    ctx.fillStyle = pit;
    ctx.fillRect(px, py, tile, tile);
    ctx.strokeStyle = "rgba(201,163,106,0.2)";
    ctx.strokeRect(px + 6, py + 6, tile - 12, tile - 12);
    return;
  }
  ctx.fillStyle = kind === "goal" ? "#2c2618" : "#4a3b2a";
  ctx.fillRect(px + 1, py + 1, tile - 2, tile - 2);
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.strokeRect(px + 1, py + 1, tile - 2, tile - 2);
  if (kind === "goal") {
    ctx.strokeStyle = moss;
    ctx.lineWidth = 2;
    ctx.strokeRect(px + 10, py + 10, tile - 20, tile - 20);
    ctx.fillStyle = "rgba(125,155,106,0.35)";
    ctx.fillRect(px + 16, py + 16, tile - 32, tile - 32);
  }
}

function paintFloor(ctx: CanvasRenderingContext2D, floor: FloorPatch, tile: number): void {
  const px = floor.x * tile;
  const py = floor.y * tile;
  if (floor.morph === "bridge") {
    ctx.fillStyle = floor.active ? "#6a5638" : "rgba(80,70,50,0.35)";
    ctx.fillRect(px + 8, py + 18, tile - 16, 16);
    ctx.strokeStyle = brass;
    ctx.strokeRect(px + 8, py + 18, tile - 16, 16);
    return;
  }
  if (floor.active) {
    ctx.fillStyle = "rgba(90,40,30,0.72)";
    ctx.fillRect(px + 2, py + 2, tile - 4, tile - 4);
  } else {
    ctx.strokeStyle = "rgba(181,106,50,0.7)";
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(px + 8, py + 8, tile - 16, tile - 16);
    ctx.setLineDash([]);
  }
}

function paintPlate(ctx: CanvasRenderingContext2D, plate: Plate, tile: number): void {
  const px = plate.x * tile + 9;
  const py = plate.y * tile + 9;
  const color = plate.accept === "timber" ? rust : plate.accept === "iron" ? steel : plate.accept === "rack" ? brass : glass;
  ctx.fillStyle = plate.powered ? color : "#241c14";
  ctx.fillRect(px, py, tile - 18, tile - 18);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.strokeRect(px, py, tile - 18, tile - 18);
  ctx.fillStyle = plate.powered ? ink : color;
  ctx.font = "11px ui-serif, Palatino, serif";
  ctx.textAlign = "center";
  ctx.fillText(plate.accept === "timber" ? "木" : plate.accept === "iron" ? "铁" : plate.accept === "rack" ? "销" : "玻", px + (tile - 18) / 2, py + 22);
}

function paintDoor(ctx: CanvasRenderingContext2D, door: Door, tile: number): void {
  const px = door.x * tile;
  const py = door.y * tile;
  ctx.fillStyle = door.open ? "rgba(201,163,106,0.22)" : "#5b4630";
  ctx.fillRect(px + 14, py + 4, tile - 28, tile - 8);
  ctx.strokeStyle = brass;
  ctx.lineWidth = 2;
  ctx.strokeRect(px + 14, py + 4, tile - 28, tile - 8);
  if (!door.open) {
    ctx.beginPath();
    ctx.arc(px + tile / 2 + 6, py + tile / 2, 3, 0, Math.PI * 2);
    ctx.fillStyle = brass;
    ctx.fill();
  }
}

function paintBox(
  ctx: CanvasRenderingContext2D,
  box: Box,
  tile: number,
  document?: GameDocument,
): void {
  if (box.shape === "beam") {
    paintBeam(ctx, box, tile, document);
    return;
  }
  const px = box.x * tile + 8;
  const py = box.y * tile + 8;
  const fill = box.kind === "timber" ? rust : box.kind === "iron" ? steel : "rgba(126,200,200,0.55)";
  ctx.fillStyle = fill;
  ctx.fillRect(px, py, tile - 16, tile - 16);
  ctx.strokeStyle = ink;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(px, py, tile - 16, tile - 16);
  if (box.kind === "timber") {
    ctx.strokeStyle = "rgba(28,22,16,0.45)";
    ctx.beginPath();
    ctx.moveTo(px + 4, py + 12);
    ctx.lineTo(px + tile - 20, py + 12);
    ctx.moveTo(px + 4, py + 24);
    ctx.lineTo(px + tile - 20, py + 24);
    ctx.stroke();
  }
  if (box.kind === "iron") {
    ctx.fillStyle = "#5c6570";
    ctx.fillRect(px + 6, py + 6, 6, 6);
    ctx.fillRect(px + tile - 34, py + tile - 34, 6, 6);
  }
}

function boxFill(kind: Box["kind"]): string {
  if (kind === "timber") return rust;
  if (kind === "iron") return steel;
  if (kind === "rack") return brass;
  return "rgba(126,200,200,0.55)";
}

function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function paintBeam(
  ctx: CanvasRenderingContext2D,
  box: Box,
  tile: number,
  document?: GameDocument,
): void {
  const pin = document?.level.pins?.find((item) => item.id === box.pinId);
  const pivotX = (pin ? pin.x + 0.5 : box.x + 0.5) * tile;
  const pivotY = (pin ? pin.y + 0.5 : box.y + 0.5) * tile;
  const angle = box.angle ?? 0;
  const length = (box.length ?? 1) * tile;
  const halfWidth = ((box.width ?? 0.62) / 2) * tile;
  const halfLength = length / 2 + halfWidth;

  if (box.teeth) {
    const gearRadius = (box.gearRadius ?? box.teeth / 16) * tile;
    ctx.save();
    ctx.translate(pivotX, pivotY);
    ctx.rotate(angle);
    ctx.strokeStyle = "rgba(201,163,106,0.72)";
    ctx.lineWidth = 2;
    for (let i = 0; i < box.teeth; i += 1) {
      const a = (i / box.teeth) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * (gearRadius - 3), Math.sin(a) * (gearRadius - 3));
      ctx.lineTo(Math.cos(a) * (gearRadius + 4), Math.sin(a) * (gearRadius + 4));
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(0, 0, gearRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  ctx.save();
  ctx.translate(pivotX, pivotY);
  ctx.rotate(angle);
  roundedRectPath(ctx, -halfWidth, -halfWidth, halfLength * 2, halfWidth * 2, 9);
  ctx.fillStyle = boxFill(box.kind);
  ctx.fill();
  ctx.strokeStyle = ink;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.strokeStyle = "rgba(28,22,16,0.42)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(8, -halfWidth * 0.35);
  ctx.lineTo(halfLength * 2 - 12, -halfWidth * 0.35);
  ctx.moveTo(10, halfWidth * 0.35);
  ctx.lineTo(halfLength * 2 - 16, halfWidth * 0.35);
  ctx.stroke();

  // Free-end cap gives players a clear force target.
  ctx.fillStyle = "rgba(28,22,16,0.55)";
  ctx.beginPath();
  ctx.arc(length, 0, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function paintPin(ctx: CanvasRenderingContext2D, pin: { x: number; y: number; id: string }, tile: number): void {
  const x = (pin.x + 0.5) * tile;
  const y = (pin.y + 0.5) * tile;
  ctx.beginPath();
  ctx.arc(x, y, 7, 0, Math.PI * 2);
  ctx.fillStyle = "#2d2117";
  ctx.fill();
  ctx.strokeStyle = brass;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, 2.5, 0, Math.PI * 2);
  ctx.fillStyle = "#e8d7b8";
  ctx.fill();
}

function paintPreview(
  ctx: CanvasRenderingContext2D,
  preview: SwingPreview,
  tile: number,
  activeEdgeId?: string | null,
): void {
  if (preview.arc) {
    const { pivot, radius, fromAngle, toAngle } = preview.arc;
    const cx = pivot.x * tile;
    const cy = pivot.y * tile;
    const r = radius * tile;
    ctx.beginPath();
    const steps = 48;
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      const a = fromAngle + (toAngle - fromAngle) * t;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = preview.completed ? "rgba(125,155,106,0.8)" : "rgba(229,164,76,0.9)";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  for (const pose of preview.poses) {
    if (!preview.affectedIds.includes(pose.id)) continue;
    ctx.beginPath();
    pose.polygon.forEach((point, index) => {
      const x = point.x * tile;
      const y = point.y * tile;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fillStyle = preview.completed ? "rgba(125,155,106,0.20)" : "rgba(181,106,50,0.24)";
    ctx.fill();
    ctx.strokeStyle = preview.completed ? moss : "#e5a44c";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  for (const hit of preview.contacts) {
    const isActive = !activeEdgeId || hit.edgeId === activeEdgeId;
    ctx.save();
    ctx.globalAlpha = activeEdgeId && !isActive ? 0.28 : 1;
    if (hit.edge) {
      ctx.beginPath();
      ctx.moveTo(hit.edge.a.x * tile, hit.edge.a.y * tile);
      ctx.lineTo(hit.edge.b.x * tile, hit.edge.b.y * tile);
      ctx.strokeStyle = "#ffd166";
      ctx.lineWidth = activeEdgeId === hit.edgeId ? 8 : 5;
      ctx.lineCap = "round";
      ctx.stroke();
      ctx.strokeStyle = "#d9362b";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(hit.point.x * tile, hit.point.y * tile, activeEdgeId === hit.edgeId ? 8 : 6, 0, Math.PI * 2);
    ctx.fillStyle = "#d9362b";
    ctx.fill();
    ctx.strokeStyle = "#ffd166";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }
}

function paintPlayer(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  tile: number,
  cleared: boolean,
): void {
  const c = tileCenter(x, y, tile);
  ctx.beginPath();
  ctx.arc(c.x, c.y, 13, 0, Math.PI * 2);
  ctx.fillStyle = cleared ? moss : brass;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = ink;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(c.x - 4, c.y - 3, 2, 0, Math.PI * 2);
  ctx.arc(c.x + 4, c.y - 3, 2, 0, Math.PI * 2);
  ctx.fillStyle = ink;
  ctx.fill();
}
