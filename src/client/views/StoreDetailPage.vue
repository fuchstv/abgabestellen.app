<template>
  <div class="max-w-4xl mx-auto px-4 py-8 space-y-6 flex-1">
    <!-- Breadcrumbs -->
    <nav class="flex items-center gap-2 text-xs text-slate-500">
      <router-link to="/" class="hover:text-amber-600">Karte</router-link>
      <span>/</span>
      <router-link :to="'/regions/' + (store?.bezirk_id || 1)" class="hover:text-amber-600">
        {{ store?.region_name || 'Region' }}
      </router-link>
      <span>/</span>
      <span class="text-slate-800 font-medium truncate">{{ store?.name }}</span>
    </nav>

    <!-- Header block -->
    <div v-if="store" class="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-black text-slate-900 tracking-tight">
          {{ store.name }}
        </h1>
        <p class="text-sm text-slate-500 mt-1">
          📍 {{ store.str }}, {{ store.plz }} {{ store.stadt }}
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <button 
          v-if="permissions?.canManageStore"
          @click="isDirectEditOpen = true" 
          type="button" 
          class="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs px-3.5 py-2 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
        >
          <span>✏️ Direkt bearbeiten (AG-Modus)</span>
        </button>
        <button 
          @click="isSuggestionOpen = true" 
          type="button" 
          class="bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs px-3.5 py-2 rounded-lg transition-colors"
        >
          Änderung vorschlagen
        </button>
      </div>
    </div>

    <!-- Navigation Tabs (Only if Manager has internal permissions) -->
    <div v-if="permissions?.canViewContactLog" class="flex border-b border-slate-200 gap-4 text-sm font-semibold">
      <button 
        @click="activeTab = 'details'" 
        :class="['pb-2.5 px-1 border-b-2 transition-colors', activeTab === 'details' ? 'border-amber-600 text-amber-600' : 'border-transparent text-slate-500 hover:text-slate-700']"
      >
        Öffentliche Details
      </button>
      <button 
        @click="activeTab = 'contacts'" 
        :class="['pb-2.5 px-1 border-b-2 flex items-center gap-1.5 transition-colors', activeTab === 'contacts' ? 'border-amber-600 text-amber-600' : 'border-transparent text-slate-500 hover:text-slate-700']"
      >
        <span>🔒 Internes Kontaktprotokoll</span>
        <span class="text-[11px] px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800">
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
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
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
