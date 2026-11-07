<template>
  <div class="flex-1 flex flex-col md:flex-row h-full min-h-0 overflow-hidden relative">
    <!-- Mobile View Switcher (Full-height List vs Full-height Map on Phones) -->
    <div class="flex md:hidden bg-fs-primary-200/90 border-b border-fs-primary-300 px-3 py-1.5 gap-2 shrink-0 z-20">
      <button
        type="button"
        @click="mobileTab = 'list'"
        :class="[
          'flex-1 py-1.5 px-3 rounded-fs text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer',
          mobileTab === 'list'
            ? 'bg-[#64ae24] text-white shadow-sm'
            : 'bg-fs-surface text-fs-primary-800 border border-fs-primary-300'
        ]"
      >
        <List class="w-3.5 h-3.5" />
        <span>Liste ({{ filteredStores.length }})</span>
      </button>
      <button
        type="button"
        @click="switchToMobileMap"
        :class="[
          'flex-1 py-1.5 px-3 rounded-fs text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer',
          mobileTab === 'map'
            ? 'bg-[#64ae24] text-white shadow-sm'
            : 'bg-fs-surface text-fs-primary-800 border border-fs-primary-300'
        ]"
      >
        <MapIcon class="w-3.5 h-3.5" />
        <span>Karte</span>
      </button>
    </div>

    <!-- Left Sidebar: foodsharing Container-Styled Store Directory -->
    <aside
      :class="[
        'w-full md:w-[410px] bg-fs-surface border-r border-fs-primary-200 flex-col h-full min-h-0 z-10 shrink-0',
        mobileTab === 'list' ? 'flex' : 'hidden md:flex'
      ]"
    >
      <!-- Warm Introductory Container Header -->
      <div class="bg-fs-primary-200/85 border-b border-fs-primary-300 px-4 py-3 shrink-0">
        <div class="flex items-center justify-between gap-2">
          <h1 class="font-headline text-base text-fs-primary-600 leading-tight flex items-center gap-2">
            <HandHeart class="w-4 h-4 text-fs-secondary-600 shrink-0" />
            <span>{{ appState.currentRegion?.name || 'Abgabestellen' }}</span>
          </h1>
          <span class="fs-badge-green !text-[10px]">
            {{ filteredStores.length }} aktiv
          </span>
        </div>
        <p class="text-[11px] text-fs-primary-800/85 mt-1 leading-snug">
          Suppenküchen, Notübernachtungen & soziale Einrichtungen für gerettete Lebensmittel.
        </p>
      </div>

      <!-- Search & Filter Chips -->
      <div class="p-3.5 border-b border-fs-primary-200 bg-fs-elevated/60 space-y-2.5 shrink-0">
        <div class="relative">
          <Search class="w-3.5 h-3.5 text-fs-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Einrichtung, Straße, PLZ oder Zeiten suchen..."
            class="fs-input !pl-8 !pr-8"
          />
          <button
            v-if="searchQuery"
            type="button"
            @click="searchQuery = ''"
            class="absolute right-2.5 top-1/2 -translate-y-1/2 text-fs-muted hover:text-fs-text p-0.5 cursor-pointer"
            aria-label="Suche zurücksetzen"
          >
            <X class="w-3.5 h-3.5" />
          </button>
        </div>

        <!-- Filter Pills -->
        <div class="flex items-center justify-between gap-2 flex-wrap">
          <div class="flex items-center gap-1.5">
            <button
              type="button"
              @click="setRegistrationFilter('all')"
              :class="[
                'text-[11px] font-semibold px-2.5 py-1 rounded-fs border transition-colors cursor-pointer',
                !appState.filterWithoutRegistration && !onlyWithRegistration
                  ? 'bg-fs-primary-500 text-fs-primary-100 border-fs-primary-500'
                  : 'bg-fs-surface hover:bg-fs-primary-100 text-fs-primary-700 border-fs-primary-300'
              ]"
            >
              Alle ({{ searchMatchedStores.length }})
            </button>

            <button
              type="button"
              @click="setRegistrationFilter('without')"
              :class="[
                'text-[11px] font-semibold px-2.5 py-1 rounded-fs border inline-flex items-center gap-1.5 transition-colors cursor-pointer',
                appState.filterWithoutRegistration
                  ? 'bg-fs-secondary-200 text-fs-secondary-900 border-fs-secondary-500 shadow-sm'
                  : 'bg-fs-surface hover:bg-fs-secondary-100 text-fs-primary-700 border-fs-primary-300'
              ]"
            >
              <span class="w-2 h-2 rounded-full bg-[#64ae24] shrink-0"></span>
              <span>Ohne Voranmeldung</span>
            </button>

            <button
              type="button"
              @click="setRegistrationFilter('with')"
              :class="[
                'text-[11px] font-semibold px-2.5 py-1 rounded-fs border inline-flex items-center gap-1.5 transition-colors cursor-pointer',
                onlyWithRegistration
                  ? 'bg-fs-warning-200 text-fs-warning-900 border-fs-warning-500 shadow-sm'
                  : 'bg-fs-surface hover:bg-fs-warning-100 text-fs-primary-700 border-fs-primary-300'
              ]"
            >
              <span class="w-2 h-2 rounded-full bg-[#cc990e] shrink-0"></span>
              <span>Mit Voranm.</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Store List Items (foodsharing list-group feel) -->
      <div class="flex-1 min-h-0 overflow-y-auto p-2.5 space-y-2 bg-fs-bg/60">
        <!-- Loading State -->
        <div v-if="loading && stores.length === 0" class="p-8 text-center space-y-2 text-xs text-fs-muted">
          <div class="w-7 h-7 border-3 border-[#64ae24] border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p>Lade Abgabestellen...</p>
        </div>

        <!-- Empty State -->
        <div
          v-else-if="filteredStores.length === 0"
          class="bg-fs-surface border border-fs-primary-200 rounded-fs p-6 text-center space-y-3 my-4"
        >
          <div class="w-10 h-10 rounded-full bg-fs-primary-100 text-fs-primary-500 flex items-center justify-center mx-auto">
            <SearchX class="w-5 h-5" />
          </div>
          <div class="space-y-1">
            <h3 class="font-headline text-sm text-fs-primary-600">Keine passende Abgabestelle gefunden</h3>
            <p class="text-xs text-fs-muted leading-relaxed">
              Passe deine Suche oder Filter an – oder schlage eine Einrichtung vor, die hier noch fehlt.
            </p>
          </div>
          <div class="flex flex-wrap justify-center gap-2 pt-1">
            <button
              v-if="searchQuery || appState.filterWithoutRegistration || onlyWithRegistration"
              type="button"
              @click="resetFilters"
              class="fs-btn-secondary"
            >
              Filter zurücksetzen
            </button>
          </div>
        </div>

        <!-- Store Cards -->
        <div
          v-for="store in filteredStores"
          :key="store.id"
          @click="selectStore(store, true)"
          :class="[
            'group p-3 rounded-fs cursor-pointer transition-all border',
            selectedStore?.id === store.id
              ? 'bg-fs-secondary-200/80 border-fs-secondary-500 border-l-4 border-l-[#64ae24] shadow-fs-card'
              : 'bg-fs-surface hover:bg-fs-secondary-100/90 border-fs-primary-200 hover:border-fs-secondary-400 shadow-sm'
          ]"
        >
          <div class="flex items-start justify-between gap-2 mb-1">
            <h4 class="font-bold text-sm text-fs-primary-900 group-hover:text-fs-secondary-800 leading-snug transition-colors">
              {{ store.name }}
            </h4>

            <span
              v-if="isStorePaused(store)"
              class="fs-badge-gray !text-[10px] !px-1.5 !py-0.5 shrink-0"
            >
              Inaktiv / Pausiert
            </span>
            <span
              v-else-if="store.giving_details.registration_required === 0"
              class="fs-badge-green !text-[10px] !px-1.5 !py-0.5 shrink-0"
            >
              Ohne Voranmeldung
            </span>
            <span
              v-else
              class="fs-badge-ochre !text-[10px] !px-1.5 !py-0.5 shrink-0"
            >
              Mit Voranmeldung
            </span>
          </div>

          <p class="text-xs text-fs-muted mb-1.5 flex items-center gap-1">
            <MapPin class="w-3 h-3 text-fs-primary-500 shrink-0" />
            <span class="truncate">{{ store.str }}, {{ store.plz }} {{ store.stadt }}</span>
          </p>

          <p
            v-if="store.giving_details.dropoff_times"
            class="text-xs text-fs-text line-clamp-1 flex items-center gap-1.5 bg-fs-bg/80 border border-fs-primary-200/70 rounded px-2 py-1"
          >
            <Clock class="w-3 h-3 text-fs-secondary-600 shrink-0" />
            <span class="truncate">{{ store.giving_details.dropoff_times }}</span>
          </p>

          <div class="mt-2 pt-1.5 border-t border-fs-primary-200/60 flex items-center justify-between text-[11px]">
            <span class="text-fs-muted truncate max-w-[70%]">
              {{ store.giving_details.accepted_items || 'Details zur Warenannahme ansehen' }}
            </span>
            <router-link
              :to="'/stores/' + store.id"
              @click.stop
              class="text-fs-secondary-700 hover:text-fs-secondary-800 font-semibold inline-flex items-center gap-0.5 shrink-0 hover:underline"
            >
              <span>Details</span>
              <ChevronRight class="w-3 h-3" />
            </router-link>
          </div>
        </div>
      </div>
    </aside>

    <!-- Right: Interactive Map Container, MapControl Legend & StoreBubble -->
    <div
      :class="[
        'flex-1 relative bg-fs-bg h-full min-h-0 overflow-hidden',
        mobileTab === 'map' ? 'block' : 'hidden md:block'
      ]"
    >
      <div id="map" ref="mapContainer" class="w-full h-full"></div>

      <!-- Top-Left: Fit All Markers Button -->
      <button
        v-if="filteredStores.length > 0"
        @click="fitMapToMarkers"
        type="button"
        class="absolute top-3.5 left-3.5 z-10 bg-fs-surface hover:bg-fs-primary-100 text-fs-primary-800 text-xs font-semibold px-3 py-1.5 rounded-fs shadow-fs border border-fs-primary-300 flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
        title="Karte auf alle sichtbaren Abgabestellen zentrieren"
      >
        <LocateFixed class="w-3.5 h-3.5 text-fs-secondary-600" />
        <span>Alle zentrieren ({{ filteredStores.length }})</span>
      </button>

      <!-- Top-Right: foodsharing MapControl-Style Legend & Quick Filter -->
      <div class="absolute top-3.5 right-3.5 z-10 flex flex-col items-end gap-1.5 pointer-events-none">
        <button
          type="button"
          @click="legendCollapsed = !legendCollapsed"
          class="pointer-events-auto w-8 h-8 rounded-full bg-[#64ae24] hover:bg-[#508b1d] text-white shadow-fs flex items-center justify-center transition-colors cursor-pointer"
          :title="legendCollapsed ? 'Kartenlegende einblenden' : 'Kartenlegende ausblenden'"
          aria-label="Kartenlegende umschalten"
        >
          <Layers class="w-4 h-4" />
        </button>

        <div
          v-if="!legendCollapsed"
          class="pointer-events-auto bg-fs-surface/95 backdrop-blur-sm border border-fs-primary-300 rounded-fs shadow-fs p-2.5 w-60 text-xs space-y-1"
        >
          <div class="text-[10px] font-bold uppercase tracking-wider text-fs-muted px-1 pb-0.5">
            Kartenlegende
          </div>

          <button
            type="button"
            @click="setRegistrationFilter(appState.filterWithoutRegistration ? 'all' : 'without')"
            :class="[
              'w-full flex items-center gap-2.5 px-2 py-1.5 rounded-fs text-left font-semibold transition-colors cursor-pointer',
              appState.filterWithoutRegistration
                ? 'bg-[#64ae24] text-white'
                : 'hover:bg-fs-primary-100 text-fs-primary-800'
            ]"
          >
            <span
              :class="[
                'w-6 h-6 rounded-full flex items-center justify-center shrink-0',
                appState.filterWithoutRegistration ? 'bg-white text-[#64ae24]' : 'bg-[#64ae24] text-white'
              ]"
            >
              <HandHeart class="w-3.5 h-3.5" />
            </span>
            <span class="flex-1 truncate">Ohne Voranmeldung</span>
            <span class="text-[11px] opacity-85">{{ countWithoutReg }}</span>
          </button>

          <button
            type="button"
            @click="setRegistrationFilter(onlyWithRegistration ? 'all' : 'with')"
            :class="[
              'w-full flex items-center gap-2.5 px-2 py-1.5 rounded-fs text-left font-semibold transition-colors cursor-pointer',
              onlyWithRegistration
                ? 'bg-[#cc990e] text-white'
                : 'hover:bg-fs-primary-100 text-fs-primary-800'
            ]"
          >
            <span
              :class="[
                'w-6 h-6 rounded-full flex items-center justify-center shrink-0',
                onlyWithRegistration ? 'bg-white text-[#cc990e]' : 'bg-[#cc990e] text-white'
              ]"
            >
              <PhoneCall class="w-3.5 h-3.5" />
            </span>
            <span class="flex-1 truncate">Mit Voranmeldung</span>
            <span class="text-[11px] opacity-85">{{ countWithReg }}</span>
          </button>

          <div
            v-if="countPaused > 0"
            class="flex items-center gap-2.5 px-2 py-1 text-fs-muted font-medium"
          >
            <span class="w-6 h-6 rounded-full bg-[#5e636e] text-white flex items-center justify-center shrink-0">
              <PauseCircle class="w-3.5 h-3.5" />
            </span>
            <span class="flex-1 truncate">Vorübergehend pausiert</span>
            <span class="text-[11px]">{{ countPaused }}</span>
          </div>
        </div>
      </div>

      <!-- Selected Store Bubble Card -->
      <div
        v-if="selectedStore"
        class="absolute bottom-3 left-3 right-3 sm:right-auto sm:bottom-5 sm:left-5 z-20"
      >
        <StoreBubble
          :store="selectedStore"
          @suggestChange="openSuggestionModal"
          @close="selectedStore = null"
        />
      </div>

      <!-- Loading Pill -->
      <div
        v-if="loading"
        class="absolute bottom-4 right-4 z-20 bg-fs-surface/95 border border-fs-primary-300 px-3 py-1.5 rounded-fs shadow-fs text-xs font-semibold text-fs-primary-800 flex items-center gap-2"
      >
        <span class="w-3.5 h-3.5 border-2 border-[#64ae24] border-t-transparent rounded-full animate-spin"></span>
        <span>Aktualisiere Karte...</span>
      </div>
    </div>

    <!-- Suggestion Modal -->
    <SuggestionModal
      :is-open="isSuggestionOpen"
      :target-store="suggestStoreTarget"
      @close="isSuggestionOpen = false"
      @submitted="onSuggestionSubmitted"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { useRoute } from 'vue-router';
