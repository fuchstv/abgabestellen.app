<template>
  <div class="max-w-md mx-auto px-4 py-12 flex-1 w-full">
    <!-- State: Loading -->
    <div v-if="loading" class="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center space-y-4">
      <div class="w-10 h-10 border-4 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
      <p class="text-xs text-slate-500 font-medium">Lade Einladungsdetails...</p>
    </div>

    <!-- State: Success Completed -->
    <div v-else-if="redeemSuccess" class="bg-white rounded-xl shadow-sm border border-emerald-200 p-8 text-center space-y-5">
      <div class="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center text-2xl mx-auto font-bold shadow-inner">
        ✓
      </div>
      <div>
        <h2 class="text-xl font-black text-slate-900 tracking-tight">
          Herzlich willkommen im Team!
        </h2>
        <p class="text-xs text-slate-600 mt-2 leading-relaxed">
          Deine Einladung wurde erfolgreich eingelöst. Du hast nun vollen Zugriff auf die Pflege-Inbox und die regionalen Abgabestellen für
          <strong class="text-slate-900">{{ inviteDetails?.region_name || 'deine Region' }}</strong>.
        </p>
      </div>

      <div class="pt-2 flex flex-col gap-2">
        <router-link 
          to="/maintenance" 
          class="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs py-2.5 px-4 rounded-lg shadow-sm transition-colors block text-center"
        >
          → Weiter zur Pflege-Inbox
        </router-link>
        <router-link 
          to="/" 
          class="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs py-2 px-4 rounded-lg transition-colors block text-center"
        >
          Zur Karte
        </router-link>
      </div>
    </div>

    <!-- State: Invalid / Expired / Error -->
    <div v-else-if="errorMessage && !inviteDetails" class="bg-white rounded-xl shadow-sm border border-rose-200 p-8 text-center space-y-5">
      <div class="w-14 h-14 bg-rose-100 text-rose-700 rounded-full flex items-center justify-center text-2xl mx-auto font-bold">
        ✕
      </div>
      <div>
        <h2 class="text-lg font-bold text-slate-900">
          Einladungslink nicht gültig
        </h2>
        <p class="text-xs text-slate-500 mt-2 leading-relaxed">
          {{ errorMessage }}
        </p>
      </div>

      <!-- Manual Input Fallback -->
      <div class="pt-3 border-t border-slate-100 text-left space-y-2">
        <label class="block text-xs font-medium text-slate-700">Anderen Einladungscode eingeben:</label>
        <div class="flex gap-2">
          <input 
            v-model="manualTokenInput" 
            type="text" 
            placeholder="Token oder Link hier einfügen..." 
            class="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono outline-none focus:border-amber-500" 
          />
          <button 
            @click="loadInviteByToken(manualTokenInput)" 
            type="button" 
            class="bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold px-3 py-2 rounded-lg"
          >
            Prüfen
          </button>
        </div>
      </div>

      <div class="pt-2">
        <router-link to="/" class="text-xs text-slate-500 hover:text-amber-600 font-medium">
          Zurück zur Startseite
        </router-link>
      </div>
    </div>

    <!-- State: Valid Invite Form -->
    <div v-else-if="inviteDetails" class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <!-- Card Header -->
      <div class="p-6 bg-gradient-to-br from-amber-500 to-amber-600 text-white text-center space-y-2">
        <span class="inline-block px-2.5 py-0.5 rounded-full bg-white/20 text-white text-[10px] font-bold tracking-wider uppercase backdrop-blur-sm">
          Regionalkoordination
        </span>
        <h1 class="text-xl font-black tracking-tight">
          Einladung zur AG Abgabestellen
        </h1>
        <p class="text-xs text-amber-100 max-w-sm mx-auto">
          Du wurdest eingeladen, die Abgabestellen der Region mitzubetreuen.
        </p>
      </div>

      <div class="p-6 space-y-5">
        <!-- Region Badge & Role Details -->
        <div class="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-xs text-slate-500 font-medium">Zielregion:</span>
            <span class="text-xs font-bold text-slate-900 bg-white border border-slate-200 px-2 py-0.5 rounded">
              {{ inviteDetails.region_name }}
            </span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-xs text-slate-500 font-medium">Rolle:</span>
            <span class="text-xs font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
              {{ formatRole(inviteDetails.role) }}
            </span>
          </div>
          <p class="text-[11px] text-slate-500 pt-1 border-t border-slate-200/60 leading-normal">
            Ermöglicht Prüfung eingegangener Vorschläge, direkte Datenpflege im AG-Modus und Download von Tabellen-Backups.
          </p>
        </div>

        <!-- Form Option A: Already Logged In -->
        <div v-if="authState.user" class="space-y-4">
          <div class="text-xs text-slate-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3 space-y-1">
            <div class="font-bold text-emerald-900 flex items-center gap-1.5">
              <span>✓</span>
              <span>Aktuell angemeldet</span>
            </div>
            <div class="text-slate-600">
              Konto: <strong>{{ authState.user.email }}</strong>
            </div>
          </div>

          <div v-if="redeemError" class="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs">
            {{ redeemError }}
          </div>

          <button 
            @click="redeemAsLoggedInUser" 
            :disabled="submitting" 
            type="button" 
            class="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs py-2.5 px-4 rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <span>{{ submitting ? 'Aktiviere Rolle...' : '✓ Einladung für mein Konto annehmen' }}</span>
          </button>

          <button 
            @click="logoutAndSwitch" 
            type="button" 
            class="w-full text-center text-xs text-slate-500 hover:text-slate-700 py-1"
          >
            Mit einer anderen E-Mail-Adresse annehmen
          </button>
        </div>

        <!-- Form Option B: Not Logged In / New User -->
        <form v-else @submit.prevent="redeemAndRegister" class="space-y-3.5 text-xs">
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Deine E-Mail-Adresse *</label>
            <input 
              v-model="email" 
              type="email" 
              required 
              placeholder="dein.name@foodsharing.network" 
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
            />
          </div>

          <div>
            <label class="block font-semibold text-slate-700 mb-1">
              Passwort vergeben * <span class="font-normal text-slate-400">(für zukünftige Logins)</span>
            </label>
            <input 
              v-model="password" 
              type="password" 
              required 
              minlength="6" 
              placeholder="Mindestens 6 Zeichen" 
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
            />
          </div>

          <div v-if="redeemError" class="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs">
            {{ redeemError }}
          </div>

          <div class="pt-2">
            <button 
              type="submit" 
              :disabled="submitting" 
              class="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs py-2.5 px-4 rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <span>{{ submitting ? 'Aktiviere Zugang...' : '✓ Einladung annehmen & Zugang aktivieren' }}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { authState, setAuthUser, fetchApi } from '../state';

