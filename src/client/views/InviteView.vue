<template>
  <div class="max-w-md mx-auto px-4 py-10 sm:py-12 flex-1 w-full">
    <!-- State: Loading -->
    <div v-if="loading" class="fs-container p-8 text-center space-y-4">
      <div class="w-10 h-10 border-4 border-[#64ae24] border-t-transparent rounded-full animate-spin mx-auto"></div>
      <p class="text-xs text-fs-muted font-medium">Lade Einladungsdetails...</p>
    </div>

    <!-- State: Success Completed -->
    <div v-else-if="redeemSuccess" class="fs-container border-fs-secondary-400 p-8 text-center space-y-5">
      <div class="w-14 h-14 bg-fs-secondary-200 text-fs-secondary-800 rounded-full flex items-center justify-center mx-auto shadow-inner">
        <CheckCircle2 class="w-8 h-8 text-[#64ae24]" />
      </div>
      <div>
        <h2 class="font-headline text-xl text-fs-primary-600">
          Herzlich willkommen im Team!
        </h2>
        <p class="text-xs text-fs-text mt-2 leading-relaxed">
          Deine Einladung wurde erfolgreich eingelöst. Du hast nun vollen Zugriff auf die Pflege-Inbox und die regionalen Abgabestellen für
          <strong class="text-fs-primary-900">{{ inviteDetails?.region_name || 'deine Region' }}</strong>.
        </p>
      </div>

      <div class="pt-2 flex flex-col gap-2">
        <router-link to="/maintenance" class="w-full fs-btn-primary !py-2.5">
          <span>Weiter zur Pflege-Inbox</span>
          <ArrowRight class="w-3.5 h-3.5" />
        </router-link>
        <router-link to="/" class="w-full fs-btn-secondary !py-2">
          Zur Karte
        </router-link>
      </div>
    </div>

    <!-- State: Invalid / Expired / Error -->
    <div v-else-if="errorMessage && !inviteDetails" class="fs-container border-fs-danger-300 p-8 text-center space-y-5">
      <div class="w-14 h-14 bg-fs-danger-200 text-fs-danger-800 rounded-full flex items-center justify-center mx-auto">
        <AlertTriangle class="w-7 h-7 text-fs-danger-600" />
      </div>
      <div>
        <h2 class="font-headline text-lg text-fs-primary-600">
          Einladungslink nicht gültig
        </h2>
        <p class="text-xs text-fs-muted mt-2 leading-relaxed">
          {{ errorMessage }}
        </p>
      </div>

      <!-- Manual Input Fallback -->
      <div class="pt-3 border-t border-fs-primary-200 text-left space-y-2">
        <label class="block text-xs font-semibold text-fs-primary-800">
          Anderen Einladungscode eingeben:
        </label>
        <div class="flex gap-2">
          <input
            v-model="manualTokenInput"
            type="text"
            placeholder="Token oder Link hier einfügen..."
            class="flex-1 fs-input font-mono"
          />
          <button
            @click="loadInviteByToken(manualTokenInput)"
            type="button"
            class="fs-btn-primary"
          >
            Prüfen
          </button>
        </div>
      </div>

      <div class="pt-1">
        <router-link to="/" class="text-xs text-fs-muted hover:text-fs-secondary-600 font-medium">
          Zurück zur Startseite
        </router-link>
      </div>
    </div>

    <!-- State: Valid Invite Form -->
    <div v-else-if="inviteDetails" class="fs-container overflow-hidden">
      <!-- Warm Leaf-Green Header -->
      <div class="p-6 bg-[#64ae24] text-white text-center space-y-2">
        <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/20 text-white text-[10px] font-bold tracking-wider uppercase">
          <ShieldCheck class="w-3 h-3" />
          Regionalkoordination
        </span>
        <h1 class="font-headline text-xl tracking-normal text-white">
          Einladung zur AG Abgabestellen
        </h1>
        <p class="text-xs text-white/90 max-w-sm mx-auto">
          Du wurdest eingeladen, die Abgabestellen der Region mitzubetreuen.
        </p>
      </div>

      <div class="p-6 space-y-5 bg-fs-surface">
        <!-- Region Badge & Role Details -->
        <div class="bg-fs-bg border border-fs-primary-200 rounded-fs p-3.5 space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-xs text-fs-muted font-medium">Zielregion:</span>
            <span class="fs-badge-brown">
              {{ inviteDetails.region_name }}
            </span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-xs text-fs-muted font-medium">Rolle:</span>
            <span class="fs-badge-green">
              {{ formatRole(inviteDetails.role) }}
            </span>
          </div>
          <p class="text-[11px] text-fs-muted pt-1.5 border-t border-fs-primary-200 leading-normal">
            Ermöglicht Prüfung eingegangener Vorschläge, direkte Datenpflege im AG-Modus und Download von Tabellen-Backups.
          </p>
        </div>

        <!-- Form Option A: Already Logged In -->
        <div v-if="authState.user" class="space-y-4">
          <div class="text-xs text-fs-secondary-900 bg-fs-secondary-100 border border-fs-secondary-300 rounded-fs p-3 space-y-1">
            <div class="font-bold flex items-center gap-1.5">
              <CheckCircle2 class="w-4 h-4 text-[#64ae24]" />
              <span>Aktuell angemeldet</span>
            </div>
            <div class="text-fs-text">
              Konto: <strong>{{ authState.user.email }}</strong>
            </div>
          </div>

          <div
            v-if="redeemError"
            class="p-3 bg-fs-danger-100 border border-fs-danger-300 rounded-fs text-fs-danger-900 text-xs"
          >
            {{ redeemError }}
          </div>

          <button
            @click="redeemAsLoggedInUser"
            :disabled="submitting"
            type="button"
            class="w-full fs-btn-primary !py-2.5"
          >
            <CheckCircle2 class="w-4 h-4" />
            <span>{{ submitting ? 'Aktiviere Rolle...' : 'Einladung für mein Konto annehmen' }}</span>
          </button>

          <button
            @click="logoutAndSwitch"
            type="button"
            class="w-full text-center text-xs text-fs-muted hover:text-fs-text py-1 cursor-pointer"
          >
            Mit einer anderen E-Mail-Adresse annehmen
          </button>
        </div>

        <!-- Form Option B: Not Logged In / New User -->
        <form v-else @submit.prevent="redeemAndRegister" class="space-y-3.5 text-xs">
          <div>
            <label class="block font-semibold text-fs-primary-800 mb-1">Deine E-Mail-Adresse *</label>
            <input
              v-model="email"
              type="email"
              required
              placeholder="dein.name@foodsharing.network"
              class="fs-input"
            />
          </div>

          <div>
            <label class="block font-semibold text-fs-primary-800 mb-1">
              Passwort vergeben * <span class="font-normal text-fs-muted">(für zukünftige Logins)</span>
            </label>
            <input
              v-model="password"
              type="password"
              required
              minlength="6"
              placeholder="Mindestens 6 Zeichen"
              class="fs-input"
            />
          </div>

          <div
            v-if="redeemError"
            class="p-3 bg-fs-danger-100 border border-fs-danger-300 rounded-fs text-fs-danger-900 text-xs"
          >
            {{ redeemError }}
          </div>

          <div class="pt-2">
            <button
              type="submit"
              :disabled="submitting"
              class="w-full fs-btn-primary !py-2.5"
            >
              <CheckCircle2 class="w-4 h-4" />
              <span>{{ submitting ? 'Aktiviere Zugang...' : 'Einladung annehmen & Zugang aktivieren' }}</span>
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
import { CheckCircle2, ArrowRight, AlertTriangle, ShieldCheck } from 'lucide-vue-next';
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
  const match = trimmed.match(/(?:token=|\/invite\/)([a-fA-F0-9]+)/);
  if (match) return match[1];
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
