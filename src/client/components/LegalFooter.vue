<template>
  <footer class="bg-white border-t border-slate-200 py-2 px-4 text-xs text-slate-500 shrink-0 z-20">
    <div class="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
      <div class="flex items-center gap-2">
        <span class="font-bold text-slate-700">abgabestellen.app</span>
        <span class="hidden md:inline text-[11px] text-slate-400">
          — Unabhängiges Open-Source-Werkzeug
        </span>
      </div>

      <div class="flex items-center gap-4 text-[11px]">
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
