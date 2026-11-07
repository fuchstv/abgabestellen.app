<template>
  <div class="h-full flex flex-col bg-fs-bg text-fs-text overflow-hidden">
    <Navbar @openNewStoreModal="isNewStoreModalOpen = true" />

    <main class="flex-1 min-h-0 flex flex-col overflow-y-auto relative">
      <router-view />
      <LegalFooter v-if="!isMapView" :compact="false" />
    </main>

    <LegalFooter v-if="isMapView" :compact="true" />

    <!-- Global Toast Notifications -->
    <ToastContainer />

    <!-- Global New Store Proposal Modal -->
    <SuggestionModal
      :is-open="isNewStoreModalOpen"
      :is-new-store="true"
      :region-id="appState.currentRegion?.id || 1"
      :region-name="appState.currentRegion?.name || 'Berlin'"
      @close="isNewStoreModalOpen = false"
      @submitted="onStoreSuggested"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { appState, authState, fetchApi, refreshAuthProfile } from './state';
import { Region } from '@shared/types';
import Navbar from './components/Navbar.vue';
import LegalFooter from './components/LegalFooter.vue';
import SuggestionModal from './components/SuggestionModal.vue';
import ToastContainer from './components/ToastContainer.vue';

const route = useRoute();
const isMapView = computed(() => {
  return route.path === '/' || route.path.startsWith('/regions/');
});

const isNewStoreModalOpen = ref(false);

async function initRegions() {
  try {
    const regions = await fetchApi<Region[]>('/api/regions');
    appState.regions = regions;
    if (regions.length > 0 && !appState.currentRegion) {
      appState.currentRegion = regions[0];
    }
    if (authState.token) {
      await refreshAuthProfile();
    }
    if (authState.user && appState.currentRegion) {
      fetchApi<any[]>(`/api/maintenance/suggestions?status=pending&region_id=${appState.currentRegion.id}&auto_scope=1`)
        .then(s => {
          appState.pendingSuggestionsCount = s.length;
        })
        .catch(() => {});
    }
  } catch (err) {
    console.error('Failed to load regions', err);
  }
}

function onStoreSuggested() {
  window.dispatchEvent(new CustomEvent('abgabestellen:refresh'));
}

onMounted(() => {
  initRegions();
});
</script>
