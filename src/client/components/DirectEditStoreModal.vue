<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-xs"
    @click.self="$emit('close')"
  >
    <div class="fs-container shadow-fs w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
      <!-- Modal Header -->
      <div class="fs-container-header">
        <div class="flex items-center gap-2.5 min-w-0">
          <Pencil class="w-4 h-4 text-fs-secondary-600 shrink-0" />
          <div class="min-w-0">
            <h3 class="font-headline text-base text-fs-primary-700 flex items-center gap-2 flex-wrap">
              <span>Abgabestelle direkt bearbeiten</span>
              <span class="font-sans fs-badge-green !text-[10px]">
                AG-Modus
              </span>
            </h3>
            <p class="text-[11px] text-fs-primary-800/80">
              Direkte atomare Aktualisierung ohne Prüfungswarteschlange (nur für autorisierte Koordination).
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
      <form @submit.prevent="saveDirectEdit" class="p-5 space-y-4 overflow-y-auto flex-1 text-xs bg-fs-surface">
        <!-- 1. Stammdaten -->
        <div class="space-y-2.5 border-b border-fs-primary-200 pb-4">
          <h4 class="font-bold text-fs-primary-900 text-xs uppercase tracking-wide">
            1. Allgemeine Stammdaten (fs_betrieb)
          </h4>
          <div>
            <label class="block font-semibold text-fs-primary-800 mb-1">Name der Einrichtung *</label>
            <input v-model="form.name" required type="text" class="fs-input" />
          </div>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            <div class="md:col-span-2">
              <label class="block font-semibold text-fs-primary-800 mb-1">Straße & Hausnummer</label>
              <input v-model="form.str" type="text" class="fs-input" />
            </div>
            <div>
              <label class="block font-semibold text-fs-primary-800 mb-1">PLZ</label>
              <input v-model="form.plz" type="text" class="fs-input" />
            </div>
          </div>
          <div>
            <label class="block font-semibold text-fs-primary-800 mb-1">Ort / Ortsteil</label>
            <input v-model="form.stadt" type="text" class="fs-input" />
          </div>
        </div>

        <!-- 2. Drop-Off Details -->
        <div class="space-y-2.5 border-b border-fs-primary-200 pb-4">
          <h4 class="font-bold text-fs-primary-900 text-xs uppercase tracking-wide">
            2. Öffentliche Abgabe-Konditionen (fs_store_giving_details)
          </h4>
          <div>
            <label class="block font-semibold text-fs-primary-800 mb-1">
              Wann können Lebensmittel abgegeben werden?
            </label>
            <textarea
              v-model="form.giving_details.dropoff_times"
              rows="2"
              class="fs-input"
              placeholder="z.B. Mo–Fr 09:00 – 15:00 Uhr"
            ></textarea>
          </div>
          <div>
            <label class="block font-semibold text-fs-primary-800 mb-1">
              Was wird angenommen?
            </label>
            <textarea
              v-model="form.giving_details.accepted_items"
              rows="2"
              class="fs-input"
              placeholder="z.B. Obst, Gemüse, Backwaren"
            ></textarea>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            <div>
              <label class="block font-semibold text-fs-primary-800 mb-1">
                Öffentliche Telefonnummer (z.B. Festnetz)
              </label>
              <input v-model="form.giving_details.public_phone" type="text" class="fs-input" />
            </div>
            <div>
              <label class="block font-semibold text-fs-primary-800 mb-1">Webseite</label>
              <input v-model="form.giving_details.website" type="url" class="fs-input" />
            </div>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            <div>
              <label class="block font-semibold text-fs-primary-800 mb-1">Geschätzte Abnehmer:innen</label>
              <input
                v-model="form.giving_details.recipient_count"
                type="text"
                class="fs-input"
                placeholder="z.B. ca. 50 Personen"
              />
            </div>
            <div class="flex items-center gap-2 pt-5">
              <input
                v-model="form.giving_details.registration_required"
                id="directRegReq"
                type="checkbox"
                class="rounded border-fs-primary-300 text-[#64ae24] focus:ring-[#64ae24]"
              />
              <label for="directRegReq" class="text-xs text-fs-text font-medium cursor-pointer">
                Telefonische Voranmeldung erforderlich
              </label>
            </div>
          </div>
        </div>

        <!-- 3. Interne Kontaktdaten (Vertraulich) -->
        <div class="space-y-2.5 bg-fs-warning-100 p-3.5 rounded-fs border border-fs-warning-300 border-l-4 border-l-fs-warning-500">
          <h4 class="font-bold text-fs-warning-900 text-xs flex items-center gap-1.5">
            <Lock class="w-3.5 h-3.5 text-fs-warning-700 shrink-0" />
            <span>3. Interne Kontaktdaten (Vertraulich für AG-Mitglieder)</span>
          </h4>
          <p class="text-[11px] text-fs-warning-800">
            Diese Kontaktdaten werden in der öffentlichen Ansicht niemals angezeigt (Zero-Leakage-Schutz).
          </p>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            <div>
              <label class="block font-semibold text-fs-primary-800 mb-1">Interner Ansprechpartner</label>
              <input
                v-model="form.ansprechpartner"
                type="text"
                placeholder="Frau/Herr..."
                class="fs-input !bg-fs-surface"
              />
            </div>
            <div>
              <label class="block font-semibold text-fs-primary-800 mb-1">Interne Durchwahl / Mobilnummer</label>
              <input
                v-model="form.telefon"
                type="text"
                placeholder="017... / 030..."
                class="fs-input !bg-fs-surface"
              />
            </div>
          </div>
        </div>

        <!-- Modal Actions -->
        <div class="pt-3 border-t border-fs-primary-200 flex justify-end gap-2">
          <button @click="$emit('close')" type="button" class="fs-btn-secondary">
            Abbrechen
          </button>
          <button type="submit" :disabled="saving" class="fs-btn-primary">
            <CheckCircle2 class="w-3.5 h-3.5" />
            <span>{{ saving ? 'Speichert...' : 'Änderungen direkt speichern' }}</span>
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue';
import { Pencil, X, Lock, CheckCircle2 } from 'lucide-vue-next';
import { fetchApi, notifySuccess, notifyError } from '../state';

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

watch(
  () => props.store,
  (s) => {
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
        registration_required:
          s.giving_details?.registration_required === 1 || s.giving_details?.registration_required === true
      };
    }
  },
  { immediate: true }
);

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

    notifySuccess('Die Abgabestelle wurde erfolgreich aktualisiert!');
    emit('updated');
    emit('close');
  } catch (err: any) {
    notifyError(err.message || 'Fehler beim Speichern der Änderungen');
  } finally {
    saving.value = false;
  }
}
</script>
