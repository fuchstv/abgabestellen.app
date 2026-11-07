<template>
  <section class="fs-container">
    <div v-if="!hideHeader" class="fs-container-header">
      <div class="flex items-center gap-2 min-w-0">
        <slot name="icon" />
        <slot name="title">
          <h2 class="font-sans text-sm font-bold text-fs-primary-900 truncate m-0">
            {{ title }}
          </h2>
        </slot>
      </div>
      <div v-if="$slots.actions" class="flex items-center gap-2 shrink-0">
        <slot name="actions" />
      </div>
    </div>
    <div :class="bodyClass">
      <slot />
    </div>
  </section>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    title?: string;
    hideHeader?: boolean;
    bodyClass?: string;
  }>(),
  {
    title: '',
    hideHeader: false,
    bodyClass: 'p-5'
  }
);
</script>
