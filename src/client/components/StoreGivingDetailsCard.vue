<template>
  <FsContainer title="Annahmekonditionen & Öffentliche Informationen" body-class="p-5 sm:p-6 space-y-6">
    <template #icon>
      <ClipboardList class="w-4 h-4 text-fs-primary-700" />
    </template>

    <template #actions>
      <div class="flex flex-wrap items-center gap-1.5">
        <span
          v-if="store.giving_details.giving_status === 1"
          class="fs-badge-green"
        >
          <CheckCircle2 class="w-3 h-3" />
          Aktuell verifiziert
        </span>
        <span
          v-else-if="store.giving_details.giving_status === 2"
          class="fs-badge-ochre"
        >
          <AlertCircle class="w-3 h-3" />
          In Aktualisierung
        </span>
        <span
          v-else
          class="fs-badge-gray"
        >
          <PauseCircle class="w-3 h-3" />
          Vorübergehend pausiert
        </span>

        <span
          v-if="store.giving_details.registration_required === 0"
          class="fs-badge-green"
        >
          Ohne Voranmeldung
        </span>
        <span
          v-else
          class="fs-badge-ochre"
        >
          <PhoneCall class="w-3 h-3" />
          Voranmeldung nötig
        </span>
      </div>
    </template>

    <!-- Drop-off times schedule -->
    <div>
      <h4 class="text-sm font-bold text-fs-primary-800 flex items-center gap-2 mb-2">
        <Clock class="w-4 h-4 text-fs-secondary-600 shrink-0" />
        <span>Wann können Lebensmittel abgegeben werden?</span>
      </h4>
      <div class="bg-fs-bg border border-fs-primary-200 rounded-fs p-3.5 text-sm text-fs-text whitespace-pre-line leading-relaxed">
        {{ store.giving_details.dropoff_times || 'Keine genauen Annahmezeiten hinterlegt. Bitte vorab telefonisch abstimmen.' }}
      </div>
    </div>

    <!-- Accepted items -->
    <div>
      <h4 class="text-sm font-bold text-fs-primary-800 flex items-center gap-2 mb-2">
        <PackageCheck class="w-4 h-4 text-fs-secondary-600 shrink-0" />
        <span>Was wird angenommen?</span>
      </h4>
      <div class="bg-fs-bg border border-fs-primary-200 rounded-fs p-3.5 text-sm text-fs-text whitespace-pre-line leading-relaxed">
        {{ store.giving_details.accepted_items || 'Generell verzehrfähige Lebensmittel. Details vor Ort erfragen.' }}
      </div>
    </div>

    <!-- Grid: Public Contacts & Recipients -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
      <div class="bg-fs-bg border border-fs-primary-200 p-4 rounded-fs space-y-1.5">
        <div class="text-xs font-semibold text-fs-muted uppercase tracking-wide">
          Öffentlicher Kontakt
        </div>
        <div class="text-sm font-bold text-fs-primary-900">
          {{ store.giving_details.public_contact_name || 'Zentrale Annahme' }}
        </div>
        <div v-if="store.giving_details.public_phone" class="pt-0.5">
          <a
            :href="'tel:' + store.giving_details.public_phone"
            class="text-sm font-semibold text-fs-secondary-700 hover:text-fs-secondary-800 inline-flex items-center gap-1.5 hover:underline"
          >
            <Phone class="w-3.5 h-3.5 text-fs-secondary-600" />
            <span>{{ store.giving_details.public_phone }}</span>
          </a>
        </div>
      </div>

      <div class="bg-fs-bg border border-fs-primary-200 p-4 rounded-fs space-y-1.5">
        <div class="text-xs font-semibold text-fs-muted uppercase tracking-wide">
          Webseite & Reichweite
        </div>
        <div v-if="store.giving_details.website">
          <a
            :href="store.giving_details.website"
            target="_blank"
            rel="noopener noreferrer"
            class="text-sm font-semibold text-fs-secondary-700 hover:text-fs-secondary-800 inline-flex items-center gap-1.5 hover:underline break-all"
          >
            <Globe class="w-3.5 h-3.5 text-fs-secondary-600 shrink-0" />
            <span>{{ store.giving_details.website }}</span>
          </a>
        </div>
        <div class="text-xs text-fs-text pt-1 flex items-center gap-1.5">
          <Users class="w-3.5 h-3.5 text-fs-primary-500 shrink-0" />
          <span>Abnehmerkreis: <strong>{{ store.giving_details.recipient_count || 'k.A.' }}</strong></span>
        </div>
      </div>
    </div>

    <!-- Arrival / Gate instructions -->
    <div v-if="store.public_info">
      <h4 class="text-xs font-bold text-fs-muted uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
        <Info class="w-3.5 h-3.5 text-fs-warning-600" />
        <span>Hinweise zur Anlieferung</span>
      </h4>
      <p class="text-sm text-fs-warning-900 bg-fs-warning-100 border border-fs-warning-300 border-l-4 border-l-fs-warning-500 p-3.5 rounded-fs leading-relaxed">
        {{ store.public_info }}
      </p>
    </div>
  </FsContainer>
</template>

<script setup lang="ts">
import {
  ClipboardList,
  CheckCircle2,
  AlertCircle,
  PauseCircle,
  PhoneCall,
  Clock,
  PackageCheck,
  Phone,
  Globe,
  Users,
  Info
} from 'lucide-vue-next';
import { PublicStore } from '@shared/types';
import FsContainer from './FsContainer.vue';

defineProps<{
  store: PublicStore;
}>();
</script>
