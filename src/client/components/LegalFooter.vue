<template>
  <footer class="bg-white border-t border-slate-200 mt-auto py-6 px-4 text-xs text-slate-500">
    <div class="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
      <div class="space-y-1 text-center md:text-left">
        <div class="font-bold text-slate-700">abgabestellen.app</div>
        <p class="text-[11px] text-slate-400">
          Unabhängiges Open-Source-Werkzeug – kein offizielles Angebot des foodsharing e.V.
        </p>
      </div>

      <div class="flex flex-wrap items-center justify-center gap-6">
        <router-link to="/privacy" class="hover:text-amber-600 transition-colors">
          Datenschutzerklärung
        </router-link>
        <router-link to="/imprint" class="hover:text-amber-600 transition-colors">
          Impressum
        </router-link>
        <a 
          href="https://github.com/fuchstv/abgabestellen.app" 
          target="_blank" 
          rel="noopener noreferrer" 
          class="hover:text-amber-600 transition-colors flex items-center gap-1"
        >
          <span>GitHub</span> ↗
        </a>
      </div>
    </div>
  </footer>
</template>
