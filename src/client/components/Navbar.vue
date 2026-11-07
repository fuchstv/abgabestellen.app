<template>
  <header class="bg-fs-elevated border-b border-fs-primary-200 shadow-fs sticky top-0 z-40 shrink-0">
    <div class="max-w-[1440px] mx-auto px-3 sm:px-5 h-14 flex items-center justify-between gap-2 sm:gap-4">
      <!-- Left: Brand Wordmark & Region Switcher -->
      <div class="flex items-center gap-2.5 sm:gap-4 min-w-0">
        <router-link
          to="/"
          class="group flex items-center gap-2 shrink-0 py-1 px-1.5 -ml-1.5 rounded-fs hover:bg-fs-primary-200/70 transition-colors"
          aria-label="abgabestellen.app Startseite"
        >
          <!-- Round Leaf-Green Signet -->
          <span
            class="w-8 h-8 rounded-full bg-[#64ae24] border-2 border-fs-primary-500/25 text-white flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform shrink-0"
          >
            <HandHeart class="w-4 h-4 stroke-[2.2]" />
          </span>

          <!-- Two-Tone Alfa Slab One Wordmark -->
          <span class="font-headline text-base sm:text-lg leading-none tracking-normal flex items-baseline">
            <span class="hidden min-[400px]:inline text-fs-primary-500 group-hover:text-fs-primary-700 transition-colors">abgabe</span>
            <span class="hidden min-[400px]:inline text-fs-secondary-500 group-hover:text-fs-secondary-600 transition-colors relative">
              stellen
              <span
                class="opacity-0 group-hover:opacity-100 transition-opacity text-[#cf3a00] text-[10px] -top-1.5 -right-2.5 absolute font-sans"
                aria-hidden="true"
              >♥</span>
            </span>
            <span class="inline min-[400px]:hidden text-fs-primary-500">a<span class="text-fs-secondary-500">s</span></span>
            <span
              class="ml-1 font-sans text-[10px] font-bold px-1.5 py-0.5 rounded bg-fs-primary-200 text-fs-primary-800 tracking-tight"
            >
              .app
            </span>
          </span>
        </router-link>

        <!-- Region Dropdown -->
        <div class="relative flex items-center min-w-0">
          <MapPin class="w-3.5 h-3.5 text-fs-secondary-600 absolute left-2.5 pointer-events-none" />
          <select
            :value="appState.currentRegion?.id"
            @change="onRegionChange"
            aria-label="Region auswählen"
            class="text-xs font-semibold bg-fs-surface hover:bg-fs-primary-100 text-fs-primary-800 border border-fs-primary-300 rounded-fs pl-7 pr-6 py-1.5 cursor-pointer outline-none focus:border-fs-secondary-500 focus:ring-2 focus:ring-fs-secondary-500/25 transition-colors max-w-[140px] sm:max-w-[210px] truncate appearance-none"
          >
            <option v-for="r in appState.regions" :key="r.id" :value="r.id">
              {{ r.name }}
            </option>
          </select>
          <ChevronDown class="w-3.5 h-3.5 text-fs-primary-500 absolute right-2 pointer-events-none" />
        </div>
      </div>

      <!-- Right: Filter, Actions, Theme Switcher & Auth -->
      <div class="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        <!-- Quick Filter Pill: Without registration -->
        <button
          type="button"
          @click="appState.filterWithoutRegistration = !appState.filterWithoutRegistration"
          :class="[
            'hidden lg:inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-fs border transition-colors cursor-pointer',
            appState.filterWithoutRegistration
              ? 'bg-fs-secondary-200 border-fs-secondary-500 text-fs-secondary-900 shadow-sm'
              : 'bg-fs-surface hover:bg-fs-primary-100 border-fs-primary-300 text-fs-primary-700'
          ]"
          title="Nur Abgabestellen ohne telefonische Voranmeldung anzeigen"
        >
          <CheckCircle2
            :class="[
              'w-3.5 h-3.5 transition-colors',
              appState.filterWithoutRegistration ? 'text-fs-secondary-600' : 'text-fs-muted'
            ]"
          />
          <span>Ohne Voranmeldung</span>
        </button>

        <!-- Primary CTA: Suggest Store -->
        <button
          @click="$emit('openNewStoreModal')"
          type="button"
          class="fs-btn-primary !py-1.5 !px-2.5 sm:!px-3"
          title="Neue Abgabestelle vorschlagen"
        >
          <PlusCircle class="w-3.5 h-3.5 shrink-0" />
          <span class="hidden sm:inline">Vorschlag</span>
        </button>

        <!-- Manager Maintenance / Inbox -->
        <router-link
          v-if="authState.user"
          to="/maintenance"
          class="relative text-xs font-semibold text-fs-primary-800 hover:text-fs-primary-900 bg-fs-primary-200/80 hover:bg-fs-primary-300/80 border border-fs-primary-300 px-2.5 sm:px-3 py-1.5 rounded-fs flex items-center gap-1.5 transition-colors"
          title="Pflege-Dashboard & Inbox öffnen"
        >
          <Inbox class="w-3.5 h-3.5 text-fs-primary-600 shrink-0" />
          <span class="hidden md:inline">Inbox & Pflege</span>
          <span
            v-if="appState.pendingSuggestionsCount > 0"
            class="bg-[#cf3a00] text-white font-bold text-[10px] leading-none px-1.5 py-0.5 rounded-full"
          >
            {{ appState.pendingSuggestionsCount }}
          </span>
        </router-link>

        <!-- Theme Switcher (Light / Dark like foodsharing) -->
        <button
          type="button"
          @click="toggleTheme"
          class="w-8 h-8 rounded-fs bg-fs-surface hover:bg-fs-primary-200 border border-fs-primary-300 text-fs-primary-700 flex items-center justify-center transition-colors cursor-pointer"
          :title="themeState.mode === 'dark' ? 'Zum hellen Design wechseln' : 'Zum dunklen Design wechseln'"
          :aria-label="themeState.mode === 'dark' ? 'Zum hellen Design wechseln' : 'Zum dunklen Design wechseln'"
        >
          <Sun v-if="themeState.mode === 'dark'" class="w-4 h-4 text-fs-warning-500" />
          <Moon v-else class="w-4 h-4 text-fs-primary-600" />
        </button>

        <!-- Auth: Login button if logged out -->
        <button
          v-if="!authState.user"
          @click="isLoginModalOpen = true"
          type="button"
          class="fs-btn-secondary !py-1.5 !px-2.5 sm:!px-3"
        >
          <LogIn class="w-3.5 h-3.5 text-fs-primary-600 shrink-0" />
          <span class="hidden sm:inline">Anmelden</span>
        </button>

        <!-- Auth: User Profile & Logout Dropdown if logged in -->
        <div v-else ref="userMenuRef" class="relative text-xs">
          <button
            @click="toggleUserMenu"
            type="button"
            class="h-8 pl-1.5 pr-2.5 rounded-full bg-fs-secondary-200 border border-fs-secondary-400 text-fs-secondary-900 font-semibold flex items-center gap-1.5 hover:bg-fs-secondary-300 transition-colors cursor-pointer"
            title="Benutzermenü öffnen"
          >
            <span class="w-5 h-5 rounded-full bg-[#64ae24] text-white flex items-center justify-center text-[10px] font-bold">
              {{ authState.user.email[0].toUpperCase() }}
            </span>
            <span class="hidden sm:inline max-w-[110px] truncate">
              {{ authState.user.name || authState.user.email.split('@')[0] }}
            </span>
            <ChevronDown class="w-3 h-3 opacity-75" />
          </button>

          <div
            v-if="showUserMenu"
            class="absolute right-0 mt-2 w-64 bg-fs-surface rounded-fs shadow-fs border border-fs-primary-300 overflow-hidden z-50 text-xs"
          >
            <div class="px-3.5 py-2.5 bg-fs-primary-200/75 border-b border-fs-primary-300">
              <div class="font-bold text-fs-primary-900 truncate">
                {{ authState.user.name || 'Koordinator:in' }}
              </div>
              <div class="text-[11px] text-fs-muted truncate">{{ authState.user.email }}</div>
              <span
                v-if="authState.user.isSuperAdmin"
                class="mt-1.5 fs-badge-ochre"
              >
                <ShieldCheck class="w-3 h-3" />
                ORGA / Admin
              </span>
            </div>

            <div class="p-1.5 space-y-1">
              <router-link
                to="/maintenance"
                @click="showUserMenu = false"
                class="w-full flex items-center gap-2 px-2.5 py-2 hover:bg-fs-secondary-200 hover:text-fs-secondary-900 rounded-fs text-fs-text font-medium transition-colors"
              >
                <Inbox class="w-3.5 h-3.5 text-fs-secondary-600" />
                <span>Pflege-Dashboard & Ampel</span>
              </router-link>

              <router-link
                v-if="authState.canManageTeam || authState.user.isSuperAdmin"
                to="/maintenance?tab=team"
                @click="showUserMenu = false"
                class="w-full flex items-center gap-2 px-2.5 py-2 hover:bg-fs-secondary-200 hover:text-fs-secondary-900 rounded-fs text-fs-text font-medium transition-colors"
              >
                <Users class="w-3.5 h-3.5 text-fs-primary-600" />
                <span>Mitbearbeiter & Zugänge</span>
              </router-link>

              <button
                @click="logout"
                type="button"
                class="w-full flex items-center gap-2 px-2.5 py-2 hover:bg-fs-danger-200 text-fs-danger-600 hover:text-fs-danger-900 font-semibold rounded-fs cursor-pointer transition-colors"
              >
                <LogOut class="w-3.5 h-3.5" />
                <span>Abmelden</span>
              </button>
            </div>
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
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import {
  HandHeart,
  MapPin,
  ChevronDown,
  CheckCircle2,
  PlusCircle,
  Inbox,
  Sun,
  Moon,
  LogIn,
  ShieldCheck,
  Users,
  LogOut
} from 'lucide-vue-next';
import { appState, authState, setAuthUser, themeState, toggleTheme } from '../state';
import LoginModal from './LoginModal.vue';

const router = useRouter();
defineEmits<{
  (e: 'openNewStoreModal'): void;
}>();

const showUserMenu = ref(false);
const isLoginModalOpen = ref(false);
const userMenuRef = ref<HTMLElement | null>(null);

function toggleUserMenu() {
  showUserMenu.value = !showUserMenu.value;
}

function handleOutsideClick(e: MouseEvent) {
  if (showUserMenu.value && userMenuRef.value && !userMenuRef.value.contains(e.target as Node)) {
    showUserMenu.value = false;
  }
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

onMounted(() => {
  document.addEventListener('click', handleOutsideClick);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', handleOutsideClick);
});
</script>