interface InviteDetails {
  valid: boolean;
  token: string;
  region_id: number;
  region_name: string;
  role: string;
  expires_at: string;
}

const route = useRoute();

const loading = ref(true);
const inviteDetails = ref<InviteDetails | null>(null);
const errorMessage = ref('');
const manualTokenInput = ref('');

const email = ref('');
const password = ref('');
const submitting = ref(false);
const redeemError = ref('');
const redeemSuccess = ref(false);

function cleanToken(input: string): string {
  if (!input) return '';
  const trimmed = input.trim();
  if (trimmed.includes('token=')) {
    const m = trimmed.match(/token=([a-fA-F0-9]+)/);
    if (m) return m[1];
  }
  if (trimmed.includes('/invite/')) {
    const m = trimmed.match(/\/invite\/([a-fA-F0-9]+)/);
    if (m) return m[1];
  }
  return trimmed;
}

function formatRole(role: string): string {
  if (role === 'WORKGROUP_GIVING_STORES') return 'AG Abgabestellen (Koordination)';
  if (role === 'AMBASSADOR') return 'Botschafter:in';
  if (role === 'ORGA') return 'Organisation (ORGA)';
  return role;
}

async function loadInviteByToken(rawInput: string) {
  const token = cleanToken(rawInput);
  if (!token) {
    loading.value = false;
    errorMessage.value = 'Bitte gib einen gültigen Einladungscode ein.';
    return;
  }

  loading.value = true;
  errorMessage.value = '';
  inviteDetails.value = null;

  try {
    const res = await fetch(`/api/invite/${token}`);
    const data = await res.json();

    if (!res.ok || !data.valid) {
      errorMessage.value = data.error || 'Ungültiger oder abgelaufener Einladungslink.';
    } else {
      inviteDetails.value = data;
    }
  } catch (err: any) {
    errorMessage.value = err.message || 'Verbindungsfehler beim Prüfen des Einladungslinks.';
  } finally {
    loading.value = false;
  }
}

async function redeemAsLoggedInUser() {
  if (!inviteDetails.value) return;
  submitting.value = true;
  redeemError.value = '';

  try {
    await fetchApi('/api/invite/redeem', {
      method: 'POST',
      body: JSON.stringify({ token: inviteDetails.value.token })
    });
    redeemSuccess.value = true;
  } catch (err: any) {
    redeemError.value = err.message || 'Fehler beim Einlösen der Einladung.';
  } finally {
    submitting.value = false;
  }
}

async function redeemAndRegister() {
  if (!inviteDetails.value) return;
  submitting.value = true;
  redeemError.value = '';

  try {
    const res = await fetchApi<{ user: any; token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: email.value.trim(),
        password: password.value,
        inviteOrSecret: inviteDetails.value.token
      })
    });

    setAuthUser(res.user, res.token);
    redeemSuccess.value = true;
  } catch (err: any) {
    redeemError.value = err.message || 'Fehler bei der Registrierung mit dem Einladungscode.';
  } finally {
    submitting.value = false;
  }
}

function logoutAndSwitch() {
  setAuthUser(null, null);
}

onMounted(() => {
  const paramToken = (route.params.token as string) || (route.query.token as string) || '';
  loadInviteByToken(paramToken);
});
</script>
