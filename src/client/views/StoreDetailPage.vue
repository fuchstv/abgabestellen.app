<template>
  <div class="max-w-4xl mx-auto px-4 py-6 sm:py-8 space-y-5 flex-1 w-full">
    <!-- Breadcrumbs -->
    <nav class="flex items-center gap-1.5 text-xs text-fs-muted flex-wrap">
      <router-link to="/" class="hover:text-fs-secondary-600 inline-flex items-center gap-1 font-medium transition-colors">
        <MapIcon class="w-3.5 h-3.5 text-fs-secondary-600" />
        <span>Karte</span>
      </router-link>
      <span>/</span>
      <router-link
        :to="'/regions/' + (store?.bezirk_id || 1)"
        class="hover:text-fs-secondary-600 font-medium transition-colors"
      >
        {{ store?.region_name || 'Region' }}
      </router-link>
      <span>/</span>
      <span class="text-fs-primary-800 font-semibold truncate max-w-[260px]">{{ store?.name || 'Lade...' }}</span>
    </nav>

    <!-- Store Header Container -->
    <div v-if="store" class="fs-container">
      <div class="fs-container-header">
        <div class="flex items-center gap-2 text-xs font-bold text-fs-primary-900">
          <HandHeart class="w-4 h-4 text-fs-secondary-600" />
          <span>Abgabestelle / Soziale Einrichtung</span>
        </div>
        <a
          :href="directionsUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="text-xs font-semibold text-fs-primary-800 hover:text-fs-secondary-700 inline-flex items-center gap-1 transition-colors"
        >
          <Navigation class="w-3.5 h-3.5" />
          <span>Route planen</span>
        </a>
      </div>

      <div class="p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div class="space-y-1.5">
          <h1 class="font-headline text-2xl sm:text-[1.75rem] text-fs-primary-600 leading-tight">
            {{ store.name }}
          </h1>
          <p class="text-sm text-fs-muted flex items-center gap-1.5">
            <MapPin class="w-4 h-4 text-fs-secondary-600 shrink-0" />
            <span>{{ store.str }}, {{ store.plz }} {{ store.stadt }}</span>
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-2 shrink-0">
          <button
            v-if="permissions?.canManageStore"
            @click="isDirectEditOpen = true"
            type="button"
            class="fs-btn-primary"
          >
            <Pencil class="w-3.5 h-3.5" />
            <span>Direkt bearbeiten (AG-Modus)</span>
          </button>
          <button
            @click="isSuggestionOpen = true"
            type="button"
            class="fs-btn-secondary"
          >
            <MessageSquarePlus class="w-3.5 h-3.5" />
            <span>Änderung vorschlagen</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Navigation Tabs (Visible when Manager has internal permissions) -->
    <div
      v-if="permissions?.canViewContactLog"
      class="flex items-center gap-2 bg-fs-primary-200/60 border border-fs-primary-300 rounded-fs p-1 text-xs font-semibold w-fit"
    >
      <button
        type="button"
        @click="activeTab = 'details'"
        :class="[
          'px-3.5 py-1.5 rounded-fs inline-flex items-center gap-1.5 transition-colors cursor-pointer',
          activeTab === 'details'
            ? 'bg-[#64ae24] text-white shadow-sm'
            : 'text-fs-primary-800 hover:bg-fs-primary-200'
        ]"
      >
        <Info class="w-3.5 h-3.5" />
        <span>Öffentliche Details</span>
      </button>
      <button
        type="button"
        @click="activeTab = 'contacts'"
        :class="[
          'px-3.5 py-1.5 rounded-fs inline-flex items-center gap-1.5 transition-colors cursor-pointer',
          activeTab === 'contacts'
            ? 'bg-[#64ae24] text-white shadow-sm'
            : 'text-fs-primary-800 hover:bg-fs-primary-200'
        ]"
      >
        <Lock class="w-3.5 h-3.5" />
        <span>Internes Kontaktprotokoll</span>
        <span
          :class="[
            'text-[10px] font-bold px-1.5 py-0.2 rounded-full',
            activeTab === 'contacts'
              ? 'bg-white/25 text-white'
              : 'bg-fs-warning-200 text-fs-warning-900'
          ]"
        >
          {{ contactLogs.length }}
        </span>
      </button>
    </div>

    <!-- Tab 1: Giving Details Card -->
    <StoreGivingDetailsCard
      v-if="store && activeTab === 'details'"
      :store="store"
    />

    <!-- Tab 2: Internal Contact Log Tab (Gated to Managers) -->
    <StoreContactLogTab
      v-if="store && permissions?.canViewContactLog && activeTab === 'contacts'"
      :internal-store="store"
      :logs="contactLogs"
      @logAdded="reloadStore"
    />

    <!-- Suggestion Modal -->
    <SuggestionModal
      :is-open="isSuggestionOpen"
      :target-store="store"
      @close="isSuggestionOpen = false"
      @submitted="reloadStore"
    />

    <!-- Direct Edit Modal (AG Manager only) -->
    <DirectEditStoreModal
      v-if="store && permissions?.canManageStore"
      :is-open="isDirectEditOpen"
      :store="store"
      @close="isDirectEditOpen = false"
      @updated="reloadStore"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import {
  Map as MapIcon,
  HandHeart,
  Navigation,
  MapPin,
  Pencil,
  MessageSquarePlus,
  Info,
  Lock
} from 'lucide-vue-next';
import { StorePermissions } from '../../server/auth/permissions';
import { fetchApi } from '../state';
import StoreGivingDetailsCard from '../components/StoreGivingDetailsCard.vue';
import StoreContactLogTab from '../components/StoreContactLogTab.vue';
import SuggestionModal from '../components/SuggestionModal.vue';
import DirectEditStoreModal from '../components/DirectEditStoreModal.vue';

const route = useRoute();
const store = ref<any | null>(null);
const permissions = ref<StorePermissions | null>(null);
const contactLogs = ref<any[]>([]);
const activeTab = ref<'details' | 'contacts'>('details');
const isSuggestionOpen = ref(false);
const isDirectEditOpen = ref(false);

const directionsUrl = computed(() => {
  const s = store.value;
  if (!s) return '#';
  if (s.lat && s.lon) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${s.lat},${s.lon}`)}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${s.name} ${s.str} ${s.plz} ${s.stadt}`)}`;
});

async function reloadStore() {
  const storeId = route.params.storeId;
  try {
    const res = await fetchApi<{ store: any; permissions: StorePermissions }>(`/api/giving-stores/${storeId}`);
    store.value = res.store;
    permissions.value = res.permissions;
    contactLogs.value = res.store.contact_logs || [];
  } catch (err) {
    console.error('Failed to load store', err);
  }
}

onMounted(() => {
  reloadStore();
});
</script>
