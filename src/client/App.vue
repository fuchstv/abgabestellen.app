<template>
  <div class="min-h-screen flex flex-col bg-slate-50">
    <Navbar @openNewStoreModal="isNewStoreModalOpen = true" />
    <main class="flex-1 flex flex-col">
      <router-view />
    </main>
    <LegalFooter />

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
import { ref, onMounted } from 'vue';
import { appState, fetchApi } from './state';
import { Region } from '@shared/types';
import Navbar from './components/Navbar.vue';
import LegalFooter from './components/LegalFooter.vue';
import SuggestionModal from './components/SuggestionModal.vue';

const isNewStoreModalOpen = ref(false);

async function initRegions() {
  try {
    const regions = await fetchApi<Region[]>('/api/regions');
    appState.regions = regions;
    if (regions.length > 0 && !appState.currentRegion) {
      appState.currentRegion = regions[0];
    }
  } catch (err) {
    console.error('Failed to load regions', err);
  }
}

function onStoreSuggested() {
  // Can trigger refresh if on map
}

onMounted(() => {
  initRegions();
});
</script>
