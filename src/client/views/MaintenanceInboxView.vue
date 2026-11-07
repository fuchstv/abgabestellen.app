<template>
  <div class="max-w-7xl mx-auto px-4 py-6 sm:py-8 space-y-6 flex-1 w-full">
    <!-- Page Header -->
    <div class="fs-container p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <div class="flex flex-wrap items-center gap-2.5">
          <h1 class="font-headline text-2xl text-fs-primary-600 leading-tight">
            Pflege-Dashboard & Inbox
          </h1>
          <span class="fs-badge-green">
            <ShieldCheck class="w-3.5 h-3.5" />
            AG Abgabestellen
          </span>
        </div>
        <p class="text-xs text-fs-muted mt-1">
          Prüfungs-Warteschlange für Community-Vorschläge, Aktualitäts-Ampel und Einladungslinks für Regionalkoordination.
        </p>
      </div>

      <!-- Action Buttons -->
      <div class="flex flex-wrap items-center gap-2.5">
        <button
          @click="downloadCsvBackup"
          type="button"
          :disabled="downloadingCsv"
          class="fs-btn-secondary"
        >
          <Download class="w-3.5 h-3.5" />
          <span>{{ downloadingCsv ? 'Bereite Export vor...' : 'Backup als Tabelle (CSV)' }}</span>
        </button>
        <button
          @click="showInviteModal = true"
          type="button"
          class="fs-btn-primary"
        >
          <UserPlus class="w-3.5 h-3.5" />
          <span>Einladungslink generieren</span>
        </button>
      </div>
    </div>

    <!-- Section 1: Community Suggestions Inbox -->
    <FsContainer body-class="p-0">
      <template #icon>
        <Inbox class="w-4 h-4 text-fs-secondary-600" />
      </template>
      <template #title>
        <div class="flex items-center gap-2">
          <h2 class="font-sans text-sm font-bold text-fs-primary-900 m-0">
            Offene Änderungsvorschläge
          </h2>
          <span class="bg-[#64ae24] text-white text-[11px] font-bold px-2 py-0.5 rounded-full leading-none">
            {{ pendingSuggestions.length }}
          </span>
        </div>
      </template>

      <div
        v-if="pendingSuggestions.length === 0"
        class="text-xs text-fs-muted italic p-8 text-center bg-fs-surface"
      >
        Aktuell liegen keine offenen Änderungsvorschläge in deiner Region vor.
      </div>

      <div v-else class="divide-y divide-fs-primary-200">
        <div
          v-for="s in pendingSuggestions"
          :key="s.id"
          class="p-4 sm:px-5 bg-fs-surface hover:bg-fs-secondary-100/60 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
        >
          <div class="space-y-1 text-xs">
            <div class="flex flex-wrap items-center gap-2">
              <span class="font-bold text-fs-primary-900 text-sm">
                {{ s.store_name || s.payload.name || 'Neuer Vorschlag' }}
              </span>
              <span class="fs-badge-brown">
                {{ s.region_name }}
              </span>
              <span v-if="!s.store_id" class="fs-badge-green !text-[10px]">
                Neue Einrichtung
              </span>
            </div>
            <p v-if="s.author_note" class="text-fs-text italic bg-fs-bg border border-fs-primary-200 rounded px-2.5 py-1.5 mt-1">
              „{{ s.author_note }}“
            </p>
            <div class="text-[11px] text-fs-muted pt-0.5">
              Eingereicht am {{ formatDate(s.created_at) }} von {{ s.author_email || 'Community' }}
            </div>
          </div>

          <div class="flex items-center gap-2 shrink-0">
            <button
              @click="review(s.id, 'APPROVED')"
              type="button"
              class="fs-btn-primary !py-1.5"
            >
              <Check class="w-3.5 h-3.5" />
              <span>Freigeben</span>
            </button>
            <button
              @click="review(s.id, 'REJECTED')"
              type="button"
              class="fs-btn-danger !py-1.5"
            >
              <X class="w-3.5 h-3.5" />
              <span>Ablehnen</span>
            </button>
          </div>
        </div>
      </div>
    </FsContainer>

    <!-- Section 2: Verification Traffic Light -->
    <FsContainer title="Verifizierungs-Ampel (Zuletzt kontaktiert)" body-class="p-0">
      <template #icon>
        <Activity class="w-4 h-4 text-fs-primary-700" />
      </template>
      <template #actions>
        <div class="hidden sm:flex items-center gap-3 text-[11px] font-medium text-fs-primary-800">
          <span class="flex items-center gap-1.5">
            <span class="w-2.5 h-2.5 rounded-full bg-[#64ae24]"></span> &lt; 90 Tage
          </span>
          <span class="flex items-center gap-1.5">
            <span class="w-2.5 h-2.5 rounded-full bg-[#cc990e]"></span> 90–180 Tage
          </span>
          <span class="flex items-center gap-1.5">
            <span class="w-2.5 h-2.5 rounded-full bg-[#cf3a00]"></span> &gt; 180 Tage / Nie
          </span>
        </div>
      </template>

      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs">
          <thead class="bg-fs-bg border-b border-fs-primary-200 text-fs-muted font-bold uppercase text-[10px] tracking-wider">
            <tr>
              <th class="p-3.5">Status</th>
              <th class="p-3.5">Abgabestelle</th>
              <th class="p-3.5">Bezirk</th>
              <th class="p-3.5">Zuletzt verifiziert</th>
              <th class="p-3.5">Interner Kontakt</th>
              <th class="p-3.5 text-right">Aktion</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-fs-primary-200/80">
            <tr
              v-for="store in overdueStores"
              :key="store.id"
              class="hover:bg-fs-primary-100 transition-colors"
            >
              <td class="p-3.5">
                <span
                  :class="[
                    'w-3 h-3 rounded-full inline-block ring-2 ring-white/60 shadow-sm',
                    getTrafficLightColor(store.last_contact_at)
                  ]"
                ></span>
              </td>
              <td class="p-3.5 font-bold text-fs-primary-900">
                <router-link
                  :to="'/stores/' + store.id"
                  class="hover:text-fs-secondary-600 hover:underline transition-colors"
                >
                  {{ store.name }}
                </router-link>
                <div class="text-[11px] font-normal text-fs-muted">
                  {{ store.str }}, {{ store.plz }} {{ store.stadt }}
                </div>
              </td>
              <td class="p-3.5 text-fs-muted font-medium">{{ store.region_name }}</td>
              <td class="p-3.5">
                <span v-if="store.last_contact_at" class="text-fs-text font-semibold">
                  {{ formatDate(store.last_contact_at) }}
                </span>
                <span v-else class="fs-badge-red !text-[10px]">
                  Nie verifiziert
                </span>
              </td>
              <td class="p-3.5 text-fs-text">
                <div v-if="store.ansprechpartner" class="font-medium">{{ store.ansprechpartner }}</div>
                <div v-if="store.telefon" class="text-fs-secondary-700 font-semibold text-[11px]">
                  {{ store.telefon }}
                </div>
                <div v-if="!store.ansprechpartner && !store.telefon" class="text-fs-muted italic">
                  Keine internen Daten
                </div>
              </td>
              <td class="p-3.5 text-right">
                <router-link
                  :to="'/stores/' + store.id"
                  class="fs-btn-secondary !py-1 !px-2.5"
                >
                  <span>Kontakt erfassen</span>
                </router-link>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </FsContainer>

    <!-- Invite Token Generator Modal -->
    <div
      v-if="showInviteModal"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-xs"
      @click.self="showInviteModal = false"
    >
      <div class="fs-container shadow-fs w-full max-w-md overflow-hidden">
        <div class="fs-container-header">
          <div class="flex items-center gap-2 font-bold text-sm text-fs-primary-900">
            <UserPlus class="w-4 h-4 text-fs-secondary-600" />
            <span>Einladungslink generieren</span>
          </div>
          <button
            @click="showInviteModal = false"
            type="button"
            class="text-fs-primary-700 hover:text-fs-danger-600 p-1 rounded-fs cursor-pointer"
          >
            <X class="w-4 h-4" />
          </button>
        </div>

        <div class="p-5 space-y-4 bg-fs-surface text-xs">
          <p class="text-fs-muted leading-relaxed">
            Erzeugt einen kryptografisch signierten Einmal-Link für neue Koordinator:innen in der gewählten Zielregion.
          </p>

          <div>
            <label class="block font-semibold text-fs-primary-800 mb-1">Zielregion</label>
            <select v-model="selectedInviteRegion" class="fs-input">
              <option v-for="r in appState.regions" :key="r.id" :value="r.id">
                {{ r.name }}
              </option>
            </select>
          </div>

          <div
            v-if="generatedInviteLink"
            class="bg-fs-secondary-100 border border-fs-secondary-300 p-3 rounded-fs space-y-2"
          >
            <div class="font-bold text-fs-secondary-900">Generierter Einmal-Link:</div>
            <div class="flex items-center gap-1.5">
              <input
                readonly
                :value="generatedInviteLink"
                class="flex-1 text-[11px] bg-fs-surface border border-fs-primary-300 rounded-fs px-2.5 py-1.5 font-mono select-all text-fs-text"
              />
              <button
                type="button"
                @click="copyInviteLink"
                class="fs-btn-secondary !py-1.5 !px-2.5"
                title="In Zwischenablage kopieren"
              >
                <Copy class="w-3.5 h-3.5" />
              </button>
            </div>
            <p class="text-[10px] text-fs-muted">
              Gültig für 7 Tage. Kann nur einmalig eingelöst werden.
            </p>
          </div>

          <div class="flex justify-end gap-2 pt-2 border-t border-fs-primary-200">
            <button @click="showInviteModal = false" type="button" class="fs-btn-secondary">
              Schließen
            </button>
            <button @click="createInvite" type="button" class="fs-btn-primary">
              <Link2 class="w-3.5 h-3.5" />
              <span>Link erzeugen</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import {
  ShieldCheck,
  Download,
  UserPlus,
  Inbox,
  Check,
  X,
  Activity,
  Copy,
  Link2
} from 'lucide-vue-next';
import { appState, authState, fetchApi, notifySuccess, notifyError } from '../state';
import FsContainer from '../components/FsContainer.vue';

