<template>
  <div
    aria-live="polite"
    class="fixed top-16 right-4 z-[70] flex flex-col gap-2.5 w-full max-w-sm pointer-events-none px-4 sm:px-0"
  >
    <TransitionGroup
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="translate-y-2 opacity-0 scale-95"
      enter-to-class="translate-y-0 opacity-100 scale-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-for="toast in toastState.items"
        :key="toast.id"
        :class="[
          'pointer-events-auto rounded-fs border shadow-fs px-3.5 py-3 flex items-start gap-2.5 text-xs',
          toast.type === 'success'
            ? 'bg-fs-secondary-100 border-fs-secondary-500 text-fs-secondary-900 border-l-4'
            : toast.type === 'error'
              ? 'bg-fs-danger-100 border-fs-danger-500 text-fs-danger-900 border-l-4'
              : 'bg-fs-info-100 border-fs-info-500 text-fs-info-900 border-l-4'
        ]"
      >
        <CheckCircle2
          v-if="toast.type === 'success'"
          class="w-4 h-4 text-fs-secondary-600 shrink-0 mt-0.5"
        />
        <AlertTriangle
          v-else-if="toast.type === 'error'"
          class="w-4 h-4 text-fs-danger-600 shrink-0 mt-0.5"
        />
        <Info
          v-else
          class="w-4 h-4 text-fs-info-600 shrink-0 mt-0.5"
        />

        <p class="flex-1 font-medium leading-relaxed">
          {{ toast.message }}
        </p>

        <button
          type="button"
          @click="dismissToast(toast.id)"
          class="opacity-60 hover:opacity-100 transition-opacity p-0.5 rounded cursor-pointer"
          aria-label="Hinweis schließen"
        >
          <X class="w-3.5 h-3.5" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup lang="ts">
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-vue-next';
import { toastState, dismissToast } from '../state';
</script>
