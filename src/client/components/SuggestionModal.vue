<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
    <div class="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
      <div class="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
        <div>
          <h3 class="text-base font-bold text-slate-900">
            {{ isNewStore ? 'Neue Abgabestelle vorschlagen' : 'Änderung vorschlagen' }}
          </h3>
          <p class="text-xs text-slate-500">
            {{ isNewStore ? 'Für Region: ' + regionName : targetStore?.name }}
          </p>
        </div>
        <button @click="$emit('close')" type="button" class="text-slate-400 hover:text-slate-600 text-lg font-bold">
          ✕
        </button>
      </div>

      <form @submit.prevent="submitSuggestion" class="p-4 space-y-3 overflow-y-auto flex-1 text-xs">
        <div v-if="isNewStore" class="space-y-2">
          <div>
            <label class="block font-medium text-slate-700 mb-0.5">Name der Einrichtung *</label>
            <input v-model="form.name" required type="text" placeholder="z.B. Suppenküche Sonnenschein" class="w-full rounded border border-slate-300 p-2" />
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block font-medium text-slate-700 mb-0.5">Straße & Hausnummer</label>
              <input v-model="form.street" type="text" placeholder="Musterstr. 10" class="w-full rounded border border-slate-300 p-2" />
            </div>
            <div>
              <label class="block font-medium text-slate-700 mb-0.5">PLZ & Ort</label>
              <input v-model="form.postalCode" type="text" placeholder="10115 Berlin" class="w-full rounded border border-slate-300 p-2" />
            </div>
          </div>
        </div>

        <div>
          <label class="block font-medium text-slate-700 mb-0.5">Wann können Lebensmittel abgegeben werden?</label>
          <textarea v-model="form.dropoffTimes" rows="2" placeholder="z.B. Mo-Fr 09:00 - 15:00 Uhr" class="w-full rounded border border-slate-300 p-2"></textarea>
        </div>

        <div>
          <label class="block font-medium text-slate-700 mb-0.5">Was wird angenommen?</label>
          <textarea v-model="form.acceptedItems" rows="2" placeholder="z.B. Obst, Gemüse, Backwaren, ungekühlte Lebensmittel" class="w-full rounded border border-slate-300 p-2"></textarea>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block font-medium text-slate-700 mb-0.5">Öffentliche Telefonnummer</label>
            <input v-model="form.publicPhone" type="text" placeholder="030 123456" class="w-full rounded border border-slate-300 p-2" />
          </div>
          <div>
            <label class="block font-medium text-slate-700 mb-0.5">Webseite</label>
            <input v-model="form.website" type="url" placeholder="https://..." class="w-full rounded border border-slate-300 p-2" />
          </div>
        </div>

        <div class="flex items-center gap-2 pt-1">
          <input v-model="form.registrationRequired" id="suggRegReq" type="checkbox" class="rounded border-slate-300 text-amber-600 focus:ring-amber-500" />
          <label for="suggRegReq" class="text-xs text-slate-800 font-medium cursor-pointer">
            Voranmeldung strictly erforderlich
          </label>
        </div>

        <div>
          <label class="block font-medium text-slate-700 mb-0.5">Quelle / Notiz für das Prüfungsteam</label>
          <textarea v-model="authorNote" rows="2" placeholder="z.B. Stand: Oktober 2026 persönlich vor Ort erfragt" class="w-full rounded border border-slate-300 p-2"></textarea>
        </div>

        <div class="pt-3 border-t border-slate-100 flex justify-end gap-2">
          <button @click="$emit('close')" type="button" class="px-3 py-1.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-50">
            Abbrechen
          </button>
          <button type="submit" :disabled="submitting" class="px-4 py-1.5 rounded bg-amber-600 hover:bg-amber-700 text-white font-medium disabled:opacity-50">
            {{ submitting ? 'Wird gesendet...' : 'Vorschlag einreichen' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue';
import { PublicStore, GivingStoreSuggestionPayload } from '@shared/types';
import { fetchApi, authState } from '../state';

const props = defineProps<{
  isOpen: boolean;
  isNewStore?: boolean;
  regionId?: number;
  regionName?: string;
  targetStore?: PublicStore | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'submitted'): void;
}>();

const submitting = ref(false);
const authorNote = ref('');
const form = reactive<GivingStoreSuggestionPayload>({
  name: '',
  street: '',
  postalCode: '',
  dropoffTimes: '',
  acceptedItems: '',
  publicPhone: '',
  website: '',
  registrationRequired: false
});

watch(() => props.targetStore, (store) => {
  if (store) {
    form.name = store.name;
    form.street = store.str;
    form.postalCode = store.plz;
    form.dropoffTimes = store.giving_details.dropoff_times || '';
    form.acceptedItems = store.giving_details.accepted_items || '';
    form.publicPhone = store.giving_details.public_phone || '';
    form.website = store.giving_details.website || '';
    form.registrationRequired = store.giving_details.registration_required === 1;
  }
}, { immediate: true });

async function submitSuggestion() {
  if (!authState.token) {
    // Quick login helper or prompt
    const email = prompt('Bitte gib deine E-Mail-Adresse für die Einreichung an:');
    if (!email) return;
    authState.token = `test:anonymous_${Date.now()}:${email}:false`;
  }

  submitting.value = true;
  try {
    let res: any;
    if (props.isNewStore) {
      res = await fetchApi(`/api/regions/${props.regionId}/suggestions`, {
        method: 'POST',
        body: JSON.stringify({
          payload: form,
          author_note: authorNote.value
        })
      });
    } else {
      res = await fetchApi(`/api/giving-stores/${props.targetStore!.id}/suggestions`, {
        method: 'POST',
        body: JSON.stringify({
          payload: form,
          author_note: authorNote.value
        })
      });
    }

    alert(res?.message || 'Vielen Dank! Dein Vorschlag wurde gespeichert und liegt nun im Prüf-Eingang der AG Abgabestellen.');
    emit('submitted');
    emit('close');
  } catch (err: any) {
    alert(err.message || 'Fehler beim Einreichen');
  } finally {
    submitting.value = false;
  }
}
</script>
