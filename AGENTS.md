# Projekt-Richtlinien für abgabestellen.app

## 1. Test-Integrität & Datenschutz (DSGVO / Zero-PII Leakage)
- Das Repository ist öffentlich. Reale Kontaktdaten, persönliche Telefonnummern und produktive Adressbücher gehören unter keinen Umständen in Git (`.gitignore`).
- Unit- und Integrationstests (`npm test`) dürfen niemals von lokalen, gitignorierten Produktionsdateien abhängig sein.
- Für CI-Testläufe in GitHub Actions müssen synthetische Test-Fixtures (`tests/fixtures/`) verwendet werden. Testdateien müssen bei Fehlen lokaler Produktionsdaten automatisch auf die Test-Fixture zurückgreifen.
- Vor jedem Commit/Push muss lokal `npm run typecheck` ausgeführt werden.

## 2. Deep-Links, Einladungs-Token & Eingabe-Sanitization
- Jede neue URL-Struktur (z. B. `/invite/...`, `/verify/...`) muss sowohl im Server-Routing (SPA Fallback zu `index.html`) als auch im Vue-Router (`src/client/router.ts`) mit optionalen Pfad- und Query-Parametern registriert sein.
- Token-Eingabefelder in Modals und APIs dürfen nicht blindlings davon ausgehen, dass der Nutzer nur den 64-Zeichen-Hex-Code eingibt. Vollständige URLs (z. B. `https://domain/invite/abc` oder `?token=abc`) müssen server- und clientseitig per Regex automatisch bereinigt werden:
  `/(?:token=|\/invite\/)([a-fA-F0-9]+)/`
- Bevor ein Token eingelöst wird, sollte über einen Inspektions-Endpunkt (`GET /api/invite/:token`) dessen Gültigkeit geprüft werden, um sprechende Kontextinformationen (z. B. Zielregion) im Frontend anzuzeigen.

## 3. Deployment auf Google Cloud Run
- Prüfe nach dem Push, ob GitHub Actions das Deployment ausführen konnte.
- Falls `GCP_SA_KEY` in den GitHub Repository Secrets fehlt oder der Deploy-Schritt übersprungen wird, deploye Änderungen direkt aus dem Workspace mit den vorhandenen Anmeldedaten:
  `gcloud run deploy abgabestellen-web --source . --region europe-west3 --quiet`
