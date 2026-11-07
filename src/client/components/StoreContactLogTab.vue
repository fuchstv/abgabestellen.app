<template>
  <div class="space-y-5">
    <!-- Confidentiality Alert (foodsharing alert-warning style) -->
    <div class="bg-fs-warning-200 border border-fs-warning-300 border-l-4 border-l-fs-warning-500 p-4 rounded-fs">
      <div class="flex items-start gap-3">
        <Lock class="w-5 h-5 text-fs-warning-700 shrink-0 mt-0.5" />
        <div>
          <h4 class="text-sm font-bold text-fs-warning-900">
            Streng vertraulicher interner Bereich (AG Abgabestellen)
          </h4>
          <p class="text-xs text-fs-warning-800 mt-0.5 leading-relaxed">
            Diese Kontaktdaten und Protokolle sind ausschließlich für autorisierte Koordinator:innen sichtbar und werden niemals öffentlich angezeigt.
          </p>
        </div>
      </div>
    </div>

    <!-- Internal Contacts Container -->
    <FsContainer title="Vertrauliche Direktkontakte" body-class="p-4 sm:p-5">
      <template #icon>
        <UserCheck class="w-4 h-4 text-fs-primary-700" />
      </template>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="bg-fs-bg border border-fs-primary-200 rounded-fs p-3.5">
          <div class="text-[11px] font-semibold text-fs-muted uppercase tracking-wide">
            Interner Ansprechpartner
          </div>
          <div class="text-sm font-bold text-fs-primary-900 mt-1">
            {{ internalStore.ansprechpartner || '— Keine interne Ansprechperson hinterlegt —' }}
          </div>
        </div>
        <div class="bg-fs-bg border border-fs-primary-200 rounded-fs p-3.5">
          <div class="text-[11px] font-semibold text-fs-muted uppercase tracking-wide">
            Interne Telefonnummer / Direktwahl
          </div>
          <div class="text-sm font-bold text-fs-primary-900 mt-1">
            <a
              v-if="internalStore.telefon"
              :href="'tel:' + internalStore.telefon"
              class="text-fs-secondary-700 hover:text-fs-secondary-800 inline-flex items-center gap-1.5 hover:underline"
            >
              <Phone class="w-3.5 h-3.5 text-fs-secondary-600" />
              <span>{{ internalStore.telefon }}</span>
            </a>
            <span v-else class="text-fs-muted font-normal">— Keine interne Durchwahl hinterlegt —</span>
          </div>
        </div>
      </div>
    </FsContainer>

    <!-- Add New Contact Verification Entry -->
    <FsContainer title="Neuen Kontaktversuch / Verifizierung erfassen" body-class="p-4 sm:p-5">
      <template #icon>
        <MessageSquarePlus class="w-4 h-4 text-fs-secondary-600" />
      </template>
      <template #actions>
        <span class="hidden sm:inline text-[11px] text-fs-primary-800">
          Aktualisiert automatisch „Zuletzt kontaktiert“
        </span>
      </template>

      <form @submit.prevent="submitLog" class="space-y-3.5">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-semibold text-fs-primary-800 mb-1">Kanal</label>
            <select v-model="form.channel" class="fs-input">
              <option value="Telefon">Telefon</option>
              <option value="E-Mail">E-Mail</option>
              <option value="Vor Ort">Vor Ort</option>
              <option value="Messenger">Messenger</option>
              <option value="Sonstiges">Sonstiges</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-semibold text-fs-primary-800 mb-1">
              Gesprochen mit (Person / Rolle)
            </label>
            <input
              v-model="form.contact_person"
              type="text"
              placeholder="z.B. Frau Schmidt (Küchenleitung)"
              class="fs-input"
            />
          </div>
        </div>

        <div>
          <label class="block text-xs font-semibold text-fs-primary-800 mb-1">
            Gesprächsnotiz / Vereinbarungen *
          </label>
          <textarea
            v-model="form.note"
            required
            rows="3"
            placeholder="z.B. Telefonisch bestätigt, dass Mo–Fr bis 14 Uhr abgegeben werden kann. Keine Kühlware am Wochenende."
            class="fs-input"
          ></textarea>
        </div>

        <div class="flex items-center gap-2 pt-0.5">
          <input
            v-model="form.confirmed_current"
            id="confirmedCurrent"
            type="checkbox"
            class="rounded border-fs-primary-300 text-[#64ae24] focus:ring-[#64ae24]"
          />
          <label for="confirmedCurrent" class="text-xs text-fs-text font-medium cursor-pointer">
            Informationen wurden als aktuell bestätigt (setzt Status auf „Aktuell“)
          </label>
        </div>

        <div class="pt-1 flex justify-end">
          <button
            type="submit"
            :disabled="submitting"
            class="fs-btn-primary"
          >
            <CheckCircle2 class="w-3.5 h-3.5" />
            <span>{{ submitting ? 'Speichert...' : 'Protokoll speichern' }}</span>
          </button>
        </div>
      </form>
    </FsContainer>

    <!-- Chronological Contact Log History -->
    <FsContainer :title="`Bisherige Kontaktprotokolle (${logs.length})`" body-class="p-4 sm:p-5">
      <template #icon>
        <History class="w-4 h-4 text-fs-primary-700" />
      </template>

      <div
        v-if="logs.length === 0"
        class="text-xs text-fs-muted italic p-5 text-center bg-fs-bg border border-fs-primary-200 rounded-fs"
      >
        Bislang liegen keine Kontaktprotokolle für diese Abgabestelle vor.
      </div>

      <div v-else class="space-y-3">
        <div
          v-for="entry in logs"
          :key="entry.id"
          class="border border-fs-primary-200 rounded-fs p-3.5 text-xs bg-fs-bg/70 space-y-2"
        >
          <div class="flex flex-wrap items-center justify-between gap-2 border-b border-fs-primary-200 pb-2">
            <div class="flex flex-wrap items-center gap-2">
              <span class="fs-badge-brown">
                {{ entry.channel }}
              </span>
              <span v-if="entry.contact_person" class="font-semibold text-fs-primary-900">
                mit {{ entry.contact_person }}
              </span>
              <span v-if="entry.confirmed_current === 1" class="fs-badge-green !text-[10px]">
                <CheckCircle2 class="w-3 h-3" />
                Als aktuell bestätigt
              </span>
            </div>
            <div class="text-fs-muted text-[11px]">
              {{ formatDate(entry.contacted_at) }} · {{ entry.author_name || 'Koordination' }}
            </div>
          </div>
          <p class="text-fs-text whitespace-pre-line leading-relaxed">
            {{ entry.note }}
          </p>
        </div>
      </div>
    </FsContainer>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import {
  Lock,
  UserCheck,
  Phone,
  MessageSquarePlus,
  CheckCircle2,
  History
} from 'lucide-vue-next';
import { InternalStore, ContactLogEntry } from '@shared/types';
import { fetchApi, notifySuccess, notifyError } from '../state';
import FsContainer from './FsContainer.vue';

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
    notifySuccess('Kontaktprotokoll wurde erfolgreich gespeichert.');
    emit('logAdded');
  } catch (err: any) {
    notifyError(err.message || 'Fehler beim Speichern des Kontaktprotokolls');
  } finally {
    submitting.value = false;
  }
}
</script>
