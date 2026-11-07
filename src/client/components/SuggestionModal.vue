<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-xs"
    @click.self="$emit('close')"
  >
    <div class="fs-container shadow-fs w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
      <!-- Warm foodsharing Modal Header -->
      <div class="fs-container-header">
        <div class="flex items-center gap-2 min-w-0">
          <HandHeart v-if="isNewStore" class="w-4 h-4 text-fs-secondary-600 shrink-0" />
          <MessageSquarePlus v-else class="w-4 h-4 text-fs-secondary-600 shrink-0" />
          <div class="min-w-0">
            <h3 class="font-headline text-base text-fs-primary-700 leading-tight truncate">
              {{ isNewStore ? 'Neue Abgabestelle vorschlagen' : 'Änderung vorschlagen' }}
            </h3>
            <p class="text-[11px] text-fs-primary-800/80 truncate">
              {{ isNewStore ? 'Für Region: ' + regionName : targetStore?.name }}
            </p>
          </div>
        </div>
        <button
          @click="$emit('close')"
          type="button"
          class="p-1 rounded-fs text-fs-primary-700 hover:text-fs-danger-600 hover:bg-fs-primary-300/60 transition-colors cursor-pointer"
          aria-label="Schließen"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Form Body -->
      <form @submit.prevent="submitSuggestion" class="p-5 space-y-3.5 overflow-y-auto flex-1 text-xs bg-fs-surface">
        <!-- Submitter Email when not logged in (replaces browser window.prompt) -->
        <div
          v-if="!authState.token"
          class="bg-fs-secondary-100 border border-fs-secondary-300 rounded-fs p-3 space-y-1.5"
        >
          <label class="block font-semibold text-fs-secondary-900">
            Deine E-Mail-Adresse für Rückfragen *
          </label>
          <input
            v-model="submitterEmail"
            required
            type="email"
            placeholder="dein.name@foodsharing.network"
            class="fs-input !bg-fs-surface"
          />
          <p class="text-[11px] text-fs-muted">
            Wird ausschließlich intern für das Prüfteam gespeichert und niemals öffentlich angezeigt.
          </p>
        </div>

        <div v-if="isNewStore" class="space-y-3">
          <div>
            <label class="block font-semibold text-fs-primary-800 mb-1">Name der Einrichtung *</label>
            <input
              v-model="form.name"
              required
              type="text"
              placeholder="z.B. Suppenküche Sonnenschein"
              class="fs-input"
            />
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label class="block font-semibold text-fs-primary-800 mb-1">Straße & Hausnummer</label>
              <input
                v-model="form.street"
                type="text"
                placeholder="Musterstr. 10"
                class="fs-input"
              />
            </div>
            <div>
              <label class="block font-semibold text-fs-primary-800 mb-1">PLZ & Ort</label>
              <input
                v-model="form.postalCode"
                type="text"
                placeholder="10115 Berlin"
                class="fs-input"
              />
            </div>
          </div>
        </div>

        <div>
          <label class="block font-semibold text-fs-primary-800 mb-1">
            Wann können Lebensmittel abgegeben werden?
          </label>
          <textarea
            v-model="form.dropoffTimes"
            rows="2"
            placeholder="z.B. Mo–Fr 09:00 – 15:00 Uhr"
            class="fs-input"
          ></textarea>
        </div>

        <div>
          <label class="block font-semibold text-fs-primary-800 mb-1">
            Was wird angenommen?
          </label>
          <textarea
            v-model="form.acceptedItems"
            rows="2"
            placeholder="z.B. Obst, Gemüse, Backwaren, ungekühlte Lebensmittel"
            class="fs-input"
          ></textarea>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div>
            <label class="block font-semibold text-fs-primary-800 mb-1">Öffentliche Telefonnummer</label>
            <input
              v-model="form.publicPhone"
              type="text"
              placeholder="030 123456"
              class="fs-input"
            />
          </div>
          <div>
            <label class="block font-semibold text-fs-primary-800 mb-1">Webseite</label>
            <input
              v-model="form.website"
              type="url"
              placeholder="https://..."
              class="fs-input"
            />
          </div>
        </div>

        <div class="flex items-center gap-2 pt-0.5">
          <input
            v-model="form.registrationRequired"
            id="suggRegReq"
            type="checkbox"
            class="rounded border-fs-primary-300 text-[#64ae24] focus:ring-[#64ae24]"
          />
          <label for="suggRegReq" class="text-xs text-fs-text font-medium cursor-pointer">
            Telefonische Voranmeldung erforderlich
          </label>
        </div>

        <div>
          <label class="block font-semibold text-fs-primary-800 mb-1">
            Quelle / Notiz für das Prüfungsteam
          </label>
          <textarea
            v-model="authorNote"
            rows="2"
            placeholder="z.B. Persönlich vor Ort erfragt"
            class="fs-input"
          ></textarea>
        </div>

        <div class="pt-3 border-t border-fs-primary-200 flex justify-end gap-2">
          <button
            @click="$emit('close')"
            type="button"
            class="fs-btn-secondary"
          >
            Abbrechen
          </button>
          <button
            type="submit"
            :disabled="submitting"
            class="fs-btn-primary"
          >
            <Send class="w-3.5 h-3.5" />
            <span>{{ submitting ? 'Wird gesendet...' : 'Vorschlag einreichen' }}</span>
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue';
import { HandHeart, MessageSquarePlus, X, Send } from 'lucide-vue-next';
import { PublicStore, GivingStoreSuggestionPayload } from '@shared/types';
import { fetchApi, authState, notifySuccess, notifyError } from '../state';

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
const submitterEmail = ref('');
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

