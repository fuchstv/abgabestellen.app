<template>
  <header class="bg-white border-b border-slate-200 sticky top-0 z-40">
    <div class="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
      <!-- Brand & Regions -->
      <div class="flex items-center gap-4">
        <router-link to="/" class="flex items-center gap-2 font-bold text-slate-900 text-base tracking-tight">
          <span class="w-8 h-8 rounded-lg bg-amber-600 text-white flex items-center justify-center font-extrabold text-lg shadow-sm">
            A
          </span>
          <span>abgabestellen<span class="text-amber-600">.app</span></span>
        </router-link>

        <!-- Region Dropdown -->
        <div class="relative">
          <select 
            :value="appState.currentRegion?.id" 
            @change="onRegionChange"
            class="text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 border-none rounded-lg px-2.5 py-1.5 cursor-pointer outline-none"
          >
            <option v-for="r in appState.regions" :key="r.id" :value="r.id">
              {{ r.name }}
            </option>
          </select>
        </div>
      </div>

      <!-- Action items & Filters -->
      <div class="flex items-center gap-3">
        <!-- Quick toggle: Without registration only -->
        <label class="hidden sm:flex items-center gap-2 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg cursor-pointer transition-colors">
          <input 
            type="checkbox" 
            v-model="appState.filterWithoutRegistration" 
            class="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
          />
          <span>Ohne Voranmeldung</span>
        </label>

        <!-- New store suggestion -->
        <button 
          @click="$emit('openNewStoreModal')" 
          type="button" 
          class="text-xs font-medium bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-lg shadow-sm transition-colors"
        >
          + Vorschlag
        </button>

        <!-- Manager Maintenance / Inbox -->
        <router-link 
          to="/maintenance" 
          class="relative text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors"
        >
          <span>Inbox & Pflege</span>
          <span 
            v-if="appState.pendingSuggestionsCount > 0" 
            class="bg-amber-500 text-white font-bold text-[10px] px-1.5 py-0.2 rounded-full"
          >
            {{ appState.pendingSuggestionsCount }}
          </span>
        </router-link>

        <!-- Auth switcher (Simulation for test/dev) -->
        <div class="relative text-xs">
          <button 
            @click="toggleUserMenu" 
            type="button" 
            class="w-8 h-8 rounded-full bg-slate-200 text-slate-700 font-bold flex items-center justify-center hover:bg-slate-300"
            title="Benutzer wechseln"
          >
            {{ authState.user ? authState.user.email[0].toUpperCase() : '👤' }}
          </button>

          <div v-if="showUserMenu" class="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-slate-200 p-2 z-50 text-xs space-y-1">
            <div class="font-bold text-slate-700 px-2 py-1 border-b border-slate-100">
              Rolle wechseln (Test / Dev)
            </div>
            <button 
              @click="switchRole('public')" 
              class="w-full text-left px-2 py-1.5 hover:bg-slate-50 rounded"
            >
              Public Visitor (Nicht angemeldet)
            </button>
            <button 
              @click="switchRole('foodsaver')" 
              class="w-full text-left px-2 py-1.5 hover:bg-slate-50 rounded"
            >
              Foodsaver+ (standard)
            </button>
            <button 
              @click="switchRole('manager')" 
              class="w-full text-left px-2 py-1.5 hover:bg-slate-50 rounded text-amber-700 font-semibold"
            >
              AG Abgabestellen (Manager Berlin)
            </button>
          </div>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { appState, authState, setAuthUser } from '../state';

const router = useRouter();
defineEmits<{
  (e: 'openNewStoreModal'): void;
}>();

const showUserMenu = ref(false);

function toggleUserMenu() {
  showUserMenu.value = !showUserMenu.value;
}

function onRegionChange(e: Event) {
  const select = e.target as HTMLSelectElement;
  const id = Number(select.value);
  const region = appState.regions.find(r => r.id === id);
  if (region) {
    appState.currentRegion = region;
    router.push(`/regions/${region.id}`);
  }
}

function switchRole(role: 'public' | 'foodsaver' | 'manager') {
  showUserMenu.value = false;
  if (role === 'public') {
    setAuthUser(null, null);
  } else if (role === 'foodsaver') {
    setAuthUser(
      { uid: 'fs_user_1', email: 'foodsaver@example.org' },
      'test:fs_user_1:foodsaver@example.org:false'
    );
  } else if (role === 'manager') {
    setAuthUser(
      { uid: 'berlin_lead', email: 'lead@foodsharing.berlin' },
      'test:berlin_lead:lead@foodsharing.berlin:false'
    );
  }
  window.location.reload();
}
</script>
