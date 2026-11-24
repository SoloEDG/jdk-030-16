<script setup lang="ts">
import { BOX_LABEL, type BoxKind } from "@/shared/types";

defineProps<{ counts: Record<string, number> }>();
const kinds: BoxKind[] = ["timber", "iron", "glass", "rack"];
</script>

<template>
  <section class="panel mover" aria-label="推动说明">
    <h2>推动</h2>
    <p class="lede">方向键或 WASD 移动一格。旧单格货箱直推；碰到带插销的长箱自由端时，会先做四分之一圈扫掠推演。</p>
    <ul class="counts">
      <li v-for="kind in kinds" :key="kind">
        <span :class="['chip', kind]">{{ BOX_LABEL[kind] }}</span>
        × {{ counts[kind] ?? 0 }}
      </li>
    </ul>
  </section>
</template>