watch(
  () => [props.targetStore, props.isNewStore, props.isOpen] as const,
  ([store, isNew]) => {
    if (isNew) {
      form.name = '';
      form.street = '';
      form.postalCode = '';
      form.dropoffTimes = '';
      form.acceptedItems = '';
      form.publicPhone = '';
      form.website = '';
      form.registrationRequired = false;
      authorNote.value = '';
    } else if (store) {
      form.name = store.name;
      form.street = store.str;
      form.postalCode = store.plz;
      form.dropoffTimes = store.giving_details.dropoff_times || '';
      form.acceptedItems = store.giving_details.accepted_items || '';
      form.publicPhone = store.giving_details.public_phone || '';
      form.website = store.giving_details.website || '';
      form.registrationRequired = store.giving_details.registration_required === 1;
    }
  },
  { immediate: true }
);

async function submitSuggestion() {
  let cleanEmail = '';
  if (!authState.token) {
    cleanEmail = submitterEmail.value.trim();
    if (!cleanEmail) {
      notifyError('Bitte gib deine E-Mail-Adresse für eventuelle Rückfragen an.');
      return;
    }
  }

  submitting.value = true;
  try {
    const bodyObj: Record<string, any> = {
      payload: form,
      author_note: authorNote.value
    };
    if (cleanEmail) {
      bodyObj.author_email = cleanEmail;
    }

    let res: any;
    if (props.isNewStore) {
      res = await fetchApi(`/api/regions/${props.regionId}/suggestions`, {
        method: 'POST',
        body: JSON.stringify(bodyObj)
      });
    } else {
      res = await fetchApi(`/api/giving-stores/${props.targetStore!.id}/suggestions`, {
        method: 'POST',
        body: JSON.stringify(bodyObj)
      });
    }

    notifySuccess(
      res?.message || 'Vielen Dank! Dein Vorschlag liegt nun im Prüf-Eingang der AG Abgabestellen.'
    );
    emit('submitted');
    emit('close');
  } catch (err: any) {
    notifyError(err.message || 'Fehler beim Einreichen des Vorschlags');
  } finally {
    submitting.value = false;
  }
}
</script>
