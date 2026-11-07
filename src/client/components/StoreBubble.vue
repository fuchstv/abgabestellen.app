<template>
  <div class="fs-container shadow-fs w-full sm:w-[370px] text-sm">
    <!-- Warm foodsharing Container Header -->
    <div class="fs-container-header !py-2 !px-3.5">
      <div class="flex items-center gap-1.5 flex-wrap">
        <span class="inline-flex items-center gap-1 text-[11px] font-bold text-fs-primary-900">
          <HandHeart class="w-3.5 h-3.5 text-fs-secondary-600" />
          <span>Abgabestelle</span>
        </span>

        <span
          v-if="isPaused"
          class="fs-badge-gray !text-[10px] !py-0"
        >
          Pausiert / Inaktiv
        </span>
        <span
          v-else-if="store.giving_details.giving_status === 1"
          class="fs-badge-green !text-[10px] !py-0"
        >
          <CheckCircle2 class="w-2.5 h-2.5" />
          Aktuell
        </span>
        <span
          v-else-if="store.giving_details.giving_status === 2"
          class="fs-badge-ochre !text-[10px] !py-0"
        >
          In Prüfung
        </span>
      </div>

      <button
        type="button"
        @click="$emit('close')"
        class="p-1 rounded-fs text-fs-primary-700 hover:text-fs-danger-600 hover:bg-fs-primary-300/60 transition-colors cursor-pointer"
        title="Schließen"
        aria-label="Karten-Vorschau schließen"
      >
        <X class="w-4 h-4" />
      </button>
    </div>

    <!-- Body -->
    <div class="p-3.5 space-y-2.5 bg-fs-surface">
      <div>
        <div class="flex items-start justify-between gap-2">
          <h3 class="font-headline text-base text-fs-primary-700 leading-snug">
            {{ store.name }}
          </h3>
        </div>

        <p class="text-xs text-fs-muted mt-1 flex items-start gap-1.5">
          <MapPin class="w-3.5 h-3.5 text-fs-primary-500 shrink-0 mt-0.5" />
          <span>
            {{ store.str }}, {{ store.plz }} {{ store.stadt }}
            <span v-if="store.region_name" class="text-fs-muted/80">({{ store.region_name }})</span>
          </span>
        </p>

        <div class="mt-2">
          <span
            v-if="store.giving_details.registration_required === 0"
            class="fs-badge-green"
          >
            <CheckCircle2 class="w-3 h-3" />
            Ohne telefonische Voranmeldung
          </span>
          <span
            v-else
            class="fs-badge-ochre"
          >
            <PhoneCall class="w-3 h-3" />
            Telefonische Voranmeldung nötig
          </span>
        </div>
      </div>

      <!-- Drop-off Schedule Block -->
      <div
        v-if="store.giving_details.dropoff_times"
        class="bg-fs-bg border border-fs-primary-200 rounded-fs p-2.5"
      >
        <div class="text-[11px] font-bold text-fs-primary-800 mb-0.5 flex items-center gap-1.5">
          <Clock class="w-3.5 h-3.5 text-fs-secondary-600 shrink-0" />
          <span>Annahmezeiten</span>
        </div>
        <div class="text-xs text-fs-text whitespace-pre-line leading-relaxed">
          {{ store.giving_details.dropoff_times }}
        </div>
      </div>

      <!-- Accepted Goods Block -->
      <div
        v-if="store.giving_details.accepted_items"
        class="bg-fs-bg border border-fs-primary-200 rounded-fs p-2.5"
      >
        <div class="text-[11px] font-bold text-fs-primary-800 mb-0.5 flex items-center gap-1.5">
          <PackageCheck class="w-3.5 h-3.5 text-fs-secondary-600 shrink-0" />
          <span>Angenommene Lebensmittel</span>
        </div>
        <div class="text-xs text-fs-text line-clamp-2 leading-relaxed">
          {{ store.giving_details.accepted_items }}
        </div>
      </div>

      <!-- Quick Links: Phone, Website, Route -->
      <div class="flex flex-wrap items-center gap-3 text-xs pt-1.5 border-t border-fs-primary-200">
        <a
          v-if="store.giving_details.public_phone"
          :href="'tel:' + store.giving_details.public_phone"
          class="text-fs-secondary-700 hover:text-fs-secondary-800 font-semibold inline-flex items-center gap-1 hover:underline"
        >
          <Phone class="w-3.5 h-3.5 text-fs-secondary-600" />
          <span>{{ store.giving_details.public_phone }}</span>
        </a>
        <a
          v-if="store.giving_details.website"
          :href="store.giving_details.website"
          target="_blank"
          rel="noopener noreferrer"
          class="text-fs-secondary-700 hover:text-fs-secondary-800 font-semibold inline-flex items-center gap-1 hover:underline"
        >
          <Globe class="w-3.5 h-3.5 text-fs-secondary-600" />
          <span>Webseite</span>
        </a>
        <a
          :href="directionsUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="text-fs-primary-600 hover:text-fs-primary-800 font-semibold inline-flex items-center gap-1 hover:underline ml-auto"
        >
          <Navigation class="w-3.5 h-3.5" />
          <span>Route</span>
        </a>
      </div>

      <!-- Footer Action Buttons -->
      <div class="flex items-center gap-2 pt-1">
        <router-link
          :to="'/stores/' + store.id"
          class="flex-1 fs-btn-primary"
        >
          <span>Details anzeigen</span>
          <ArrowRight class="w-3.5 h-3.5" />
        </router-link>
        <button
          @click="$emit('suggestChange', store)"
          type="button"
          class="fs-btn-secondary !px-2.5"
        >
          <MessageSquarePlus class="w-3.5 h-3.5" />
          <span>Änderung</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import {
  HandHeart,
  CheckCircle2,
  PhoneCall,
  X,
  MapPin,
  Clock,
  PackageCheck,
  Phone,
  Globe,
  Navigation,
  ArrowRight,
  MessageSquarePlus
} from 'lucide-vue-next';
import { PublicStore } from '@shared/types';

const props = defineProps<{
  store: PublicStore;
}>();

defineEmits<{
  (e: 'suggestChange', store: PublicStore): void;
  (e: 'close'): void;
}>();

const isPaused = computed(() => {
  return props.store.giving_details.giving_status === 3 || /\binaktiv\b/i.test(props.store.name);
});

const directionsUrl = computed(() => {
  const s = props.store;
  if (s.lat && s.lon) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${s.lat},${s.lon}`)}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${s.name} ${s.str} ${s.plz} ${s.stadt}`)}`;
});
</script>
