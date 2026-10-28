<template>
  <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
    <!-- Confidentiality banner -->
    <div class="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-lg">
      <div class="flex items-start gap-3">
        <span class="text-amber-600 text-lg">🔒</span>
        <div>
          <h4 class="text-sm font-bold text-amber-900">
            Streng vertraulicher interner Bereich (AG Abgabestellen)
          </h4>
          <p class="text-xs text-amber-800 mt-0.5">
            Diese Kontaktdaten und Protokolle sind ausschließlich für autorisierte Manager sichtbar und werden niemals öffentlich angezeigt.
          </p>
        </div>
      </div>
    </div>

    <!-- Internal contact info card -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
      <div>
        <div class="text-xs font-semibold text-slate-500 uppercase">Interner Ansprechpartner</div>
        <div class="text-base font-bold text-slate-900 mt-1">
          {{ internalStore.ansprechpartner || '— Keine interne Ansprechperson hinterlegt —' }}
        </div>
      </div>
      <div>
        <div class="text-xs font-semibold text-slate-500 uppercase">Interne Telefonnummer / Direktwahl</div>
        <div class="text-base font-bold text-slate-900 mt-1">
          <a v-if="internalStore.telefon" :href="'tel:' + internalStore.telefon" class="text-amber-700 hover:underline">
            {{ internalStore.telefon }}
          </a>
          <span v-else class="text-slate-400 font-normal">— Keine interne Durchwahl hinterlegt —</span>
        </div>
      </div>
    </div>

    <!-- Quick add log form -->
    <div class="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
      <h4 class="text-sm font-bold text-slate-900 mb-3 flex items-center justify-between">
        <span>Neuen Kontaktversuch / Verifizierung erfassen</span>
        <span class="text-xs font-normal text-slate-500">Aktualisiert automatisch „Zuletzt kontaktiert“</span>
      </h4>

      <form @submit.prevent="submitLog" class="space-y-3">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-medium text-slate-700 mb-1">Kanal</label>
            <select v-model="form.channel" class="w-full text-xs rounded border border-slate-300 p-2 bg-white">
              <option value="Telefon">Telefon</option>
              <option value="E-Mail">E-Mail</option>
              <option value="Vor Ort">Vor Ort</option>
              <option value="Messenger">Messenger</option>
              <option value="Sonstiges">Sonstiges</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-700 mb-1">Gesprochen mit (Person / Rolle)</label>
            <input 
              v-model="form.contact_person" 
              type="text" 
              placeholder="z.B. Frau Schmidt (Küchenleitung)" 
              class="w-full text-xs rounded border border-slate-300 p-2"
            />
          </div>
        </div>

        <div>
          <label class="block text-xs font-medium text-slate-700 mb-1">Gesprächsnotiz / Vereinbarungen (erforderlich)</label>
          <textarea 
            v-model="form.note" 
            required 
            rows="3" 
            placeholder="z.B. Frau Schmidt hat telefonisch bestätigt, dass Mo-Fr bis 14 Uhr abgegeben werden kann. Keine Schokolade im Sommer."
            class="w-full text-xs rounded border border-slate-300 p-2"
          ></textarea>
        </div>

        <div class="flex items-center gap-2 pt-1">
          <input 
            v-model="form.confirmed_current" 
            id="confirmedCurrent" 
            type="checkbox" 
            class="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
          />
          <label for="confirmedCurrent" class="text-xs text-slate-800 font-medium cursor-pointer">
            Informationen wurden als aktuell bestätigt (setzt Status auf „Aktuell“)
          </label>
        </div>

        <div class="pt-2 flex justify-end">
          <button 
            type="submit" 
            :disabled="submitting" 
            class="bg-amber-600 hover:bg-amber-700 text-white font-medium py-1.5 px-4 rounded text-xs transition-colors disabled:opacity-50"
          >
            {{ submitting ? 'Speichert...' : 'Protokoll speichern' }}
          </button>
        </div>
      </form>
    </div>

    <!-- Chronological contact log history -->
    <div>
      <h4 class="text-sm font-bold text-slate-900 mb-3">
        Bisherige Kontaktprotokolle ({{ logs.length }})
      </h4>

      <div v-if="logs.length === 0" class="text-xs text-slate-500 italic p-4 text-center bg-slate-50 rounded-lg">
        Bislang liegen keine Kontaktprotokolle für diese Abgabestelle vor.
      </div>

      <div v-else class="space-y-3">
        <div 
          v-for="entry in logs" 
          :key="entry.id" 
          class="border border-slate-200 rounded-lg p-3.5 text-xs bg-slate-50/50 space-y-1.5"
        >
          <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-1.5">
            <div class="flex items-center gap-2">
              <span class="font-bold text-slate-800 px-2 py-0.5 rounded bg-slate-200 text-[11px]">
                {{ entry.channel }}
              </span>
              <span v-if="entry.contact_person" class="font-medium text-slate-700">
                mit {{ entry.contact_person }}
              </span>
              <span v-if="entry.confirmed_current === 1" class="text-emerald-700 bg-emerald-100 font-semibold px-2 py-0.5 rounded text-[10px]">
                ✓ Als aktuell bestätigt
              </span>
            </div>
            <div class="text-slate-500 text-[11px]">
              {{ formatDate(entry.contacted_at) }} durch {{ entry.author_name || 'Manager' }}
            </div>
          </div>
          <p class="text-slate-800 whitespace-pre-line leading-relaxed">
            {{ entry.note }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { InternalStore, ContactLogEntry } from '@shared/types';
import { fetchApi } from '../state';

const props = defineProps<{
  internalStore: InternalStore;
  logs: ContactLogEntry[];
}>();

const emit = defineEmits<{
  (e: 'logAdded'): void;
}>();

const submitting = ref(false);
const form = reactive({
  channel: 'Telefon' as const,
  contact_person: '',
  note: '',
  confirmed_current: true
});

function formatDate(isoStr: string) {
  try {
    return new Date(isoStr).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return isoStr;
  }
}

async function submitLog() {
  if (!form.note.trim()) return;
  submitting.value = true;
  try {
    await fetchApi(`/api/giving-stores/${props.internalStore.id}/contact-log`, {
      method: 'POST',
      body: JSON.stringify({
        channel: form.channel,
        contact_person: form.contact_person,
        note: form.note,
        confirmed_current: form.confirmed_current
      })
    });
    form.note = '';
    form.contact_person = '';
    emit('logAdded');
  } catch (err: any) {
    alert(err.message || 'Fehler beim Speichern');
  } finally {
    submitting.value = false;
  }
}
</script>