const pendingSuggestions = ref<any[]>([]);
const overdueStores = ref<any[]>([]);
const showInviteModal = ref(false);
const selectedInviteRegion = ref<number>(appState.currentRegion?.id || 1);
const generatedInviteLink = ref('');
const downloadingCsv = ref(false);

async function downloadCsvBackup() {
  const regionId = appState.currentRegion?.id || 1;
  downloadingCsv.value = true;
  try {
    const headers = new Headers();
    if (authState.token) {
      headers.set('Authorization', `Bearer ${authState.token}`);
    }
    const res = await fetch(`/api/regions/${regionId}/export-berlin.csv`, { headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      notifyError(err.message || err.error || 'Fehler beim Herunterladen des Backups');
      return;
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const regionName = (appState.currentRegion?.name || 'berlin').toLowerCase().replace(/[^a-z0-9]/g, '-');
    a.download = `abgabestellen-${regionName}-backup-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
    notifySuccess('CSV-Backup wurde heruntergeladen.');
  } catch (err: any) {
    notifyError(err.message || 'Fehler beim Herunterladen des Backups');
  } finally {
    downloadingCsv.value = false;
  }
}

function formatDate(isoStr: string) {
  try {
    return new Date(isoStr).toLocaleDateString('de-DE');
  } catch {
    return isoStr;
  }
}

function getTrafficLightColor(lastContactAt: string | null): string {
  if (!lastContactAt) return 'bg-[#cf3a00]';
  const days = (Date.now() - new Date(lastContactAt).getTime()) / (1000 * 60 * 60 * 24);
  if (days < 90) return 'bg-[#64ae24]';
  if (days < 180) return 'bg-[#cc990e]';
  return 'bg-[#cf3a00]';
}

async function loadData() {
  const regionId = appState.currentRegion?.id || 1;
  try {
    const suggestions = await fetchApi<any[]>(`/api/regions/${regionId}/suggestions?status=pending`);
    pendingSuggestions.value = suggestions;
    appState.pendingSuggestionsCount = suggestions.length;

    const overdue = await fetchApi<any[]>(`/api/maintenance/overdue-contacts?region_id=${regionId}`);
    overdueStores.value = overdue;
  } catch (err) {
    console.error('Error loading maintenance data', err);
  }
}

async function review(id: number, decision: 'APPROVED' | 'REJECTED') {
  try {
    await fetchApi(`/api/suggestions/${id}/review`, {
      method: 'POST',
      body: JSON.stringify({ decision })
    });
    notifySuccess(
      decision === 'APPROVED'
        ? 'Vorschlag wurde freigegeben und übernommen.'
        : 'Vorschlag wurde abgelehnt.'
    );
    loadData();
  } catch (err: any) {
    notifyError(err.message || 'Fehler beim Überprüfen des Vorschlags');
  }
}

async function createInvite() {
  try {
    const res = await fetchApi<{ rawToken: string }>(`/api/invite/create`, {
      method: 'POST',
      body: JSON.stringify({ region_id: selectedInviteRegion.value })
    });
    generatedInviteLink.value = `${window.location.origin}/invite/${res.rawToken}`;
    notifySuccess('Einladungslink erfolgreich erzeugt.');
  } catch (err: any) {
    notifyError(err.message || 'Fehler beim Erzeugen des Links');
  }
}

async function copyInviteLink() {
  if (!generatedInviteLink.value) return;
  try {
    await navigator.clipboard.writeText(generatedInviteLink.value);
    notifySuccess('Einladungslink in die Zwischenablage kopiert!');
  } catch {
    notifyError('Kopieren fehlgeschlagen – bitte Link manuell markieren.');
  }
}

onMounted(() => {
  loadData();
});
</script>
