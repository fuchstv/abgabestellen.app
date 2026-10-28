<template>
  <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
    <!-- Header with badges -->
    <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
      <div>
        <span class="text-xs font-semibold px-2.5 py-1 rounded bg-amber-100 text-amber-800">
          Abgabestelle / Soziale Einrichtung
        </span>
      </div>
      <div class="flex items-center gap-2">
        <span 
          v-if="store.giving_details.giving_status === 1" 
          class="text-xs font-semibold px-2.5 py-1 rounded bg-emerald-100 text-emerald-800"
        >
          ✓ Aktuell verifiziert
        </span>
        <span 
          v-else-if="store.giving_details.giving_status === 2" 
          class="text-xs font-semibold px-2.5 py-1 rounded bg-amber-100 text-amber-800"
        >
          ⚠ In Aktualisierung
        </span>
        <span 
          v-else 
          class="text-xs font-semibold px-2.5 py-1 rounded bg-slate-100 text-slate-700"
        >
          ⏸ Vorübergehend pausiert
        </span>

        <span 
          v-if="store.giving_details.registration_required === 0" 
          class="text-xs font-semibold px-2.5 py-1 rounded bg-teal-100 text-teal-800"
        >
          Ohne telefonische Voranmeldung
        </span>
        <span 
          v-else 
          class="text-xs font-semibold px-2.5 py-1 rounded bg-sky-100 text-sky-800"
        >
          Voranmeldung nötig
        </span>
      </div>
    </div>

    <!-- Drop-off times schedule -->
    <div>
      <h3 class="text-sm font-bold text-slate-900 flex items-center gap-2 mb-2">
        <span class="text-amber-600">🕒</span> Wann können Lebensmittel abgegeben werden?
      </h3>
      <div class="bg-slate-50 border border-slate-200 rounded-lg p-3.5 text-sm text-slate-800 whitespace-pre-line leading-relaxed">
        {{ store.giving_details.dropoff_times || 'Keine genauen Annahmezeiten hinterlegt. Bitte vorab telefonisch abstimmen.' }}
      </div>
    </div>

    <!-- Accepted items -->
    <div>
      <h3 class="text-sm font-bold text-slate-900 flex items-center gap-2 mb-2">
        <span class="text-amber-600">📦</span> Was wird angenommen?
      </h3>
      <div class="bg-slate-50 border border-slate-200 rounded-lg p-3.5 text-sm text-slate-800 whitespace-pre-line leading-relaxed">
        {{ store.giving_details.accepted_items || 'Generell verzehrfähige Lebensmittel. Details vor Ort erfragen.' }}
      </div>
    </div>

    <!-- Grid: Public Contacts & Recipients -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
      <div class="bg-slate-50 border border-slate-100 p-3.5 rounded-lg space-y-1">
        <div class="text-xs font-medium text-slate-500">Öffentlicher Kontakt</div>
        <div class="text-sm font-semibold text-slate-900">
          {{ store.giving_details.public_contact_name || 'Zentrale Annahme' }}
        </div>
        <div v-if="store.giving_details.public_phone">
          <a :href="'tel:' + store.giving_details.public_phone" class="text-sm text-amber-600 hover:underline">
            📞 {{ store.giving_details.public_phone }}
          </a>
        </div>
      </div>

      <div class="bg-slate-50 border border-slate-100 p-3.5 rounded-lg space-y-1">
        <div class="text-xs font-medium text-slate-500">Webseite & Reichweite</div>
        <div v-if="store.giving_details.website">
          <a :href="store.giving_details.website" target="_blank" rel="noopener noreferrer" class="text-sm text-amber-600 hover:underline break-all">
            🌐 {{ store.giving_details.website }}
          </a>
        </div>
        <div class="text-xs text-slate-600 pt-1">
          👥 Abnehmerkreis: {{ store.giving_details.recipient_count || 'k.A.' }}
        </div>
      </div>
    </div>

    <!-- Arrival / Gate instructions -->
    <div v-if="store.public_info">
      <h4 class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
        Hinweise zur Anlieferung
      </h4>
      <p class="text-sm text-slate-700 bg-amber-50/50 border border-amber-100 p-3 rounded-lg">
        {{ store.public_info }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { PublicStore } from '@shared/types';

defineProps<{
  store: PublicStore;
}>();
</script>
