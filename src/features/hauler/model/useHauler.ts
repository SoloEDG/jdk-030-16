import { computed, ref, type Ref } from "vue";
import { boxesByKind } from "../lib/occupancy";
import { applyMove } from "../lib/push";
import { previewSwing } from "@/features/mechanism/lib/planDocument";
import type { Dir, GameDocument, MoveResult, SwingPreview } from "@/shared/types";

export function useHauler(document: Ref<GameDocument>) {
  const counts = computed(() => boxesByKind(document.value));
  const player = computed(() => document.value.level.player);
  const preview = ref<SwingPreview | null>(null);
  const blockedPreview = ref<SwingPreview | null>(null);

  function tryMove(dir: Dir): MoveResult {
    const result = applyMove(document.value, dir);
    if (result.preview && !result.preview.completed) {
      blockedPreview.value = result.preview;
      preview.value = result.preview;
      document.value.preview = result.preview;
    } else {
      blockedPreview.value = null;
      preview.value = null;
      document.value.preview = null;
    }
    return result;
  }

  function previewDirection(dir: Dir): SwingPreview | null {
    const next = previewSwing(document.value, dir);
    preview.value = next;
    document.value.preview = next;
    return next;
  }

  function clearPreview(): void {
    preview.value = blockedPreview.value;
    document.value.preview = blockedPreview.value;
  }

  function resetPreview(): void {
    preview.value = null;
    blockedPreview.value = null;
    document.value.preview = null;
  }

  return {
    counts,
    player,
    preview,
    blockedPreview,
    tryMove,
    previewDirection,
    clearPreview,
    resetPreview,
  };
}
