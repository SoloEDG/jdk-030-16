<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from "vue";
import { paintStage, sizeCanvas, TILE } from "../lib/draw";
import { pointSegmentClosest } from "@/features/mechanism/lib/geometry";
import type { GameDocument, SwingPreview } from "@/shared/types";

const props = defineProps<{
  document: GameDocument;
  preview?: SwingPreview | null;
  activeEdgeId?: string | null;
}>();
const emit = defineEmits<{ (e: "hoverEdge", edgeId: string | null): void }>();
const canvas = ref<HTMLCanvasElement | null>(null);
const hoverPoint = ref<{ x: number; y: number } | null>(null);
let lastEdgeId: string | null = null;

function render() {
  const el = canvas.value;
  if (!el) return;
  const ctx = sizeCanvas(el, props.document.level.width, props.document.level.height, TILE);
  paintStage(ctx, props.document, TILE, props.preview ?? props.document.preview ?? null, props.activeEdgeId);
}

function onPointerMove(event: PointerEvent): void {
  const el = canvas.value;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const point = {
    x: (event.clientX - rect.left) / TILE,
    y: (event.clientY - rect.top) / TILE,
  };
  hoverPoint.value = point;

  let nextEdgeId: string | null = null;
  let bestDistance = 0.22;
  for (const hit of props.preview?.contacts ?? []) {
    if (!hit.edge || !hit.edgeId) continue;
    const distance = pointSegmentClosest(point, hit.edge.a, hit.edge.b).distance;
    if (distance < bestDistance) {
      bestDistance = distance;
      nextEdgeId = hit.edgeId;
    }
  }
  el.style.cursor = nextEdgeId ? "pointer" : "crosshair";
  if (nextEdgeId !== lastEdgeId) {
    lastEdgeId = nextEdgeId;
    emit("hoverEdge", nextEdgeId);
  }
}

function onPointerLeave(): void {
  hoverPoint.value = null;
  if (lastEdgeId !== null) {
    lastEdgeId = null;
    emit("hoverEdge", null);
  }
}

onMounted(render);
watch(() => props.document, render, { deep: true });
watch(() => props.preview, render, { deep: true });
watch(() => props.activeEdgeId, render);
onUnmounted(() => {
  canvas.value = null;
});
</script>

<template>
  <div class="stage-frame" data-testid="board" data-board="stage">
    <canvas
      ref="canvas"
      class="stage-canvas"
      data-testid="stage-canvas"
      role="img"
      :aria-label="`${document.level.title} 关卡地图${preview && !preview.completed ? '，已标出第一处受阻边' : ''}`"
      @pointermove="onPointerMove"
      @pointerleave="onPointerLeave"
    />
    <span v-if="hoverPoint" class="pointer-coordinate" data-testid="pointer-coordinate">
      {{ Math.floor(hoverPoint.x) }}, {{ Math.floor(hoverPoint.y) }}
      <template v-if="activeEdgeId"> · {{ activeEdgeId }}</template>
    </span>
  </div>
</template>
