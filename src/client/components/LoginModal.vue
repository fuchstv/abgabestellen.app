<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
    <div class="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
      <!-- Modal Header -->
      <div class="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
        <div class="flex items-center gap-2.5">
          <div class="w-9 h-9 rounded-xl bg-amber-600/10 text-amber-600 flex items-center justify-center font-bold text-lg">
            🔐
          </div>
          <div>
            <h3 class="text-base font-bold text-slate-900">Interner Bereich</h3>
            <p class="text-xs text-slate-500">Für Bezirkskoordinator:innen & ORGA</p>
          </div>
        </div>
        <button 
          @click="$emit('close')" 
          type="button"
          class="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200/50 transition-colors cursor-pointer"
        >
          ✕
        </button>
      </div>

      <!-- Mode Tabs -->
      <div class="flex border-b border-slate-100 px-5 pt-3 gap-4 text-xs font-semibold">
        <button 
          type="button"
          @click="mode = 'password'"
          :class="['pb-2.5 border-b-2 transition-colors cursor-pointer', mode === 'password' ? 'border-amber-600 text-amber-600 font-bold' : 'border-transparent text-slate-500 hover:text-slate-800']"
        >
          Mit Passwort
        </button>
        <button 
          type="button"
          @click="mode = 'secret'"
          :class="['pb-2.5 border-b-2 transition-colors cursor-pointer', mode === 'secret' ? 'border-amber-600 text-amber-600 font-bold' : 'border-transparent text-slate-500 hover:text-slate-800']"
        >
          Einladungscode / ORGA-Secret
        </button>
      </div>

      <!-- Form Body -->
      <form @submit.prevent="handleLogin" class="p-5 space-y-4 text-xs">
        <div v-if="errorMessage" class="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 font-medium">
          {{ errorMessage }}
        </div>

        <div v-if="successMessage" class="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 font-medium">
          {{ successMessage }}
        </div>

        <div>
          <label class="block font-semibold text-slate-700 mb-1">E-Mail-Adresse</label>
          <input 
            v-model="email" 
            type="email" 
            required 
            placeholder="dein.name@foodsharing.network" 
            class="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
          />
        </div>

        <!-- Mode: Password -->
        <div v-if="mode === 'password'">
          <label class="block font-semibold text-slate-700 mb-1">Passwort</label>
          <input 
            v-model="password" 
            type="password" 
            required 
            placeholder="••••••••••••" 
            class="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
          />
        </div>

        <!-- Mode: Secret / Invite -->
        <div v-if="mode === 'secret'" class="space-y-3">
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Einladungscode oder ORGA-Initial-Secret</label>
            <input 
              v-model="inviteOrSecret" 
              type="text" 
              required 
              placeholder="z. B. Initial-Secret oder Einladungstoken" 
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
            />
          </div>

          <div>
            <label class="block font-semibold text-slate-700 mb-1">
              Neues Passwort vergeben <span class="font-normal text-slate-400">(optional für zukünftige Logins)</span>
            </label>
            <input 
              v-model="newPassword" 
              type="password" 
              placeholder="••••••••••••" 
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
            />
          </div>
        </div>

        <div class="pt-2 flex items-center justify-end gap-2">
          <button 
            type="button" 
            @click="$emit('close')" 
            class="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium transition-colors cursor-pointer"
          >
            Abbrechen
          </button>
          <button 
            type="submit" 
            :disabled="loading" 
            class="px-5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold transition-all disabled:opacity-50 cursor-pointer shadow-sm"
          >
            {{ loading ? 'Anmelden...' : 'Anmelden' }}
          </button>
        </div>

        <p class="text-[11px] text-slate-400 text-center pt-2 border-t border-slate-100">
          💡 Besucher:innen benötigen kein Konto, um Abgabestellen einzusehen oder Vorschläge einzureichen.
        </p>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { setAuthUser } from '../state';

const props = defineProps<{
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
      if (cleanInput.includes('token=')) {
        const m = cleanInput.match(/token=([a-fA-F0-9]+)/);
        if (m) cleanInput = m[1];
      } else if (cleanInput.includes('/invite/')) {
        const m = cleanInput.match(/\/invite\/([a-fA-F0-9]+)/);
        if (m) cleanInput = m[1];
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
