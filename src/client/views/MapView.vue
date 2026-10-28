<template>
  <div class="flex-1 flex flex-col md:flex-row h-[calc(100vh-3.5rem)] overflow-hidden">
    <!-- Left Sidebar: Stores List -->
    <div class="w-full md:w-96 bg-white border-r border-slate-200 flex flex-col h-full z-10">
      <!-- Search & quick filter -->
      <div class="p-4 border-b border-slate-200 space-y-2">
        <input 
          v-model="searchQuery" 
          type="text" 
          placeholder="Abgabestellen durchsuchen..." 
          class="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-slate-50 focus:bg-white"
        />

        <div class="flex items-center justify-between text-xs text-slate-500 pt-1">
          <span>{{ filteredStores.length }} Abgabestellen gefunden</span>
          <label class="flex items-center gap-1.5 cursor-pointer">
            <input 
              type="checkbox" 
              v-model="appState.filterWithoutRegistration" 
              class="rounded border-slate-300 text-amber-600 text-xs"
            />
            <span class="text-[11px] font-medium text-slate-700">Nur ohne Voranmeldung</span>
          </label>
        </div>
      </div>

      <!-- Store items list -->
      <div class="flex-1 overflow-y-auto divide-y divide-slate-100 p-2 space-y-1">
        <div 
          v-for="store in filteredStores" 
          :key="store.id"
          @click="selectStore(store)"
          :class="[
            'p-3 rounded-lg cursor-pointer transition-all border',
            selectedStore?.id === store.id 
              ? 'bg-amber-50/70 border-amber-300 shadow-sm' 
              : 'hover:bg-slate-50 border-transparent'
          ]"
        >
          <div class="flex items-start justify-between gap-2 mb-1">
            <h4 class="font-bold text-sm text-slate-900 leading-snug">
              {{ store.name }}
            </h4>
            <span 
              v-if="store.giving_details.registration_required === 0" 
              class="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-teal-100 text-teal-800 shrink-0"
            >
              Ohne Voranmeldung
            </span>
            <span 
              v-else 
              class="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 shrink-0"
            >
              Voranmeldung
            </span>
          </div>

          <p class="text-xs text-slate-500 mb-1">
            {{ store.str }}, {{ store.plz }} {{ store.stadt }}
          </p>

          <p v-if="store.giving_details.dropoff_times" class="text-xs text-slate-700 line-clamp-1">
            🕒 {{ store.giving_details.dropoff_times }}
          </p>
        </div>
      </div>
    </div>

    <!-- Right: Map Container & Active Bubble Overlay -->
    <div class="flex-1 relative bg-slate-100 h-full">
      <div id="map" ref="mapContainer" class="w-full h-full"></div>

      <!-- Bubble overlay when store selected -->
      <div 
        v-if="selectedStore" 
        class="absolute bottom-6 left-6 z-20 max-w-sm"
      >
        <StoreBubble 
          :store="selectedStore" 
          @suggestChange="openSuggestionModal"
        />
      </div>

      <!-- Loading indicator -->
      <div v-if="loading" class="absolute top-4 right-4 z-20 bg-white/90 backdrop-blur px-3 py-1.5 rounded-lg shadow text-xs font-medium text-slate-700">
        Lade Abgabestellen...
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
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { PublicStore } from '@shared/types';
import { appState, fetchApi } from '../state';
import StoreBubble from '../components/StoreBubble.vue';
import SuggestionModal from '../components/SuggestionModal.vue';

const route = useRoute();
const mapContainer = ref<HTMLDivElement | null>(null);
const stores = ref<PublicStore[]>([]);
const selectedStore = ref<PublicStore | null>(null);
const loading = ref(false);
const searchQuery = ref('');

const isSuggestionOpen = ref(false);
const suggestStoreTarget = ref<PublicStore | null>(null);

let googleMap: any = null;
let markers: any[] = [];

const filteredStores = computed(() => {
  return stores.value.filter(s => {
    if (appState.filterWithoutRegistration && s.giving_details.registration_required === 1) {
      return false;
    }
    if (searchQuery.value.trim()) {
      const q = searchQuery.value.toLowerCase();
      const matchName = s.name.toLowerCase().includes(q);
      const matchAddress = (s.str + ' ' + s.stadt).toLowerCase().includes(q);
      const matchTimes = (s.giving_details.dropoff_times || '').toLowerCase().includes(q);
      return matchName || matchAddress || matchTimes;
    }
    return true;
  });
});

async function loadStores() {
  const regionId = route.params.regionId || appState.currentRegion?.id || 1;
  loading.value = true;
  try {
    const data = await fetchApi<PublicStore[]>(`/api/regions/${regionId}/giving-stores`);
    stores.value = data;
    renderMarkers();
  } catch (err) {
    console.error('Failed to load stores', err);
  } finally {
    loading.value = false;
  }
}

function selectStore(store: PublicStore) {
  selectedStore.value = store;
  if (googleMap && store.lat && store.lon) {
    googleMap.panTo({ lat: store.lat, lng: store.lon });
    googleMap.setZoom(15);
  }
}

function openSuggestionModal(store: PublicStore) {
  suggestStoreTarget.value = store;
  isSuggestionOpen.value = true;
}

function onSuggestionSubmitted() {
  loadStores();
}

async function initMap() {
  const centerLat = appState.currentRegion?.lat || 52.52;
  const centerLon = appState.currentRegion?.lon || 13.405;

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

  // Load Google Maps SDK dynamically if not present
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
    center: { lat, lng },
    zoom: 12,
    mapTypeControl: false,
    streetViewControl: false,
    styles: [
      { featureType: 'poi', stylers: [{ visibility: 'off' }] },
      { featureType: 'poi.park', stylers: [{ visibility: 'on' }] }
    ]
  });

  renderMarkers();
}

function renderMarkers() {
  const g = (window as any).google;
  if (!g?.maps || !googleMap) return;

  // Clear existing
  markers.forEach(m => m.setMap(null));
  markers = [];

  filteredStores.value.forEach(store => {
    if (!store.lat || !store.lon) return;

    const marker = new g.maps.Marker({
      position: { lat: store.lat, lng: store.lon },
      map: googleMap,
      title: store.name,
      icon: {
        path: g.maps.SymbolPath.CIRCLE,
        scale: 9,
        fillColor: store.giving_details.registration_required === 0 ? '#0d9488' : '#0284c7',
        fillOpacity: 0.9,
        strokeWeight: 2,
        strokeColor: '#ffffff'
      }
    });

    marker.addListener('click', () => {
      selectStore(store);
    });

    markers.push(marker);
  });
}

watch(() => route.params.regionId, () => {
  loadStores();
});

watch(filteredStores, () => {
  renderMarkers();
});

onMounted(() => {
  initMap();
  loadStores();
});
</script>
