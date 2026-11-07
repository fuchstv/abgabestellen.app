<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-xs"
    @click.self="$emit('close')"
  >
    <div class="fs-container shadow-fs max-w-md w-full overflow-hidden">
      <!-- Modal Header -->
      <div class="fs-container-header">
        <div class="flex items-center gap-2.5">
          <span class="w-8 h-8 rounded-full bg-[#64ae24] text-white flex items-center justify-center shrink-0">
            <KeyRound class="w-4 h-4" />
          </span>
          <div>
            <h3 class="font-headline text-base text-fs-primary-700 leading-tight">
              Interner Bereich
            </h3>
            <p class="text-[11px] text-fs-primary-800/80">
              Für Bezirkskoordinator:innen & ORGA
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

      <!-- Mode Tabs -->
      <div class="flex border-b border-fs-primary-200 bg-fs-elevated px-5 pt-2.5 gap-4 text-xs font-semibold">
        <button
          type="button"
          @click="mode = 'password'"
          :class="[
            'pb-2 border-b-2 transition-colors cursor-pointer',
            mode === 'password'
              ? 'border-[#64ae24] text-fs-secondary-700 font-bold'
              : 'border-transparent text-fs-muted hover:text-fs-primary-800'
          ]"
        >
          Mit Passwort
        </button>
        <button
          type="button"
          @click="mode = 'secret'"
          :class="[
            'pb-2 border-b-2 transition-colors cursor-pointer',
            mode === 'secret'
              ? 'border-[#64ae24] text-fs-secondary-700 font-bold'
              : 'border-transparent text-fs-muted hover:text-fs-primary-800'
          ]"
        >
          Einladungscode / ORGA-Secret
        </button>
      </div>

      <!-- Form Body -->
      <form @submit.prevent="handleLogin" class="p-5 space-y-4 text-xs bg-fs-surface">
        <div
          v-if="errorMessage"
          class="p-3 rounded-fs bg-fs-danger-100 border border-fs-danger-300 border-l-4 border-l-fs-danger-500 text-fs-danger-900 font-medium flex items-start gap-2"
        >
          <AlertTriangle class="w-4 h-4 text-fs-danger-600 shrink-0 mt-0.5" />
          <span>{{ errorMessage }}</span>
        </div>

        <div
          v-if="successMessage"
          class="p-3 rounded-fs bg-fs-secondary-100 border border-fs-secondary-300 border-l-4 border-l-fs-secondary-500 text-fs-secondary-900 font-medium flex items-start gap-2"
        >
          <CheckCircle2 class="w-4 h-4 text-fs-secondary-600 shrink-0 mt-0.5" />
          <span>{{ successMessage }}</span>
        </div>

        <div>
          <label class="block font-semibold text-fs-primary-800 mb-1">E-Mail-Adresse</label>
          <input
            v-model="email"
            type="email"
            required
            placeholder="dein.name@foodsharing.network"
            class="fs-input"
          />
        </div>

        <!-- Mode: Password -->
        <div v-if="mode === 'password'">
          <label class="block font-semibold text-fs-primary-800 mb-1">Passwort</label>
          <input
            v-model="password"
            type="password"
            required
            placeholder="••••••••••••"
            class="fs-input"
          />
        </div>

        <!-- Mode: Secret / Invite -->
        <div v-if="mode === 'secret'" class="space-y-3">
          <div>
            <label class="block font-semibold text-fs-primary-800 mb-1">
              Einladungscode oder ORGA-Initial-Secret
            </label>
            <input
              v-model="inviteOrSecret"
              type="text"
              required
              placeholder="Einladungslink, Token oder ORGA-Secret"
              class="fs-input font-mono"
            />
          </div>

          <div>
            <label class="block font-semibold text-fs-primary-800 mb-1">
              Neues Passwort vergeben <span class="font-normal text-fs-muted">(optional für zukünftige Logins)</span>
            </label>
            <input
              v-model="newPassword"
              type="password"
              placeholder="••••••••••••"
              class="fs-input"
            />
          </div>
        </div>

        <div class="pt-2 flex items-center justify-end gap-2">
          <button
            type="button"
            @click="$emit('close')"
            class="fs-btn-secondary"
          >
            Abbrechen
          </button>
          <button
            type="submit"
            :disabled="loading"
            class="fs-btn-primary"
          >
            <LogIn class="w-3.5 h-3.5" />
            <span>{{ loading ? 'Anmelden...' : 'Anmelden' }}</span>
          </button>
        </div>

        <p class="text-[11px] text-fs-muted text-center pt-2.5 border-t border-fs-primary-200 flex items-center justify-center gap-1.5">
          <Info class="w-3.5 h-3.5 text-fs-secondary-600 shrink-0" />
          <span>Besucher:innen benötigen kein Konto, um Abgabestellen zu finden oder vorzuschlagen.</span>
        </p>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { KeyRound, X, AlertTriangle, CheckCircle2, LogIn, Info } from 'lucide-vue-next';
import { setAuthUser } from '../state';

defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'loggedIn'): void;
}>();

const mode = ref<'password' | 'secret'>('password');
const email = ref('');
const password = ref('');
const inviteOrSecret = ref('');
const newPassword = ref('');
const loading = ref(false);
const errorMessage = ref('');
const successMessage = ref('');

async function handleLogin() {
  loading.value = true;
  errorMessage.value = '';
  successMessage.value = '';

  try {
    const payload: any = { email: email.value };
    if (mode.value === 'password') {
      payload.password = password.value;
    } else {
      let cleanInput = inviteOrSecret.value.trim();
      const tokenMatch = cleanInput.match(/(?:token=|\/invite\/)([a-fA-F0-9]+)/);
      if (tokenMatch) {
        cleanInput = tokenMatch[1];
      }
      payload.inviteOrSecret = cleanInput;
      if (newPassword.value) {
        payload.password = newPassword.value;
      }
    }

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Anmeldung fehlgeschlagen');
    }

    setAuthUser(data.user, data.token);
    successMessage.value = data.message || 'Erfolgreich angemeldet!';

    setTimeout(() => {
      emit('loggedIn');
      emit('close');
      window.location.reload();
    }, 400);
  } catch (err: any) {
    errorMessage.value = err.message || 'Verbindungsfehler beim Anmelden';
  } finally {
    loading.value = false;
  }
}
</script>
