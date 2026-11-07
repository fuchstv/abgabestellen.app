<template>
  <div class="max-w-3xl mx-auto px-4 py-8 sm:py-10 flex-1 w-full">
    <FsContainer title="Stand: Oktober 2026 — abgabestellen.app" body-class="p-6 sm:p-8 space-y-6">
      <template #icon>
        <ShieldCheck class="w-4 h-4 text-fs-secondary-600" />
      </template>

      <div class="border-b border-fs-primary-200 pb-4">
        <h1 class="font-headline text-2xl sm:text-3xl text-fs-primary-600">
          Datenschutzerklärung (DSGVO)
        </h1>
      </div>

      <!-- Explicit e.V. Transfer Clause -->
      <div class="bg-fs-warning-100 border border-fs-warning-300 border-l-4 border-l-fs-warning-500 p-4 rounded-fs space-y-2">
        <h3 class="font-sans text-sm font-bold text-fs-warning-900">
          Besondere Klausel: Zukünftige Übernahme durch einen gemeinnützigen Träger (e.V.)
        </h3>
        <p class="text-xs text-fs-warning-800 leading-relaxed">
          Die Plattform <code>abgabestellen.app</code> wird derzeit als unabhängiges Open-Source-Projekt betrieben.
          Die Nutzerinnen und Nutzer werden hiermit darüber informiert und willigen ausdrücklich ein, dass sämtliche
          im Rahmen dieser Anwendung erhobenen Daten (einschließlich Nutzerrollen, Kontaktprotokolle und Einreichungen)
          bei einer zukünftigen Vereinsgründung oder Übernahme durch einen rechtsfähigen, gemeinnützigen Trägerverein
          (z.&nbsp;B. einen foodsharing e.V. oder einen Trägerverein für Lebensmittelrettung) als Gesamtrechtsnachfolge
          bzw. zur Fortführung des Betriebs ohne erneutes gesondertes Einverständnis übertragen werden können, sofern
          der Verarbeitungszweck (Förderung der Lebensmittelweitergabe und Transparenz von Abgabestellen) unverändert bleibt
          (Art. 6 Abs. 1 lit. f DSGVO / berechtigtes Interesse an der Kontinuität des Betriebs).
        </p>
      </div>

      <div class="space-y-4 text-xs leading-relaxed text-fs-text">
        <h2 class="font-headline text-lg text-fs-primary-600 pt-2">1. Verantwortliche Stelle</h2>
        <p>
          <strong>Philipp Fuchs</strong><br>
          Chopinstr. 6<br>
          13088 Berlin<br>
          E-Mail:
          <a href="mailto:datenschutz@abgabestellen.app" class="text-fs-secondary-700 font-semibold underline hover:text-fs-secondary-800">
            datenschutz@abgabestellen.app
          </a>
        </p>

        <h2 class="font-headline text-lg text-fs-primary-600 pt-2">2. Technische Infrastruktur & Auftragsverarbeitung</h2>
        <p>
          Zur Bereitstellung dieses Webangebots setzen wir auf datensparsame, moderne Cloud-Infrastrukturen mit Rechenzentren innerhalb der Europäischen Union:
        </p>
        <ul class="list-disc pl-5 space-y-1.5">
          <li>
            <strong>Hosting & Datenbank (Google Cloud Run):</strong> Bereitstellung des Webservers und der Datenbank erfolgt über Google Cloud Platform in der Region Frankfurt am Main (<code>europe-west3</code>). Es werden standardmäßig flüchtige Server-Logs (IP-Adresse, Zeitstempel, aufgerufene URL) verarbeitet, um den sicheren Betrieb zu gewährleisten (Art. 6 Abs. 1 lit. f DSGVO).
          </li>
          <li>
            <strong>Kartenanzeige & Adresssuche (Google Maps Platform):</strong> Für interaktive Karten und Adressvervollständigung wird die Google Maps JavaScript API eingebunden. Beim Aufruf der Kartenansicht baut Ihr Browser eine direkte Verbindung zu den Servern von Google auf. Rechtsgrundlage ist unser berechtigtes Interesse an einer nutzerfreundlichen Navigation zu Abgabestellen (Art. 6 Abs. 1 lit. f DSGVO).
          </li>
          <li>
            <strong>Lokale Schriftarten (Zero-CDN Fonts):</strong> Alle verwendeten Webschriften (<em>Alfa Slab One</em> und <em>Poppins</em>) werden direkt von unserem eigenen Server ausgeliefert – es findet keinerlei Verbindung zu externen Schrift-CDNs wie Google Fonts statt.
          </li>
          <li>
            <strong>E-Mail-Zustellung (AWS Lightsail EU / Stalwart Mail Server):</strong> Systembenachrichtigungen und regionale Update-Abonnements werden über einen von uns selbst administrierten Stalwart Mail Server auf einer virtuellen Instanz bei Amazon Web Services (AWS Lightsail, Standort Frankfurt am Main / EU) versendet. Die Weitergabe Ihrer E-Mail-Adresse an unberechtigte Dritte ist ausgeschlossen.
          </li>
        </ul>

        <h2 class="font-headline text-lg text-fs-primary-600 pt-2">3. Zero-PII Architektur & Rollenvergabe</h2>
        <p>
          Die Plattform speichert bewusst keine Passwörter im Klartext oder privaten Adressdaten von Endnutzer:innen.
          Die Authentifizierung erfolgt tokenbasiert (z.&nbsp;B. via Identity Platform / Firebase Auth oder Einladungslinks).
          Rollenprivilegien (z.&nbsp;B. <code>WORKGROUP_GIVING_STORES</code>) werden über kryptografisch signierte Einmal-Tokens
          zugewiesen.
        </p>

        <h2 class="font-headline text-lg text-fs-primary-600 pt-2">4. Trennung von öffentlichen und internen Daten</h2>
        <p>
          Öffentlich zugänglich sind ausschließlich allgemeine Informationen zu Abgabestellen (Annahmezeiten, angenommene Waren,
          öffentliche Telefonnummern). Interne Ansprechpersonen und vertrauliche Gesprächsprotokolle werden strikt serverseitig
          abgesichert und sind ausschließlich für autorisierte Regionalkoordinator:innen einsehbar.
        </p>

        <h2 class="font-headline text-lg text-fs-primary-600 pt-2">5. Deine Rechte</h2>
        <p>
          Du hast das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16 DSGVO), Löschung (Art. 17 DSGVO) und
          Widerruf einer erteilten Einwilligung bezüglich der von dir eingereichten Daten. Wende dich hierzu an
          <a href="mailto:datenschutz@abgabestellen.app" class="text-fs-secondary-700 font-semibold underline hover:text-fs-secondary-800">
            datenschutz@abgabestellen.app
          </a>.
        </p>
      </div>
    </FsContainer>
  </div>
</template>

<script setup lang="ts">
import { ShieldCheck } from 'lucide-vue-next';
import FsContainer from '../components/FsContainer.vue';
</script>
