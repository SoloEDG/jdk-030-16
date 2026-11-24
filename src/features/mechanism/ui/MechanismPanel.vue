<script setup lang="ts">
import type { Dir, SwingPreview } from "@/shared/types";

defineProps<{ preview: SwingPreview | null }>();
const emit = defineEmits<{
  (e: "preview", dir: Dir): void;
  (e: "apply", dir: Dir): void;
  (e: "clear"): void;
  (e: "selectEdge", edgeId: string | null): void;
}>();

const directions: Array<{ dir: Dir; label: string; key: string }> = [
  { dir: "n", label: "北 ↑", key: "w / ↑" },
  { dir: "w", label: "西 ←", key: "a / ←" },
  { dir: "s", label: "南 ↓", key: "s / ↓" },
  { dir: "e", label: "东 →", key: "d / →" },
];

function degrees(value: number): string {
  return `${(value * 180) / Math.PI}°`;
}

function degreeNumber(value: number): number {
  return Math.round((value * 180) / Math.PI * 100) / 100;
}
</script>

<template>
  <section class="panel mechanism" aria-label="长箱摆动推演" data-testid="mechanism-panel">
    <h2>插销 / 齿圈扫掠</h2>
    <p class="lede">悬停或聚焦方向可预览受力；只有完整扫过 90°，实际按键才计一步并刷新踏板与签收。</p>

    <div class="dir-grid" data-testid="direction-preview">
      <button
        v-for="item in directions"
        :key="item.dir"
        type="button"
        class="dir-button"
        :data-dir="item.dir"
        :aria-label="`向${item.label}用力并预览`"
        @mouseenter="emit('preview', item.dir)"
        @focus="emit('preview', item.dir)"
        @mouseleave="emit('clear')"
        @blur="emit('clear')"
        @click="emit('apply', item.dir)"
      >
        {{ item.label }}
      </button>
    </div>

    <output
      class="preview-output"
      data-testid="swing-preview"
      :data-completed="preview?.completed ? 'true' : 'false'"
      :data-reason="preview?.reason ?? (preview ? 'clear' : 'idle')"
      aria-live="polite"
    >
      <template v-if="!preview">走到长箱的自由端旁，或悬停上方方向钮。</template>
      <template v-else-if="preview.reason === 'pin-force'">
        {{ preview.contacts[0]?.message ?? "力作用在插销上，无法转动。" }}
      </template>
      <template v-else-if="preview.reason === 'transmission-conflict'">
        在 {{ degrees(preview.blockTravel) }} 处有两组不能同时成立的传动，已停止且未推动任何箱子。
      </template>
      <template v-else-if="!preview.completed">
        第一处受阻角度：受力行程 {{ degrees(preview.blockTravel) }}；长箱绝对角
        {{ degrees(preview.blockAngle) }}。未走满，不计步。
      </template>
      <template v-else>四分之一圈扫掠无碰撞，可以走满；所有啮合齿箱将在同一步原子转动。</template>
    </output>

    <div
      v-if="preview && !preview.completed && preview.reason !== 'pin-force'"
      class="hit-data"
      data-testid="blocked-angle"
      :data-travel="preview.blockTravel"
      :data-travel-degrees="degreeNumber(preview.blockTravel)"
      :data-angle="preview.blockAngle"
      :data-angle-degrees="degreeNumber(preview.blockAngle)"
      :data-contact-count="preview.contacts.length"
    >
      <span>第一受阻角</span>
      <strong>{{ degrees(preview.blockTravel) }}</strong>
      <code
        v-if="preview.contacts[0]?.edgeId"
        data-testid="first-collision-edge"
        :data-edge-id="preview.contacts[0].edgeId"
      >
        {{ preview.contacts[0].edgeId }}
      </code>
    </div>

    <ul v-if="preview?.contacts.length" class="edge-list" data-testid="collision-edge-list">
      <li
        v-for="(hit, index) in preview.contacts"
        :key="hit.id"
        :data-testid="`collision-edge-${index}`"
        :data-edge-id="hit.edgeId"
        :data-obstacle-id="hit.obstacleId"
      >
        <button
          type="button"
          class="edge-select"
          :aria-label="`在盘上指出 ${hit.edgeId ?? hit.obstacleId}`"
          @mouseenter="emit('selectEdge', hit.edgeId ?? null)"
          @focus="emit('selectEdge', hit.edgeId ?? null)"
          @mouseleave="emit('selectEdge', null)"
          @blur="emit('selectEdge', null)"
        >
          <span class="edge-dot" aria-hidden="true"></span>
          <code>{{ hit.edgeId ?? hit.obstacleId }}</code>
          <small>
            {{ hit.obstacleKind }} · {{ degrees(hit.travel) }}
            <template v-if="hit.message"> · {{ hit.message }}</template>
          </small>
        </button>
      </li>
    </ul>
  </section>
</template>
