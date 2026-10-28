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

        <!-- Manager Maintenance / Inbox (Only visible for logged-in coordinators / ORGA) -->
        <router-link 
          v-if="authState.user"
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

        <!-- Auth: Login button if logged out -->
        <button
          v-if="!authState.user"
          @click="isLoginModalOpen = true"
          type="button"
          class="text-xs font-semibold text-slate-700 hover:text-amber-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <span>🔐 Anmelden</span>
        </button>

        <!-- Auth: User Profile & Logout Dropdown if logged in -->
        <div v-else class="relative text-xs">
          <button 
            @click="toggleUserMenu" 
            type="button" 
            class="h-8 px-2.5 rounded-full bg-amber-50 border border-amber-200 text-amber-900 font-bold flex items-center gap-1.5 hover:bg-amber-100 transition-colors cursor-pointer"
            title="Benutzermenü öffnen"
          >
            <span class="w-5 h-5 rounded-full bg-amber-600 text-white flex items-center justify-center text-[10px] font-extrabold">
              {{ authState.user.email[0].toUpperCase() }}
            </span>
            <span class="hidden sm:inline font-medium text-slate-700">{{ authState.user.name || authState.user.email.split('@')[0] }}</span>
          </button>

          <div v-if="showUserMenu" class="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-slate-200 p-2 z-50 text-xs space-y-2 animate-in fade-in zoom-in-95 duration-100">
            <div class="px-2 py-1.5 border-b border-slate-100">
              <div class="font-bold text-slate-900 truncate">{{ authState.user.name || 'Koordinator:in' }}</div>
              <div class="text-[11px] text-slate-500 truncate">{{ authState.user.email }}</div>
              <span v-if="authState.user.isSuperAdmin" class="inline-block mt-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                ORGA / Admin
              </span>
            </div>

            <router-link 
              to="/maintenance" 
              @click="showUserMenu = false"
              class="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded text-slate-700 font-medium"
            >
              📥 Wartungs-Inbox
            </router-link>

            <button 
              @click="logout" 
              type="button"
              class="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-rose-50 text-rose-600 font-bold rounded cursor-pointer transition-colors"
            >
              🚪 Abmelden
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Login Modal -->
    <LoginModal 
      :is-open="isLoginModalOpen" 
      @close="isLoginModalOpen = false" 
      @loggedIn="isLoginModalOpen = false"
    />
  </header>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { appState, authState, setAuthUser } from '../state';
import LoginModal from './LoginModal.vue';

const router = useRouter();
defineEmits<{
  (e: 'openNewStoreModal'): void;
}>();

const showUserMenu = ref(false);
const isLoginModalOpen = ref(false);

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

function logout() {
  showUserMenu.value = false;
  setAuthUser(null, null);
  window.location.reload();
}
</script>
