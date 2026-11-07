<template>
  <div class="max-w-3xl mx-auto px-4 py-8 sm:py-10 flex-1 w-full">
    <FsContainer title="Angaben gemäß § 5 Digitale-Dienste-Gesetz (DDG)" body-class="p-6 sm:p-8 space-y-6">
      <template #icon>
        <Scale class="w-4 h-4 text-fs-primary-700" />
      </template>

      <div class="border-b border-fs-primary-200 pb-4">
        <h1 class="font-headline text-2xl sm:text-3xl text-fs-primary-600">
          Impressum (§ 5 DDG)
        </h1>
      </div>

      <!-- Prominent foodsharing e.V. disclaimer banner -->
      <div class="bg-fs-primary-100 border border-fs-primary-300 border-l-4 border-l-fs-primary-500 p-4 rounded-fs space-y-1">
        <h3 class="font-sans text-sm font-bold text-fs-primary-900 flex items-center gap-1.5">
          <Info class="w-4 h-4 text-fs-primary-600 shrink-0" />
          <span>Rechtlicher Hinweis / Abgrenzung</span>
        </h3>
        <p class="text-xs text-fs-text leading-relaxed">
          <strong>abgabestellen.app</strong> ist ein unabhängiges, ehrenamtliches Open-Source-Gemeinschaftsprojekt.
          Dieses Portal ist <em>kein offizielles Angebot des foodsharing e.V.</em> oder verbundener Organisationen.
          Die Daten werden von engagierten Ehrenamtlichen gepflegt und synchronisiert, um die Sichtbarkeit und Koordination
          von Lebensmittelausgabestellen zu verbessern.
        </p>
      </div>

      <div class="space-y-4 text-xs leading-relaxed text-fs-text">
        <h2 class="font-headline text-lg text-fs-primary-600 pt-2">Diensteanbieter</h2>
        <p>
          <strong>Philipp Fuchs</strong><br>
          Chopinstr. 6<br>
          13088 Berlin<br>
          Deutschland<br><br>
          E-Mail:
          <a href="mailto:info@abgabestellen.app" class="text-fs-secondary-700 font-semibold underline hover:text-fs-secondary-800">
            info@abgabestellen.app
          </a><br>
          Open-Source Repository:
          <a
            href="https://github.com/fuchstv/abgabestellen.app"
            target="_blank"
            rel="noopener noreferrer"
            class="text-fs-secondary-700 font-semibold underline hover:text-fs-secondary-800"
          >
            github.com/fuchstv/abgabestellen.app
          </a>
        </p>

        <h2 class="font-headline text-lg text-fs-primary-600 pt-2">Haftung für Inhalte</h2>
        <p>
          Als Diensteanbieter sind wir gemäß § 7 Abs. 1 DDG für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich.
          Nach §§ 8 bis 10 DDG sind wir als Diensteanbieter jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde Informationen
          (insbesondere Community-Einreichungen zu Öffnungszeiten oder Annahmebedingungen Dritter) zu überwachen oder nach Umständen zu forschen,
          die auf eine rechtswidrige Tätigkeit hinweisen. Verpflichtungen zur Entfernung von Informationen nach den allgemeinen Gesetzen bleiben hiervon unberührt.
        </p>
      </div>
    </FsContainer>
  </div>
</template>

<script setup lang="ts">
import { Scale, Info } from 'lucide-vue-next';
import FsContainer from '../components/FsContainer.vue';
</script>
