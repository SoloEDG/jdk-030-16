import { DIR_VEC, type Dir, type GameDocument, type SwingPreview } from "@/shared/types";
import { addVec } from "@/shared/document";
import { boxAt } from "@/features/hauler/lib/occupancy";
import { SWEEP_ANGLE } from "./geometry";
import { planRotation, type BodySpec } from "./kinematics";
import { pinPosition, shapeForBox, wallShape, cellBlockShape } from "./shapes";

function radiusFromPivot(document: GameDocument, box: GameDocument["level"]["boxes"][number]): number {
  const pivot = pinPosition(document.level, box);
  const polygon = shapeForBox(document.level, box).polygon;
  return Math.max(...polygon.map((point) => Math.hypot(point.x - pivot.x, point.y - pivot.y)));
}

function staticShapes(document: GameDocument) {
  const { level } = document;
  const shapes = [];
  for (let y = 0; y < level.height; y += 1) {
    for (let x = 0; x < level.width; x += 1) {
      const tile = level.tiles[y][x];
      if (tile === "wall") shapes.push(wallShape(x, y));
      if (tile === "gap") {
        const bridge = level.floors.find(
          (floor) => floor.x === x && floor.y === y && floor.morph === "bridge" && floor.active,
        );
        if (!bridge) {
          shapes.push(cellBlockShape(`gap-${x}-${y}`, x, y, "gap", `gap:${x},${y}`));
        }
      }
    }
  }
  for (const door of level.doors) {
    if (!door.open) shapes.push(cellBlockShape(`door-${door.id}`, door.x, door.y, "door", `door:${door.id}`));
  }
  for (const floor of level.floors) {
    if (floor.morph === "seal" && floor.active) {
      shapes.push(cellBlockShape(`seal-${floor.id}`, floor.x, floor.y, "floor", `floor:${floor.id}`));
    }
  }
  return shapes;
}

function invalidPreview(
  document: GameDocument,
  driverId: string,
  dir: Dir,
  handedness: 1 | -1,
  reason: "pin-force",
  message: string,
): SwingPreview {
  const box = document.level.boxes.find((item) => item.id === driverId)!;
  const pivot = pinPosition(document.level, box);
  const angle = box.angle ?? 0;
  return {
    kind: "swing",
    driverId,
    dir,
    handedness,
    targetTravel: SWEEP_ANGLE,
    blockTravel: 0,
    reachableTravel: 0,
    blockAngle: angle,
    completed: false,
    affectedIds: [driverId],
    contacts: [
      {
        id: `pin-force-${driverId}`,
        travel: 0,
        point: pivot,
        actorId: driverId,
        obstacleId: box.pinId ?? driverId,
        obstacleKind: "pin",
        edgeId: box.pinId ? `pin:${box.pinId}` : `pin:${driverId}`,
        message,
      },
    ],
    poses: [
      {
        id: driverId,
        angle,
        polygon: shapeForBox(document.level, box).polygon,
      },
    ],
    arc: { pivot, radius: radiusFromPivot(document, box), fromAngle: angle, toAngle: angle },
    reason,
  };
}

export function previewSwing(document: GameDocument, dir: Dir): SwingPreview | null {
  if (document.attempt.status === "cleared") return null;
  const delta = DIR_VEC[dir];
  const next = addVec(document.level.player, delta);
  const box = boxAt(document, next);
  if (!box || box.shape !== "beam") return null;

  const pivot = pinPosition(document.level, box);
  const pin = document.level.pins?.find((item) => item.id === box.pinId);
  const onPinCell = pin ? pin.x === next.x && pin.y === next.y : box.x === next.x && box.y === next.y;
  if (onPinCell) {
    return invalidPreview(document, box.id, dir, 1, "pin-force", "力作用在固定插销上，不能产生摆动力矩");
  }

  const contact = { x: next.x + 0.5, y: next.y + 0.5 };
  const lever = { x: contact.x - pivot.x, y: contact.y - pivot.y };
  const torque = lever.x * delta.y - lever.y * delta.x;
  if (Math.abs(torque) < 1e-6) {
    return invalidPreview(document, box.id, dir, 1, "pin-force", "推力经过插销，长箱不会转动");
  }
  const handedness: 1 | -1 = torque > 0 ? 1 : -1;

  const bodies: BodySpec[] = document.level.boxes.map((item) => ({
    id: item.id,
    pivot: pinPosition(document.level, item),
    baseAngle: item.angle ?? 0,
    radius: radiusFromPivot(document, item),
    teeth: item.teeth,
    gearRadius: item.gearRadius,
    shapeAt: (angle) => shapeForBox(document.level, item, angle),
  }));

  const preview = planRotation({
    driverId: box.id,
    handedness,
    dir,
    bodies,
    staticShapes: staticShapes(document),
    links: document.level.links ?? [],
  });
  return preview;
}