import {
  HandHeart,
  Search,
  SearchX,
  X,
  MapPin,
  Clock,
  ChevronRight,
  LocateFixed,
  Layers,
  PhoneCall,
  PauseCircle,
  List,
  Map as MapIcon
} from 'lucide-vue-next';
import { PublicStore } from '@shared/types';
import { appState, themeState, fetchApi } from '../state';
import StoreBubble from '../components/StoreBubble.vue';
import SuggestionModal from '../components/SuggestionModal.vue';

const route = useRoute();
const mapContainer = ref<HTMLDivElement | null>(null);
const stores = ref<PublicStore[]>([]);
const selectedStore = ref<PublicStore | null>(null);
const loading = ref(false);
const searchQuery = ref('');
const onlyWithRegistration = ref(false);
const legendCollapsed = ref(false);
const mobileTab = ref<'list' | 'map'>('map');

const isSuggestionOpen = ref(false);
const suggestStoreTarget = ref<PublicStore | null>(null);

let googleMap: any = null;
let markers: any[] = [];
let resizeObserver: ResizeObserver | null = null;

/* ==========================================================================
   Google Maps Custom Styles (Warm Light & Earthy Dark matching foodsharing)
   ========================================================================== */
const LIGHT_MAP_STYLES = [
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', stylers: [{ visibility: 'on' }] },
  { featureType: 'poi.park', elementType: 'geometry.fill', stylers: [{ color: '#dcecd0' }] },
  { featureType: 'landscape.natural', elementType: 'geometry.fill', stylers: [{ color: '#eef5e8' }] },
  { featureType: 'landscape.man_made', elementType: 'geometry.fill', stylers: [{ color: '#f5f3ef' }] },
  { featureType: 'water', elementType: 'geometry.fill', stylers: [{ color: '#c8e0ec' }] },
  { featureType: 'road.highway', elementType: 'geometry.fill', stylers: [{ color: '#f2dfb3' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#d7be8a' }] },
  { featureType: 'road.arterial', elementType: 'geometry.fill', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road.local', elementType: 'geometry.fill', stylers: [{ color: '#fcfbf9' }] },
  { featureType: 'administrative', elementType: 'labels.text.fill', stylers: [{ color: '#533a20' }] }
];

const DARK_MAP_STYLES = [
  { elementType: 'geometry', stylers: [{ color: '#1a2019' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#141913' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#b5ad9e' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', stylers: [{ visibility: 'on' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#1f2e1b' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#7aa65a' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#10212b' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#5b8296' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#293027' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#333b30' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#473e29' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#2c2618' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#222820' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#d1c0a8' }] }
];

function buildPinSvgDataUrl(fillHex: string, isSelected: boolean): string {
  const strokeHex = isSelected ? '#533a20' : '#ffffff';
  const strokeWidth = isSelected ? '2.6' : '2';
  const ring = isSelected
    ? `<circle cx="18" cy="15" r="14.5" fill="none" stroke="#ffffff" stroke-width="2" opacity="0.9"/>`
    : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="46" viewBox="0 0 36 46">
    <ellipse cx="18" cy="43" rx="6" ry="2.2" fill="rgba(0,0,0,0.24)"/>
    <path d="M18 2C9.7 2 3 8.7 3 17c0 10.6 13.1 24.4 14.1 25.4a1.3 1.3 0 0 0 1.8 0C19.9 41.4 33 27.6 33 17 33 8.7 26.3 2 18 2z" fill="${fillHex}" stroke="${strokeHex}" stroke-width="${strokeWidth}"/>
    ${ring}
    <path d="M18 11.8c-1.4-1.6-3.9-1.6-5.3 0-1.4 1.5-1.4 4 0 5.6L18 22.8l5.3-5.4c1.4-1.6 1.4-4.1 0-5.6-1.4-1.6-3.9-1.6-5.3 0z" fill="#ffffff"/>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function isStorePaused(store: PublicStore): boolean {
  return store.giving_details.giving_status === 3 || /\binaktiv\b/i.test(store.name);
}

const searchMatchedStores = computed(() => {
  if (!searchQuery.value.trim()) return stores.value;
  const q = searchQuery.value.toLowerCase();
  return stores.value.filter(s => {
    const matchName = s.name.toLowerCase().includes(q);
    const matchAddress = `${s.str} ${s.plz} ${s.stadt}`.toLowerCase().includes(q);
    const matchTimes = (s.giving_details.dropoff_times || '').toLowerCase().includes(q);
    const matchItems = (s.giving_details.accepted_items || '').toLowerCase().includes(q);
    return matchName || matchAddress || matchTimes || matchItems;
  });
});

const countWithoutReg = computed(
  () => searchMatchedStores.value.filter(s => !isStorePaused(s) && s.giving_details.registration_required === 0).length
);
const countWithReg = computed(
  () => searchMatchedStores.value.filter(s => !isStorePaused(s) && s.giving_details.registration_required === 1).length
);
const countPaused = computed(
  () => searchMatchedStores.value.filter(s => isStorePaused(s)).length
);

const filteredStores = computed(() => {
  const list = searchMatchedStores.value.filter(s => {
    if (appState.filterWithoutRegistration && (isStorePaused(s) || s.giving_details.registration_required === 1)) {
      return false;
    }
    if (onlyWithRegistration.value && (isStorePaused(s) || s.giving_details.registration_required === 0)) {
      return false;
    }
    return true;
  });

  // Sort active drop-off points first, paused/inactive at the bottom
  return [...list].sort((a, b) => {
    const pausedDiff = Number(isStorePaused(a)) - Number(isStorePaused(b));
    if (pausedDiff !== 0) return pausedDiff;
    return a.name.replace(/^["'(\s]+/, '').localeCompare(b.name.replace(/^["'(\s]+/, ''), 'de');
  });
});

function setRegistrationFilter(mode: 'all' | 'without' | 'with') {
  if (mode === 'all') {
    appState.filterWithoutRegistration = false;
    onlyWithRegistration.value = false;
  } else if (mode === 'without') {
    onlyWithRegistration.value = false;
    appState.filterWithoutRegistration = true;
  } else {
    appState.filterWithoutRegistration = false;
    onlyWithRegistration.value = true;
  }
}

function resetFilters() {
  searchQuery.value = '';
  setRegistrationFilter('all');
}

function switchToMobileMap() {
  mobileTab.value = 'map';
  setTimeout(() => {
    const g = (window as any).google;
    if (googleMap && g?.maps) {
      g.maps.event.trigger(googleMap, 'resize');
      if (!selectedStore.value) {
        fitMapToMarkers();
      }
    }
  }, 80);
}

watch(() => appState.filterWithoutRegistration, (val) => {
  if (val) {
    onlyWithRegistration.value = false;
  }
});

async function loadStores() {
  const regionId = route.params.regionId || appState.currentRegion?.id || 1;
  loading.value = true;
  try {
    const data = await fetchApi<PublicStore[]>(`/api/regions/${regionId}/giving-stores`);
    stores.value = data;
    if (selectedStore.value) {
      selectedStore.value = data.find(s => s.id === selectedStore.value!.id) || null;
    }
    renderMarkers();
    setTimeout(() => {
      fitMapToMarkers();
    }, 100);
  } catch (err) {
    console.error('Failed to load stores', err);
  } finally {
    loading.value = false;
  }
}

function fitMapToMarkers() {
  const g = (window as any).google;
  if (!g?.maps || !googleMap) return;

  if (filteredStores.value.length === 0) {
    const defaultLat = appState.currentRegion?.lat ? Number(appState.currentRegion.lat) : 52.52;
    const defaultLng = appState.currentRegion?.lon ? Number(appState.currentRegion.lon) : 13.405;
    googleMap.setCenter({ lat: defaultLat, lng: defaultLng });
    googleMap.setZoom(11);
    return;
  }

  const bounds = new g.maps.LatLngBounds();
  let count = 0;

  filteredStores.value.forEach(store => {
    const lat = Number(store.lat);
    const lng = Number(store.lon);
    if (Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0) {
      bounds.extend({ lat, lng });
      count++;
    }
  });

  if (count > 0) {
    googleMap.fitBounds(bounds, 48);
    const listener = g.maps.event.addListener(googleMap, 'idle', () => {
      if (googleMap.getZoom() > 16) {
        googleMap.setZoom(15);
      }
      g.maps.event.removeListener(listener);
    });
  } else {
    googleMap.setCenter({ lat: 52.52, lng: 13.405 });
    googleMap.setZoom(11);
  }
}

function selectStore(store: PublicStore, fromList = false) {
  selectedStore.value = store;
  if (fromList && window.innerWidth < 768) {
    mobileTab.value = 'map';
  }
  renderMarkers();
  setTimeout(() => {
    const g = (window as any).google;
    if (googleMap && g?.maps) {
      g.maps.event.trigger(googleMap, 'resize');
      if (store.lat && store.lon) {
        googleMap.panTo({ lat: Number(store.lat), lng: Number(store.lon) });
        if (googleMap.getZoom() < 14) {
          googleMap.setZoom(15);
        }
      }
    }
  }, 50);
}

function openSuggestionModal(store: PublicStore) {
  suggestStoreTarget.value = store;
  isSuggestionOpen.value = true;
}

function onSuggestionSubmitted() {
  loadStores();
}

async function initMap() {
  const centerLat = appState.currentRegion?.lat ? Number(appState.currentRegion.lat) : 52.52;
  const centerLon = appState.currentRegion?.lon ? Number(appState.currentRegion.lon) : 13.405;

  let apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
  if (!apiKey) {
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        const config = await res.json();
        apiKey = config.googleMapsApiKey || '';
      }
    } catch (e) {
      console.warn('Could not load Google Maps API key from /api/config', e);
    }
  }

  if (!(window as any).google?.maps) {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => setupGoogleMapInstance(centerLat, centerLon);
    document.head.appendChild(script);
  } else {
    setupGoogleMapInstance(centerLat, centerLon);
  }
}

function setupGoogleMapInstance(lat: number, lng: number) {
  if (!mapContainer.value) return;
  const g = (window as any).google;
  if (!g?.maps) return;

  googleMap = new g.maps.Map(mapContainer.value, {
    center: { lat: lat || 52.52, lng: lng || 13.405 },
    zoom: 11,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
    styles: themeState.mode === 'dark' ? DARK_MAP_STYLES : LIGHT_MAP_STYLES
  });

  renderMarkers();

  if (window.ResizeObserver && mapContainer.value) {
    if (resizeObserver) resizeObserver.disconnect();
    resizeObserver = new ResizeObserver(() => {
      if (googleMap && g.maps) {
        g.maps.event.trigger(googleMap, 'resize');
      }
    });
    resizeObserver.observe(mapContainer.value);
  }

  setTimeout(() => {
    g.maps.event.trigger(googleMap, 'resize');
    fitMapToMarkers();
  }, 150);
}

function getStorePinColor(store: PublicStore): string {
  if (isStorePaused(store)) return '#5e636e';
  return store.giving_details.registration_required === 0 ? '#64ae24' : '#cc990e';
}

function renderMarkers() {
  const g = (window as any).google;
  if (!g?.maps || !googleMap) return;

  markers.forEach(m => m.setMap(null));
  markers = [];

  filteredStores.value.forEach(store => {
    if (!store.lat || !store.lon) return;
    const isSelected = selectedStore.value?.id === store.id;
    const paused = isStorePaused(store);
    const pinColor = getStorePinColor(store);
    const width = isSelected ? 36 : 26;
    const height = isSelected ? 46 : 34;

    const marker = new g.maps.Marker({
      position: { lat: Number(store.lat), lng: Number(store.lon) },
      map: googleMap,
      title: store.name,
      zIndex: isSelected ? 999 : paused ? 2 : 10,
      icon: {
        url: buildPinSvgDataUrl(pinColor, isSelected),
        scaledSize: new g.maps.Size(width, height),
        anchor: new g.maps.Point(width / 2, height - 2)
      }
    });

    marker.addListener('click', () => {
      selectStore(store, false);
    });

    markers.push(marker);
  });
}

function handleExternalRefresh() {
  loadStores();
}

watch(() => themeState.mode, (mode) => {
  if (googleMap) {
    googleMap.setOptions({
      styles: mode === 'dark' ? DARK_MAP_STYLES : LIGHT_MAP_STYLES
    });
  }
});

watch(() => route.params.regionId, (newId) => {
  if (newId && appState.regions.length > 0) {
    const match = appState.regions.find(r => r.id === Number(newId));
    if (match) appState.currentRegion = match;
  }
  loadStores();
});

watch(filteredStores, () => {
  renderMarkers();
  fitMapToMarkers();
});

onMounted(() => {
  if (window.innerWidth < 1024) {
    legendCollapsed.value = true;
  }
  window.addEventListener('abgabestellen:refresh', handleExternalRefresh);
  initMap();
  loadStores();
});

onBeforeUnmount(() => {
  window.removeEventListener('abgabestellen:refresh', handleExternalRefresh);
  if (resizeObserver) resizeObserver.disconnect();
});
</script>
