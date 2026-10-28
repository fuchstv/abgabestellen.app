<template>
  <div class="max-w-3xl mx-auto px-4 py-12 space-y-8 flex-1 text-slate-800">
    <div class="border-b border-slate-200 pb-4">
      <h1 class="text-3xl font-black text-slate-900 tracking-tight">
        Datenschutzerklärung (DSGVO)
      </h1>
      <p class="text-xs text-slate-500 mt-1">Stand: Oktober 2026 — abgabestellen.app</p>
    </div>

    <!-- Explicit e.V. Transfer Clause -->
    <div class="bg-amber-50 border-l-4 border-amber-600 p-4 rounded-r-lg space-y-2">
      <h3 class="text-sm font-bold text-amber-950">
        Besondere Klausel: Zukünftige Übernahme durch einen gemeinnützigen Träger (e.V.)
      </h3>
      <p class="text-xs text-amber-900 leading-relaxed">
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

    <div class="space-y-4 text-xs leading-relaxed text-slate-700">
      <h2 class="text-base font-bold text-slate-900 pt-2">1. Verantwortliche Stelle</h2>
      <p>
        Verantwortlich für die Datenverarbeitung auf dieser Plattform ist die Entwicklungsgruppe von 
        <code>abgabestellen.app</code>. Kontakt über GitHub: 
        <a href="https://github.com/fuchstv/abgabestellen.app" class="text-amber-600 underline">github.com/fuchstv/abgabestellen.app</a>.
      </p>

      <h2 class="text-base font-bold text-slate-900 pt-2">2. Zero-PII Architektur & Rollenvergabe</h2>
      <p>
        Die Plattform speichert bewusst keine Passwörter oder privaten Adressdaten von Endnutzer:innen. 
        Die Authentifizierung erfolgt tokenbasiert (z.&nbsp;B. via Identity Platform / Firebase Auth oder Einladungslinks). 
        Rollenprivilegien (z.&nbsp;B. <code>WORKGROUP_GIVING_STORES</code>) werden über kryptografisch signierte Einmal-Tokens 
        zugewiesen.
      </p>

      <h2 class="text-base font-bold text-slate-900 pt-2">3. Trennung von öffentlichen und internen Daten</h2>
      <p>
        Öffentlich zugänglich sind ausschließlich allgemeine Informationen zu Abgabestellen (Annahmezeiten, angenommene Waren, 
        öffentliche Telefonnummern). Interne Ansprechpersonen und vertrauliche Gesprächsprotokolle werden strikt serverseitig 
        abgesichert und sind ausschließlich für autorisierte Regionalkoordinator:innen einsehbar.
      </p>

      <h2 class="text-base font-bold text-slate-900 pt-2">4. Deine Rechte</h2>
      <p>
        Du hast das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16 DSGVO), Löschung (Art. 17 DSGVO) und 
        Widerruf einer erteilten Einwilligung bezüglich der von dir eingereichten Daten.
      </p>
    </div>
  </div>
</template>
