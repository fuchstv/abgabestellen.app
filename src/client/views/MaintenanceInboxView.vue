<template>
  <div class="max-w-7xl mx-auto px-4 py-8 space-y-8 flex-1">
    <!-- Header -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
      <div>
        <h1 class="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          <span>Pflege-Dashboard & Inbox</span>
          <span class="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800">
            AG Abgabestellen
          </span>
        </h1>
        <p class="text-xs text-slate-500 mt-1">
          Übersicht der Prüfungs-Warteschlange, Aktualitäts-Ampel und Einladungslinks für Regionalkoordination.
        </p>
      </div>

      <!-- Action Buttons -->
      <div class="flex flex-wrap items-center gap-3">
        <button 
          @click="downloadCsvBackup" 
          type="button" 
          :disabled="downloadingCsv"
          class="bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs px-4 py-2 rounded-lg shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50"
        >
          <span>{{ downloadingCsv ? '⏳ Bereite Export vor...' : '📥 Backup als Tabelle (CSV) herunterladen' }}</span>
        </button>
        <button 
          @click="showInviteModal = true" 
          type="button" 
          class="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs px-4 py-2 rounded-lg shadow-sm transition-colors"
        >
          + Einladungslink für Koordination generieren
        </button>
      </div>
    </div>

    <!-- Section 1: Community Suggestions Inbox -->
    <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-base font-bold text-slate-900 flex items-center gap-2">
          <span>📬 Offene Änderungsvorschläge</span>
          <span class="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500 text-white">
            {{ pendingSuggestions.length }}
          </span>
        </h2>
      </div>

      <div v-if="pendingSuggestions.length === 0" class="text-xs text-slate-500 italic p-6 text-center bg-slate-50 rounded-lg">
        Aktuell liegen keine offenen Änderungsvorschläge in deiner Region vor.
      </div>

      <div v-else class="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
        <div 
          v-for="s in pendingSuggestions" 
          :key="s.id" 
          class="p-4 bg-white hover:bg-slate-50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
        >
          <div class="space-y-1 text-xs">
            <div class="flex items-center gap-2">
              <span class="font-bold text-slate-900 text-sm">
                {{ s.store_name || s.payload.name || 'Neuer Vorschlag' }}
              </span>
              <span class="bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium">
                {{ s.region_name }}
              </span>
            </div>
            <p v-if="s.author_note" class="text-slate-600 italic">
              "{{ s.author_note }}"
            </p>
            <div class="text-[11px] text-slate-400">
              Eingereicht am {{ formatDate(s.created_at) }} von {{ s.author_email || 'Foodsaver' }}
            </div>
          </div>

          <div class="flex items-center gap-2 shrink-0">
            <button 
              @click="review(s.id, 'APPROVED')" 
              type="button" 
              class="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-1.5 rounded transition-colors"
            >
              ✓ Freigeben
            </button>
            <button 
              @click="review(s.id, 'REJECTED')" 
              type="button" 
              class="bg-rose-100 hover:bg-rose-200 text-rose-800 text-xs font-semibold px-3 py-1.5 rounded transition-colors"
            >
              ✕ Ablehnen
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Section 2: Overdue Contacts & Verification Traffic Light -->
    <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-base font-bold text-slate-900 flex items-center gap-2">
          <span>🚦 Verifizierungs-Ampel (Zuletzt kontaktiert)</span>
        </h2>
        <div class="flex items-center gap-3 text-[11px] text-slate-500">
          <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> &lt; 90 Tage</span>
          <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-full bg-amber-500"></span> 90-180 Tage</span>
          <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-full bg-rose-500"></span> &gt; 180 Tage / Nie</span>
        </div>
      </div>

      <div class="overflow-x-auto border border-slate-200 rounded-lg">
        <table class="w-full text-left text-xs">
          <thead class="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px]">
            <tr>
              <th class="p-3">Status</th>
              <th class="p-3">Abgabestelle</th>
              <th class="p-3">Bezirk</th>
              <th class="p-3">Zuletzt verifiziert</th>
              <th class="p-3">Interner Kontakt</th>
              <th class="p-3 text-right">Aktion</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="store in overdueStores" :key="store.id" class="hover:bg-slate-50/70">
              <td class="p-3">
                <span 
                  :class="[
                    'w-3 h-3 rounded-full inline-block',
                    getTrafficLightColor(store.last_contact_at)
                  ]"
                ></span>
              </td>
              <td class="p-3 font-bold text-slate-900">
                <router-link :to="'/stores/' + store.id" class="hover:text-amber-600 hover:underline">
                  {{ store.name }}
                </router-link>
                <div class="text-[11px] font-normal text-slate-500">{{ store.str }}, {{ store.plz }} {{ store.stadt }}</div>
              </td>
              <td class="p-3 text-slate-600">{{ store.region_name }}</td>
              <td class="p-3">
                <span v-if="store.last_contact_at" class="text-slate-800 font-medium">
                  {{ formatDate(store.last_contact_at) }}
                </span>
                <span v-else class="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-semibold text-[10px]">
                  Nie verifiziert
                </span>
              </td>
              <td class="p-3 text-slate-700">
                <div v-if="store.ansprechpartner" class="font-medium">{{ store.ansprechpartner }}</div>
                <div v-if="store.telefon" class="text-amber-700 text-[11px]">{{ store.telefon }}</div>
                <div v-if="!store.ansprechpartner && !store.telefon" class="text-slate-400 italic">Keine internen Daten</div>
              </td>
              <td class="p-3 text-right">
                <router-link 
                  :to="'/stores/' + store.id" 
                  class="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-2.5 py-1 rounded text-xs transition-colors"
                >
                  Kontakt erfassen
                </router-link>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Invite Token Generator Modal -->
    <div v-if="showInviteModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div class="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md p-6 space-y-4">
        <h3 class="text-base font-bold text-slate-900">
          Einladungslink generieren
        </h3>
        <p class="text-xs text-slate-500">
          Erzeugt einen kryptografisch signierten Einmal-Link für neue Koordinator:innen mit Double Opt-in.
        </p>

        <div>
          <label class="block text-xs font-medium text-slate-700 mb-1">Zielregion</label>
          <select v-model="selectedInviteRegion" class="w-full text-xs rounded border border-slate-300 p-2 bg-white">
            <option v-for="r in appState.regions" :key="r.id" :value="r.id">
              {{ r.name }}
            </option>
          </select>
        </div>

        <div v-if="generatedInviteLink" class="bg-slate-50 border border-slate-200 p-3 rounded text-xs space-y-1">
          <div class="font-bold text-slate-800">Generierter Link:</div>
          <input readonly :value="generatedInviteLink" class="w-full text-[11px] bg-white border border-slate-300 rounded p-1.5 font-mono select-all" />
          <p class="text-[10px] text-slate-500 pt-1">Gültig für 7 Tage. Kann nur einmalig eingelöst werden.</p>
        </div>

        <div class="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <button @click="showInviteModal = false" type="button" class="px-3 py-1.5 rounded border border-slate-300 text-xs">
            Schließen
          </button>
          <button @click="createInvite" type="button" class="px-4 py-1.5 rounded bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs">
            Link erzeugen
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { appState, authState, fetchApi } from '../state';

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
      alert(err.message || err.error || 'Fehler beim Herunterladen des Backups');
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
  } catch (err: any) {
    alert(err.message || 'Fehler beim Herunterladen des Backups');
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
  if (!lastContactAt) return 'bg-rose-500';
  const days = (Date.now() - new Date(lastContactAt).getTime()) / (1000 * 60 * 60 * 24);
  if (days < 90) return 'bg-emerald-500';
  if (days < 180) return 'bg-amber-500';
  return 'bg-rose-500';
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
    loadData();
  } catch (err: any) {
    alert(err.message || 'Fehler beim Überprüfen');
  }
}

async function createInvite() {
  try {
    const res = await fetchApi<{ rawToken: string }>(`/api/invite/create`, {
      method: 'POST',
      body: JSON.stringify({ region_id: selectedInviteRegion.value })
    });
    generatedInviteLink.value = `${window.location.origin}/invite/${res.rawToken}`;
  } catch (err: any) {
    alert(err.message || 'Fehler beim Erzeugen des Links');
  }
}

onMounted(() => {
  loadData();
});
</script>
