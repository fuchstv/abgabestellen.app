# abgabestellen.app

[![Build & Test](https://github.com/fuchstv/abgabestellen.app/actions/workflows/deploy.yml/badge.svg)](https://github.com/fuchstv/abgabestellen.app/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-amber.svg)](LICENSE)
[![Google Cloud Run](https://img.shields.io/badge/Google%20Cloud-Run%20europe--west3-blue)](https://cloud.google.com/run)

**Standalone, multi-region open-source platform for food drop-off points, soup kitchens, community pantries, and social welfare institutions (*Abgabestellen & Soziale Einrichtungen*).**

Designed to run 100% independently across cities (starting with Berlin and its 12 districts) with **0€ idle cost** on Google Cloud Run, while keeping database schema and REST API payloads **strictly 1:1 compatible** with `foodsharing-dev/foodsharing` (`fs_betrieb`, `fs_bezirk`, `fs_store_giving_details`, `fs_store_giving_suggestion`, `fs_store_contact_log`).

---

## 🏛️ Architecture & Documentation
- [**ARCHITECTURE.md**](ARCHITECTURE.md) — Comprehensive architecture specification, database DDL, recursive region traversal, zero-PII onboarding, and disaster recovery.
- [**HANDOFF_GIVING_STORES.md**](HANDOFF_GIVING_STORES.md) — Forensic feature extraction from `foodsharing-dev/foodsharing` (Branch `2996-drop-off-points-giving-stores`, MR !5773).
- **Interactive OpenAPI 3.1 Swagger Docs**: Run the server and visit `/api/docs`.

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- Node.js 22+ & npm 9+
- SQLite3 & C++ build tools (`g++`, `make`) for native `better-sqlite3` bindings

### Installation
```bash
git clone https://github.com/fuchstv/abgabestellen.app.git
cd abgabestellen.app

# Install dependencies
npm install

# Seed local database with Berlin hierarchy and sample stores
npm run seed

# Run tests and typecheck
npm test
npm run typecheck

# Start local server (API + Client)
npm run build && npm start
```
The application will be live at `http://localhost:8080` with API docs at `http://localhost:8080/api/docs`.

---

## 🛡️ Security & Zero-PII RBAC Model

| Capability | Public Visitor | Foodsaver+ | GIVING_STORES Manager (Region & Ancestors) |
| :--- | :---: | :---: | :---: |
| **Interactive Map & Search** | ✅ | ✅ | ✅ |
| **Filter "Ohne Voranmeldung"** | ✅ | ✅ | ✅ |
| **Public Schedule & Accepted Goods** | ✅ | ✅ | ✅ |
| **Submit Change Report / Suggestion** | ❌ | ✅ | ✅ |
| **Internal Ansprechpartner & Direct Phone** | ❌ | ❌ | ✅ *(Gated to Region Tree)* |
| **Internal CRM Contact Log (`fs_store_contact_log`)** | ❌ | ❌ | ✅ *(Gated to Region Tree)* |
| **Approve / Reject Suggestions** | ❌ | ❌ | ✅ *(Gated to Region Tree)* |
| **Maintenance Traffic-Light Dashboard** | ❌ | ❌ | ✅ *(Gated to Region Tree)* |
| **Generate Coordinator Invite Links** | ❌ | ❌ | ✅ *(Gated to Region Tree)* |

### Regional Upward Permission Inheritance
If a volunteer holds `WORKGROUP_GIVING_STORES` on parent region `Berlin (Landesbezirk)`, they automatically inherit management and review authority over all 12 child districts (Mitte, Pankow, Neukölln, Friedrichshain-Kreuzberg, etc.) without per-district role duplication.

---

## 📦 Production Deployment (Google Cloud Run)

The platform is containerized using a multi-stage Dockerfile and deployed to `europe-west3` (Frankfurt):

```bash
# Build production container
docker build -t abgabestellen-web .

# Run container locally
docker run -p 8080:8080 -v $(pwd)/data:/data abgabestellen-web
```

---

## ⚖️ License & Legal
- Code released under the **MIT License**.
- **Legal Disclaimer:** *Unabhängiges Open-Source-Werkzeug – kein offizielles Angebot des foodsharing e.V.*
- Includes DSGVO data transfer clause for future non-profit foundation (*e.V.*) continuity.
