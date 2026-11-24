import { boxAt } from "./occupancy";
import { isPassable } from "@/features/gadget/lib/passable";
import { previewSwing } from "@/features/mechanism/lib/planDocument";
import { addVec } from "@/shared/document";
import { DIR_VEC, type Dir, type GameDocument, type MoveResult } from "@/shared/types";

export function applyMove(document: GameDocument, dir: Dir): MoveResult {
  if (document.attempt.status === "cleared") return { moved: false, pushed: false, reason: "cleared" };
  const delta = DIR_VEC[dir];
  const next = addVec(document.level.player, delta);
  const box = boxAt(document, next);

  if (box?.shape === "beam") {
    const preview = previewSwing(document, dir);
    if (!preview) return { moved: false, pushed: false, reason: "blocked" };

    if (preview.reason === "pin-force") {
      return { moved: false, pushed: false, reason: "pin", preview };
    }

    if (!preview.completed) {
      return {
        moved: false,
        pushed: false,
        reason: preview.reason === "transmission-conflict" ? "transmission" : "blocked",
        preview,
      };
    }

    if (!isPassable(document, next, { ignoreBoxId: box.id, ignorePlayer: true })) {
      return { moved: false, pushed: false, reason: "blocked", preview: { ...preview, completed: false } };
    }

    // Atomic commit: every meshed body in the transmission shares one step.
    for (const pose of preview.poses) {
      const target = document.level.boxes.find((item) => item.id === pose.id);
      if (target) target.angle = pose.angle;
    }
    preview.committed = true;
    document.level.player = next;
    document.preview = null;
    return { moved: true, pushed: true, boxId: box.id, preview };
  }

  if (box) {
    const beyond = addVec(box, delta);
    if (!isPassable(document, beyond, { ignoreBoxId: box.id, ignorePlayer: true })) {
      return { moved: false, pushed: false, reason: "blocked" };
    }
    box.x = beyond.x;
    box.y = beyond.y;
    document.level.player = next;
    return { moved: true, pushed: true, boxId: box.id };
  }
  if (!isPassable(document, next)) return { moved: false, pushed: false, reason: "blocked" };
  document.level.player = next;
  return { moved: true, pushed: false };
}
