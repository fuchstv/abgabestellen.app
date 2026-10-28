<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
    <div class="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
      <!-- Modal Header -->
      <div class="p-4 border-b border-slate-100 flex items-center justify-between bg-amber-50/70">
        <div class="flex items-center gap-2">
          <span class="text-lg">✏️</span>
          <div>
            <h3 class="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span>Abgabestelle direkt bearbeiten</span>
              <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-600 text-white uppercase tracking-wider">
                AG-Modus
              </span>
            </h3>
            <p class="text-[11px] text-slate-500">
              Direkte atomare Aktualisierung ohne Prüfungswarteschlange (nur für autorisierte Koordination).
            </p>
          </div>
        </div>
        <button @click="$emit('close')" type="button" class="text-slate-400 hover:text-slate-600 text-lg font-bold">
          ✕
        </button>
      </div>

      <!-- Form Body -->
      <form @submit.prevent="saveDirectEdit" class="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
        <!-- 1. Stammdaten -->
        <div class="space-y-2 border-b border-slate-100 pb-3">
          <h4 class="font-bold text-slate-800 text-xs">1. Allgemeine Stammdaten (fs_betrieb)</h4>
          <div>
            <label class="block font-medium text-slate-700 mb-0.5">Name der Einrichtung *</label>
            <input v-model="form.name" required type="text" class="w-full rounded border border-slate-300 p-2 text-xs" />
          </div>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div class="md:col-span-2">
              <label class="block font-medium text-slate-700 mb-0.5">Straße & Hausnummer</label>
              <input v-model="form.str" type="text" class="w-full rounded border border-slate-300 p-2 text-xs" />
            </div>
            <div>
              <label class="block font-medium text-slate-700 mb-0.5">PLZ</label>
              <input v-model="form.plz" type="text" class="w-full rounded border border-slate-300 p-2 text-xs" />
            </div>
          </div>
          <div>
            <label class="block font-medium text-slate-700 mb-0.5">Ort / Ortsteil</label>
            <input v-model="form.stadt" type="text" class="w-full rounded border border-slate-300 p-2 text-xs" />
          </div>
        </div>

        <!-- 2. Drop-Off Details -->
        <div class="space-y-2 border-b border-slate-100 pb-3">
          <h4 class="font-bold text-slate-800 text-xs">2. Öffentliche Abgabe-Konditionen (fs_store_giving_details)</h4>
          <div>
            <label class="block font-medium text-slate-700 mb-0.5">Wann können Lebensmittel abgegeben werden?</label>
            <textarea v-model="form.giving_details.dropoff_times" rows="2" class="w-full rounded border border-slate-300 p-2 text-xs" placeholder="z.B. Mo-Fr 09:00 - 15:00 Uhr"></textarea>
          </div>
          <div>
            <label class="block font-medium text-slate-700 mb-0.5">Was wird angenommen?</label>
            <textarea v-model="form.giving_details.accepted_items" rows="2" class="w-full rounded border border-slate-300 p-2 text-xs" placeholder="z.B. Obst, Gemüse, Backwaren"></textarea>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div>
              <label class="block font-medium text-slate-700 mb-0.5">Öffentliche Telefonnummer (z.B. Festnetz 030)</label>
              <input v-model="form.giving_details.public_phone" type="text" class="w-full rounded border border-slate-300 p-2 text-xs" />
            </div>
            <div>
              <label class="block font-medium text-slate-700 mb-0.5">Webseite</label>
              <input v-model="form.giving_details.website" type="url" class="w-full rounded border border-slate-300 p-2 text-xs" />
            </div>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div>
              <label class="block font-medium text-slate-700 mb-0.5">Geschätzte Abnehmer*innen</label>
              <input v-model="form.giving_details.recipient_count" type="text" class="w-full rounded border border-slate-300 p-2 text-xs" placeholder="z.B. 50" />
            </div>
            <div class="flex items-center gap-2 pt-4">
              <input v-model="form.giving_details.registration_required" id="directRegReq" type="checkbox" class="rounded border-slate-300 text-amber-600 focus:ring-amber-500" />
              <label for="directRegReq" class="text-xs text-slate-800 font-medium cursor-pointer">
                Voranmeldung strictly erforderlich
              </label>
            </div>
          </div>
        </div>

        <!-- 3. Interne Kontaktdaten (Vertraulich) -->
        <div class="space-y-2 bg-amber-50/50 p-3 rounded-lg border border-amber-200">
          <h4 class="font-bold text-amber-900 text-xs flex items-center gap-1.5">
            <span>🔒 3. Interne Kontaktdaten (Vertraulich für AG-Mitglieder)</span>
          </h4>
          <p class="text-[11px] text-amber-700">
            Diese Kontaktdaten werden in der öffentlichen Ansicht niemals angezeigt (Zero-Leakage-Schutz).
          </p>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div>
              <label class="block font-medium text-slate-700 mb-0.5">Interner Ansprechpartner</label>
              <input v-model="form.ansprechpartner" type="text" placeholder="Frau/Herr..." class="w-full rounded border border-slate-300 p-2 text-xs bg-white" />
            </div>
            <div>
              <label class="block font-medium text-slate-700 mb-0.5">Interne Durchwahl / Mobilnummer</label>
              <input v-model="form.telefon" type="text" placeholder="017... / 030..." class="w-full rounded border border-slate-300 p-2 text-xs bg-white" />
            </div>
          </div>
        </div>

        <!-- Modal Actions -->
        <div class="pt-3 border-t border-slate-100 flex justify-end gap-2">
          <button @click="$emit('close')" type="button" class="px-3 py-1.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-50 font-medium">
            Abbrechen
          </button>
          <button type="submit" :disabled="saving" class="px-4 py-1.5 rounded bg-amber-600 hover:bg-amber-700 text-white font-semibold disabled:opacity-50">
            {{ saving ? 'Speichert...' : '✓ Änderungen direkt speichern' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue';
import { fetchApi } from '../state';

const props = defineProps<{
  isOpen: boolean;
  store: any;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'updated'): void;
}>();

const saving = ref(false);

const form = reactive({
  name: '',
  str: '',
  plz: '',
  stadt: '',
  ansprechpartner: '',
  telefon: '',
  public_info: '',
  giving_details: {
    dropoff_times: '',
    accepted_items: '',
    public_phone: '',
    website: '',
    recipient_count: '',
    registration_required: false
  }
});

watch(() => props.store, (s) => {
  if (s) {
    form.name = s.name || '';
    form.str = s.str || '';
    form.plz = s.plz || '';
    form.stadt = s.stadt || '';
    form.ansprechpartner = s.ansprechpartner || '';
    form.telefon = s.telefon || '';
    form.public_info = s.public_info || '';
    form.giving_details = {
      dropoff_times: s.giving_details?.dropoff_times || '',
      accepted_items: s.giving_details?.accepted_items || '',
      public_phone: s.giving_details?.public_phone || '',
      website: s.giving_details?.website || '',
      recipient_count: s.giving_details?.recipient_count || '',
      registration_required: s.giving_details?.registration_required === 1 || s.giving_details?.registration_required === true
    };
  }
}, { immediate: true });

async function saveDirectEdit() {
  if (!props.store?.id) return;
  saving.value = true;
  try {
    await fetchApi(`/api/giving-stores/${props.store.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name: form.name,
        str: form.str,
        plz: form.plz,
        stadt: form.stadt,
        ansprechpartner: form.ansprechpartner,
        telefon: form.telefon,
        public_info: form.public_info,
        giving_details: {
          dropoff_times: form.giving_details.dropoff_times,
          accepted_items: form.giving_details.accepted_items,
          public_phone: form.giving_details.public_phone,
          website: form.giving_details.website,
          recipient_count: form.giving_details.recipient_count,
          registration_required: form.giving_details.registration_required ? 1 : 0
        }
      })
    });

    alert('Die Abgabestelle wurde erfolgreich direkt aktualisiert!');
    emit('updated');
    emit('close');
  } catch (err: any) {
    alert(err.message || 'Fehler beim Speichern der Änderungen');
  } finally {
    saving.value = false;
  }
}
</script>
