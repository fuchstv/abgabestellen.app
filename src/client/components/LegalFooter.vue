<template>
  <!-- Compact single-bar footer for full-height MapView -->
  <footer
    v-if="compact"
    class="bg-fs-elevated border-t border-fs-primary-200 py-1.5 px-4 text-xs text-fs-muted shrink-0 z-20"
  >
    <div class="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-2">
      <div class="flex items-center gap-2 min-w-0">
        <span class="font-headline text-xs text-fs-primary-500">
          abgabe<span class="text-fs-secondary-500">stellen</span><span class="font-sans font-semibold text-[10px] text-fs-muted">.app</span>
        </span>
        <span class="hidden md:inline text-[11px] text-fs-muted truncate">
          — Unabhängiges Open-Source-Werkzeug (kein offizielles Angebot des foodsharing e.V.)
        </span>
      </div>

      <div class="flex items-center gap-3.5 text-[11px] font-medium">
        <span class="hidden sm:inline-flex items-center gap-1 text-fs-muted">
          Mit <Heart class="w-3 h-3 text-[#cf3a00] fill-[#cf3a00] inline" /> entwickelt
        </span>
        <router-link to="/privacy" class="hover:text-fs-secondary-600 transition-colors">
          Datenschutz
        </router-link>
        <router-link to="/imprint" class="hover:text-fs-secondary-600 transition-colors">
          Impressum
        </router-link>
        <a
          href="https://github.com/fuchstv/abgabestellen.app"
          target="_blank"
          rel="noopener noreferrer"
          class="hover:text-fs-secondary-600 transition-colors inline-flex items-center gap-1"
        >
          <ExternalLink class="w-3 h-3" />
          <span>GitHub</span>
        </a>
      </div>
    </div>
  </footer>

  <!-- Full Community Footer for Subpages (analog foodsharing Footer.vue) -->
  <footer
    v-else
    class="bg-fs-surface border-t border-fs-primary-200 mt-10 shrink-0 text-fs-text"
  >
    <div class="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <!-- Column 1: Mission & Independence -->
        <div class="space-y-2">
          <div class="flex items-center gap-2">
            <span class="w-7 h-7 rounded-full bg-[#64ae24] text-white flex items-center justify-center">
              <HandHeart class="w-3.5 h-3.5" />
            </span>
            <span class="font-headline text-base text-fs-primary-500">
              abgabe<span class="text-fs-secondary-500">stellen</span>.app
            </span>
          </div>
          <p class="text-xs text-fs-muted leading-relaxed">
            Freies Verzeichnis für Lebensmittel-Abgabestellen, Suppenküchen, Notübernachtungen und soziale Einrichtungen.
          </p>
          <p class="text-[11px] text-fs-primary-700 bg-fs-primary-100 border border-fs-primary-200 rounded-fs px-2.5 py-1.5 leading-snug">
            Unabhängiges ehrenamtliches Open-Source-Werkzeug – kein offizielles Angebot des foodsharing e.V.
          </p>
        </div>

        <!-- Column 2: Navigation -->
        <div class="space-y-2">
          <h3 class="font-headline text-sm text-fs-primary-500">Plattform</h3>
          <ul class="space-y-1.5 text-xs text-fs-muted">
            <li>
              <router-link to="/" class="hover:text-fs-secondary-600 transition-colors inline-flex items-center gap-1.5">
                <MapPin class="w-3.5 h-3.5 text-fs-secondary-500" />
                <span>Interaktive Karte & Suche</span>
              </router-link>
            </li>
            <li>
              <a
                href="/api/docs"
                target="_blank"
                rel="noopener noreferrer"
                class="hover:text-fs-secondary-600 transition-colors inline-flex items-center gap-1.5"
              >
                <Code2 class="w-3.5 h-3.5 text-fs-secondary-500" />
                <span>OpenAPI 3.1 Schnittstelle</span>
              </a>
            </li>
            <li>
              <a
                href="https://github.com/fuchstv/abgabestellen.app"
                target="_blank"
                rel="noopener noreferrer"
                class="hover:text-fs-secondary-600 transition-colors inline-flex items-center gap-1.5"
              >
                <ExternalLink class="w-3.5 h-3.5 text-fs-secondary-500" />
                <span>Quellcode auf GitHub (MIT)</span>
              </a>
            </li>
          </ul>
        </div>

        <!-- Column 3: Legal & Community -->
        <div class="space-y-2">
          <h3 class="font-headline text-sm text-fs-primary-500">Rechtliches & Datenschutz</h3>
          <ul class="space-y-1.5 text-xs text-fs-muted">
            <li>
              <router-link to="/imprint" class="hover:text-fs-secondary-600 transition-colors">
                Impressum (§ 5 DDG)
              </router-link>
            </li>
            <li>
              <router-link to="/privacy" class="hover:text-fs-secondary-600 transition-colors">
                Datenschutzerklärung (DSGVO / Zero-PII)
              </router-link>
            </li>
          </ul>
        </div>
      </div>

      <div class="border-t border-fs-primary-200 pt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-fs-muted">
        <span>
          Mit <Heart class="w-3.5 h-3.5 text-[#cf3a00] fill-[#cf3a00] inline mx-0.5" /> von Ehrenamtlichen für Lebensmittelretter:innen entwickelt
        </span>
        <span class="text-[11px]">
          1:1 datenmodellkompatibel mit foodsharing-dev
        </span>
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { Heart, ExternalLink, HandHeart, MapPin, Code2 } from 'lucide-vue-next';

withDefaults(
  defineProps<{
    compact?: boolean;
  }>(),
  {
    compact: false
  }
);
</script>
