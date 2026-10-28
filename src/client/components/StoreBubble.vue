<template>
  <div class="store-bubble p-3 max-w-sm bg-white rounded-lg shadow-sm text-sm">
    <div class="flex items-center justify-between gap-2 mb-2">
      <span class="text-xs font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
        Abgabestelle
      </span>
      <div class="flex items-center gap-1.5">
        <span 
          v-if="store.giving_details.giving_status === 1" 
          class="text-xs font-medium px-2 py-0.5 rounded bg-emerald-100 text-emerald-800"
        >
          Aktuell
        </span>
        <span 
          v-else-if="store.giving_details.giving_status === 2" 
          class="text-xs font-medium px-2 py-0.5 rounded bg-amber-100 text-amber-800"
        >
          In Prüfung
        </span>
        <span 
          v-else 
          class="text-xs font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-700"
        >
          Pausiert
        </span>

        <span 
          v-if="store.giving_details.registration_required === 0" 
          class="text-xs font-medium px-2 py-0.5 rounded bg-teal-100 text-teal-800"
        >
          Ohne Voranmeldung
        </span>
        <span 
          v-else 
          class="text-xs font-medium px-2 py-0.5 rounded bg-sky-100 text-sky-800"
        >
          Voranmeldung nötig
        </span>
      </div>
    </div>

    <h3 class="text-base font-bold text-slate-900 leading-snug mb-1">
      {{ store.name }}
    </h3>
    <p class="text-xs text-slate-500 mb-2">
      {{ store.str }}, {{ store.plz }} {{ store.stadt }}
      <span v-if="store.region_name">({{ store.region_name }})</span>
    </p>

    <div v-if="store.giving_details.dropoff_times" class="mb-2 bg-slate-50 p-2 rounded border border-slate-100">
      <div class="text-xs font-semibold text-slate-700 mb-0.5 flex items-center gap-1">
        <span>🕒</span> Annahmezeiten:
      </div>
      <div class="text-xs text-slate-600 whitespace-pre-line leading-relaxed">
        {{ store.giving_details.dropoff_times }}
      </div>
    </div>

    <div v-if="store.giving_details.accepted_items" class="mb-2">
      <div class="text-xs font-semibold text-slate-700 mb-0.5 flex items-center gap-1">
        <span>📦</span> Angenommen:
      </div>
      <div class="text-xs text-slate-600 line-clamp-2">
        {{ store.giving_details.accepted_items }}
      </div>
    </div>

    <div class="flex flex-wrap items-center gap-3 text-xs text-slate-600 pt-1 border-t border-slate-100 mb-3">
      <a 
        v-if="store.giving_details.public_phone" 
        :href="'tel:' + store.giving_details.public_phone" 
        class="text-amber-600 hover:text-amber-700 font-medium flex items-center gap-1"
      >
        <span>📞</span> {{ store.giving_details.public_phone }}
      </a>
      <a 
        v-if="store.giving_details.website" 
        :href="store.giving_details.website" 
        target="_blank" 
        rel="noopener noreferrer" 
        class="text-amber-600 hover:text-amber-700 font-medium flex items-center gap-1"
      >
        <span>🌐</span> Webseite
      </a>
    </div>

    <div class="flex items-center gap-2 pt-1">
      <router-link 
        :to="'/stores/' + store.id" 
        class="flex-1 text-center bg-amber-600 hover:bg-amber-700 text-white font-medium py-1.5 px-3 rounded text-xs transition-colors"
      >
        Details anzeigen
      </router-link>
      <button 
        @click="$emit('suggestChange', store)" 
        type="button" 
        class="bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-1.5 px-2.5 rounded text-xs transition-colors"
      >
        Änderung melden
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { PublicStore } from '@shared/types';

defineProps<{
  store: PublicStore;
}>();

defineEmits<{
  (e: 'suggestChange', store: PublicStore): void;
}>();
</script>
