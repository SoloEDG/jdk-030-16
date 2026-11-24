<script setup lang="ts">
defineProps<{ steps: number; status: string; coverage: string }>();
</script>

<template>
  <section class="panel ledger" aria-label="步数记录">
    <h2>步数</h2>
    <p class="steps" data-testid="step-count" :data-status="status">{{ steps }}</p>
    <p class="lede">{{ coverage }}</p>
    <p v-if="status === 'cleared'" class="cleared">本关已通关，移动暂时冻结。可重置本关或改选其他关卡。</p>
    <p v-else class="hint">普通货箱直推一格记一步；长箱必须完整扫过四分之一圈，啮合齿箱会在同一步一起转动。受阻的半程不计数。</p>
  </section>
</template>
