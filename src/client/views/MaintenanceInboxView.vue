<template>
  <div class="max-w-7xl mx-auto px-4 py-6 sm:py-8 space-y-6 flex-1 w-full">
    <!-- Guard: Not Logged In -->
    <div v-if="!authState.user" class="max-w-lg mx-auto py-8">
      <FsContainer title="Anmeldung erforderlich">
        <template #icon>
          <Lock class="w-4 h-4 text-fs-primary-700" />
        </template>
        <div class="space-y-4 text-xs text-fs-text">
          <p class="leading-relaxed">
            Das Pflege-Dashboard, die Verifizierungs-Ampel (inklusive interner Rückrufnummern) und die Mitbearbeiter-Verwaltung sind nur für angemeldete Koordinator:innen und ORGA zugänglich.
          </p>
          <div class="flex items-center gap-2 pt-1">
            <button type="button" @click="showLoginModal = true" class="fs-btn-primary">
              <LogIn class="w-3.5 h-3.5" />
              <span>Jetzt anmelden</span>
            </button>
            <router-link to="/" class="fs-btn-secondary">Zur öffentlichen Karte</router-link>
          </div>
        </div>
      </FsContainer>

      <LoginModal
        :is-open="showLoginModal"
        @close="showLoginModal = false"
        @loggedIn="onLoggedIn"
      />
    </div>

    <!-- Authenticated Dashboard -->
    <template v-else>
      <!-- Page Header + Tabs -->
      <div class="fs-container overflow-hidden">
        <div class="p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div class="flex flex-wrap items-center gap-2.5">
              <h1 class="font-headline text-2xl text-fs-primary-600 leading-tight">
                Pflege-Dashboard & Koordination
              </h1>
              <span v-if="authState.user.isSuperAdmin" class="fs-badge-ochre">
                <ShieldCheck class="w-3.5 h-3.5" />
                ORGA / Super-Admin
              </span>
              <span v-else class="fs-badge-green">
                <ShieldCheck class="w-3.5 h-3.5" />
                AG Abgabestellen
              </span>
            </div>
            <p class="text-xs text-fs-muted mt-1">
              Nach Bedarf sortierte Verifizierungs-Ampel, Community-Vorschläge und Verwaltung von Mitbearbeiter-Zugängen.
            </p>
          </div>

          <!-- Action Buttons -->
          <div class="flex flex-wrap items-center gap-2.5">
            <button
              @click="downloadCsvBackup"
              type="button"
              :disabled="downloadingCsv"
              class="fs-btn-secondary"
            >
              <Download class="w-3.5 h-3.5" />
              <span>{{ downloadingCsv ? 'Bereite Export vor...' : 'Backup als Tabelle (CSV)' }}</span>
            </button>
            <button
              v-if="canManageTeam"
              @click="openInviteModal"
              type="button"
              class="fs-btn-primary"
            >
              <UserPlus class="w-3.5 h-3.5" />
              <span>Einladungslink generieren</span>
            </button>
          </div>
        </div>

        <!-- Tab Navigation Bar -->
        <div class="px-5 sm:px-6 bg-fs-elevated border-t border-fs-primary-200 flex items-center gap-5 text-xs font-semibold overflow-x-auto">
          <button
            type="button"
            @click="switchTab('inbox')"
            :class="[
              'py-3 border-b-2 flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap',
              activeTab === 'inbox'
                ? 'border-[#64ae24] text-fs-secondary-800 font-bold'
                : 'border-transparent text-fs-muted hover:text-fs-primary-900'
            ]"
          >
            <Activity class="w-4 h-4" />
            <span>Pflege & Verifizierungs-Ampel</span>
            <span
              v-if="urgentAndOverdueCount > 0"
              class="bg-[#cf3a00] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none"
            >
              {{ urgentAndOverdueCount }}
            </span>
          </button>

          <button
            v-if="canManageTeam"
            type="button"
            @click="switchTab('team')"
            :class="[
              'py-3 border-b-2 flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap',
              activeTab === 'team'
                ? 'border-[#64ae24] text-fs-secondary-800 font-bold'
                : 'border-transparent text-fs-muted hover:text-fs-primary-900'
            ]"
          >
            <Users class="w-4 h-4" />
            <span>Mitbearbeiter & Zugänge</span>
          </button>
        </div>
      </div>

      <!-- TAB 2: Team & Access Administration -->
      <TeamManagementPanel
        v-if="activeTab === 'team' && canManageTeam"
        ref="teamPanelRef"
        @openInviteModal="openInviteModal"
      />

      <!-- TAB 1: Suggestions Inbox & Need-Sorted Verification Traffic Light -->
      <template v-else>
        <!-- Error Banner if Permissions Missing -->
        <div
          v-if="loadError"
          class="p-4 rounded-fs bg-fs-danger-100 border border-fs-danger-300 border-l-4 border-l-fs-danger-500 text-xs text-fs-danger-900 flex items-start justify-between gap-3"
        >
          <div class="flex items-start gap-2.5">
            <AlertTriangle class="w-4 h-4 text-fs-danger-600 shrink-0 mt-0.5" />
            <div>
              <div class="font-bold">Pflege-Daten konnten nicht geladen werden</div>
              <div class="mt-0.5">{{ loadError }}</div>
            </div>
          </div>
          <button type="button" @click="loadData" class="fs-btn-secondary !py-1 !px-2.5 shrink-0">
            Erneut versuchen
          </button>
        </div>

        <!-- Section 1: Community Suggestions Inbox -->
        <FsContainer body-class="p-0">
          <template #icon>
            <Inbox class="w-4 h-4 text-fs-secondary-600" />
          </template>
          <template #title>
            <div class="flex items-center gap-2">
              <h2 class="font-sans text-sm font-bold text-fs-primary-900 m-0">
                Offene Änderungsvorschläge
              </h2>
              <span class="bg-[#64ae24] text-white text-[11px] font-bold px-2 py-0.5 rounded-full leading-none">
                {{ pendingSuggestions.length }}
              </span>
            </div>
          </template>

          <div
            v-if="pendingSuggestions.length === 0"
            class="text-xs text-fs-muted italic p-6 text-center bg-fs-surface"
          >
            Aktuell liegen keine offenen Änderungsvorschläge in deinen betreuten Regionen vor.
          </div>

          <div v-else class="divide-y divide-fs-primary-200">
            <div
              v-for="s in pendingSuggestions"
              :key="s.id"
              class="p-4 sm:px-5 bg-fs-surface hover:bg-fs-secondary-100/60 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div class="space-y-1 text-xs">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="font-bold text-fs-primary-900 text-sm">
                    {{ s.store_name || s.payload.name || 'Neuer Vorschlag' }}
                  </span>
                  <span class="fs-badge-brown">
                    {{ s.region_name }}
                  </span>
                  <span v-if="!s.store_id" class="fs-badge-green !text-[10px]">
                    Neue Einrichtung
                  </span>
                </div>
                <p
                  v-if="s.author_note"
                  class="text-fs-text italic bg-fs-bg border border-fs-primary-200 rounded px-2.5 py-1.5 mt-1"
                >
                  „{{ s.author_note }}“
                </p>
                <div class="text-[11px] text-fs-muted pt-0.5">
                  Eingereicht am {{ formatDate(s.created_at) }} von {{ s.author_email || 'Community' }}
                </div>
              </div>

              <div class="flex items-center gap-2 shrink-0">
                <button
                  @click="review(s.id, 'APPROVED')"
                  type="button"
                  class="fs-btn-primary !py-1.5"
                >
                  <Check class="w-3.5 h-3.5" />
                  <span>Freigeben</span>
                </button>
                <button
                  @click="review(s.id, 'REJECTED')"
                  type="button"
                  class="fs-btn-danger !py-1.5"
                >
                  <X class="w-3.5 h-3.5" />
                  <span>Ablehnen</span>
                </button>
              </div>
            </div>
          </div>
        </FsContainer>

        <!-- Section 2: Need-Sorted Verification Traffic Light -->
        <FsContainer body-class="p-0">
          <template #icon>
            <Activity class="w-4 h-4 text-fs-primary-700" />
          </template>
          <template #title>
            <div class="flex flex-wrap items-center gap-2">
              <h2 class="font-sans text-sm font-bold text-fs-primary-900 m-0">
                Verifizierungs-Ampel (Nach Bedarf sortiert)
              </h2>
              <span class="fs-badge-brown !text-[10px]">
                {{ filteredStores.length }} von {{ overdueStores.length }} Stellen
              </span>
            </div>
          </template>

          <!-- Interactive KPI Filter Tiles + Search & District Filter -->
          <div class="p-4 bg-fs-bg border-b border-fs-primary-200 space-y-3">
            <!-- Clickable Ampel Filter Tiles -->
            <div class="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
              <button
                type="button"
                @click="ampelFilter = 'all'"
                :class="[
                  'p-2.5 rounded-fs border text-left transition-all cursor-pointer',
                  ampelFilter === 'all'
                    ? 'bg-fs-primary-600 text-white border-fs-primary-700 shadow-sm'
                    : 'bg-fs-surface hover:bg-fs-primary-100 border-fs-primary-300 text-fs-primary-900'
                ]"
              >
                <div class="text-[10px] uppercase tracking-wider opacity-80 font-bold">Gesamt</div>
                <div class="text-base font-bold mt-0.5">{{ overdueStores.length }}</div>
              </button>

              <button
                type="button"
                @click="ampelFilter = 'red'"
                :class="[
                  'p-2.5 rounded-fs border text-left transition-all cursor-pointer',
                  ampelFilter === 'red'
                    ? 'bg-[#cf3a00] text-white border-[#cf3a00] shadow-sm'
                    : 'bg-fs-surface hover:bg-fs-danger-100 border-fs-primary-300 text-fs-primary-900'
                ]"
              >
                <div class="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold">
                  <span
                    :class="[
                      'w-2 h-2 rounded-full',
                      ampelFilter === 'red' ? 'bg-white' : 'bg-[#cf3a00]'
                    ]"
                  ></span>
                  <span>Akut / &gt;180 Tage</span>
                </div>
                <div class="text-base font-bold mt-0.5">{{ urgentAndOverdueCount }}</div>
              </button>

              <button
                type="button"
                @click="ampelFilter = 'yellow'"
                :class="[
                  'p-2.5 rounded-fs border text-left transition-all cursor-pointer',
                  ampelFilter === 'yellow'
                    ? 'bg-[#cc990e] text-white border-[#cc990e] shadow-sm'
                    : 'bg-fs-surface hover:bg-fs-warning-100 border-fs-primary-300 text-fs-primary-900'
                ]"
              >
                <div class="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold">
                  <span
                    :class="[
                      'w-2 h-2 rounded-full',
                      ampelFilter === 'yellow' ? 'bg-white' : 'bg-[#cc990e]'
                    ]"
                  ></span>
                  <span>90–180 Tage</span>
                </div>
                <div class="text-base font-bold mt-0.5">{{ yellowCount }}</div>
              </button>

              <button
                type="button"
                @click="ampelFilter = 'green'"
                :class="[
                  'p-2.5 rounded-fs border text-left transition-all cursor-pointer',
                  ampelFilter === 'green'
                    ? 'bg-[#64ae24] text-white border-[#64ae24] shadow-sm'
                    : 'bg-fs-surface hover:bg-fs-secondary-100 border-fs-primary-300 text-fs-primary-900'
                ]"
              >
                <div class="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold">
                  <span
                    :class="[
                      'w-2 h-2 rounded-full',
                      ampelFilter === 'green' ? 'bg-white' : 'bg-[#64ae24]'
                    ]"
                  ></span>
                  <span>&lt; 90 Tage</span>
                </div>
                <div class="text-base font-bold mt-0.5">{{ greenCount }}</div>
              </button>

              <button
                type="button"
                @click="ampelFilter = 'paused'"
                :class="[
                  'col-span-2 sm:col-span-1 p-2.5 rounded-fs border text-left transition-all cursor-pointer',
                  ampelFilter === 'paused'
                    ? 'bg-[#5e636e] text-white border-[#5e636e] shadow-sm'
                    : 'bg-fs-surface hover:bg-fs-primary-100 border-fs-primary-300 text-fs-primary-900'
                ]"
              >
                <div class="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold">
                  <span
                    :class="[
                      'w-2 h-2 rounded-full',
                      ampelFilter === 'paused' ? 'bg-white' : 'bg-[#5e636e]'
                    ]"
                  ></span>
                  <span>Pausiert / Inaktiv</span>
                </div>
                <div class="text-base font-bold mt-0.5">{{ pausedCount }}</div>
              </button>
            </div>

            <!-- Search & District Filter Row -->
            <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <div class="relative flex-1">
                <Search class="w-3.5 h-3.5 text-fs-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  v-model="searchQuery"
                  type="text"
                  placeholder="Abgabestelle, Straße, PLZ oder interne Ansprechperson suchen..."
                  class="fs-input !pl-8 !py-1.5"
                />
              </div>

              <select
                v-model="districtFilter"
                aria-label="Nach Bezirk filtern"
                class="fs-input sm:w-56 !py-1.5"
              >
                <option value="">Alle Bezirke ({{ availableDistricts.length }})</option>
                <option v-for="d in availableDistricts" :key="d" :value="d">
                  {{ d }}
                </option>
              </select>

              <button
                v-if="ampelFilter !== 'all' || districtFilter || searchQuery"
                type="button"
                @click="resetFilters"
                class="fs-btn-secondary !py-1.5"
              >
                <X class="w-3.5 h-3.5" />
                <span>Filter zurücksetzen</span>
              </button>
            </div>
          </div>

          <!-- Loading / Empty / Table -->
          <div v-if="loadingAmpel" class="p-8 text-center text-xs text-fs-muted bg-fs-surface">
            Lade Abgabestellen nach Verifizierungs-Bedarf...
          </div>

          <div
            v-else-if="filteredStores.length === 0"
            class="p-8 text-center text-xs text-fs-muted italic bg-fs-surface"
          >
            Keine Abgabestellen für die aktuelle Filterauswahl gefunden.
          </div>

          <div v-else class="overflow-x-auto bg-fs-surface">
            <table class="w-full text-left text-xs">
              <thead class="bg-fs-bg border-b border-fs-primary-200 text-fs-muted font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th class="p-3.5">Bedarf / Ampel</th>
                  <th class="p-3.5">Abgabestelle</th>
                  <th class="p-3.5">Bezirk</th>
                  <th class="p-3.5">Zuletzt kontaktiert</th>
                  <th class="p-3.5">Interner Kontakt</th>
                  <th class="p-3.5 text-right">Aktionen</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-fs-primary-200/80">
                <tr
                  v-for="store in filteredStores"
                  :key="store.id"
                  :class="[
                    'transition-colors',
                    store.is_paused
                      ? 'bg-fs-bg/60 opacity-80 hover:opacity-100'
                      : 'hover:bg-fs-primary-100/70'
                  ]"
                >
                  <!-- Column 1: Urgency Badge -->
                  <td class="p-3.5 whitespace-nowrap">
                    <div class="flex items-center gap-2">
                      <span
                        :class="[
                          'w-3 h-3 rounded-full inline-block ring-2 ring-white/60 shadow-sm shrink-0',
                          getDotClass(store)
                        ]"
                      ></span>
                      <span :class="getBadgeClass(store)">
                        {{ store.need_reason || getFallbackReason(store) }}
                      </span>
                    </div>
                  </td>

                  <!-- Column 2: Store Name & Address -->
                  <td class="p-3.5 font-bold text-fs-primary-900">
                    <router-link
                      :to="'/stores/' + store.id"
                      class="hover:text-fs-secondary-600 hover:underline transition-colors"
                    >
                      {{ store.name }}
                    </router-link>
                    <div class="text-[11px] font-normal text-fs-muted">
                      {{ store.str }}<span v-if="store.str && (store.plz || store.stadt)">, </span>{{ store.plz }} {{ store.stadt }}
                    </div>
                    <div
                      v-if="!store.dropoff_times && !store.is_paused"
                      class="text-[10px] font-semibold text-fs-warning-700 mt-0.5"
                    >
                      Abgabezeiten fehlen noch
                    </div>
                  </td>

                  <!-- Column 3: District -->
                  <td class="p-3.5 text-fs-muted font-medium whitespace-nowrap">
                    {{ store.region_name }}
                  </td>

                  <!-- Column 4: Last Verified Date + Latest Note Preview -->
                  <td class="p-3.5 max-w-[240px]">
                    <div v-if="store.last_contact_at" class="text-fs-text font-semibold">
                      {{ formatDate(store.last_contact_at) }}
                    </div>
                    <span v-else class="fs-badge-red !text-[10px]">
                      Nie verifiziert
                    </span>
                    <div
                      v-if="store.latest_contact?.note"
                      class="text-[11px] text-fs-muted truncate mt-0.5"
                      :title="`${store.latest_contact.author_name || ''}: ${store.latest_contact.note}`"
                    >
                      {{ store.latest_contact.note }}
                    </div>
                  </td>

                  <!-- Column 5: Confidential Internal Contact -->
                  <td class="p-3.5 text-fs-text">
                    <div v-if="store.ansprechpartner" class="font-medium">
                      {{ store.ansprechpartner }}
                    </div>
                    <a
                      v-if="store.telefon"
                      :href="'tel:' + store.telefon.replace(/[^+0-9]/g, '')"
                      class="inline-flex items-center gap-1 text-fs-secondary-700 hover:underline font-semibold text-[11px]"
                    >
                      <Phone class="w-3 h-3 shrink-0" />
                      <span>{{ store.telefon }}</span>
                    </a>
                    <div
                      v-else-if="store.public_phone"
                      class="text-[11px] text-fs-muted"
                    >
                      Öffentlich: {{ store.public_phone }}
                    </div>
                    <div
                      v-if="!store.ansprechpartner && !store.telefon && !store.public_phone"
                      class="text-fs-muted italic text-[11px]"
                    >
                      Keine Kontaktdaten
                    </div>
                  </td>

                  <!-- Column 6: Quick Verify + Detail Link -->
                  <td class="p-3.5 text-right whitespace-nowrap">
                    <div class="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        @click="openQuickVerify(store)"
                        class="fs-btn-primary !py-1 !px-2.5 !text-[11px]"
                        title="Kontakt direkt hier protokollieren"
                      >
                        <CheckCircle2 class="w-3.5 h-3.5" />
                        <span>Kontaktieren / Prüfen</span>
                      </button>
                      <router-link
                        :to="'/stores/' + store.id"
                        class="fs-btn-secondary !py-1 !px-2 !text-[11px]"
                        title="Vollständige Detailseite & Bearbeitung öffnen"
                      >
                        <span>Details</span>
                      </router-link>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </FsContainer>
      </template>

      <!-- Modal 1: Quick Verification / Contact Log Entry -->
      <div
        v-if="quickVerifyStore"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-xs"
        @click.self="quickVerifyStore = null"
      >
        <div class="fs-container shadow-fs w-full max-w-lg overflow-hidden">
          <div class="fs-container-header">
            <div class="flex items-center gap-2 font-bold text-sm text-fs-primary-900 min-w-0">
              <CheckCircle2 class="w-4 h-4 text-[#64ae24] shrink-0" />
              <span class="truncate">Kontakt protokollieren</span>
            </div>
            <button
              @click="quickVerifyStore = null"
              type="button"
              class="text-fs-primary-700 hover:text-fs-danger-600 p-1 rounded-fs cursor-pointer"
            >
              <X class="w-4 h-4" />
            </button>
          </div>

          <form @submit.prevent="submitQuickVerify" class="p-5 space-y-4 bg-fs-surface text-xs">
            <!-- Store & Phone Reference Card -->
            <div class="p-3.5 rounded-fs bg-fs-bg border border-fs-primary-200 space-y-1.5">
              <div class="font-bold text-sm text-fs-primary-900">{{ quickVerifyStore.name }}</div>
              <div class="text-[11px] text-fs-muted">
                {{ quickVerifyStore.str }}, {{ quickVerifyStore.plz }} {{ quickVerifyStore.stadt }} ({{ quickVerifyStore.region_name }})
              </div>
              <div class="pt-1.5 border-t border-fs-primary-200 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
                <span v-if="quickVerifyStore.ansprechpartner">
                  <strong>Intern:</strong> {{ quickVerifyStore.ansprechpartner }}
                </span>
                <a
                  v-if="quickVerifyStore.telefon"
                  :href="'tel:' + quickVerifyStore.telefon.replace(/[^+0-9]/g, '')"
                  class="font-bold text-fs-secondary-700 hover:underline inline-flex items-center gap-1"
                >
                  <Phone class="w-3 h-3" />
                  <span>{{ quickVerifyStore.telefon }}</span>
                </a>
                <span v-else-if="quickVerifyStore.public_phone" class="text-fs-muted">
                  <strong>Öffentlich:</strong> {{ quickVerifyStore.public_phone }}
                </span>
              </div>
            </div>

            <!-- 1-Click Quick Presets -->
            <div class="space-y-1.5">
              <div class="text-[11px] font-semibold text-fs-primary-800">Schnellvorlagen:</div>
              <div class="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  @click="applyPreset('Telefon', 'Telefonisch erreicht – alle Abgabezeiten und Konditionen sind weiterhin aktuell.', true)"
                  class="px-2.5 py-1 rounded-fs bg-fs-secondary-100 hover:bg-fs-secondary-200 border border-fs-secondary-300 text-fs-secondary-900 font-medium text-[11px] cursor-pointer transition-colors"
                >
                  ✓ Telefonisch bestätigt (aktuell)
                </button>
                <button
                  type="button"
                  @click="applyPreset('Vor Ort', 'Vor Ort überprüft – Abgabestelle nimmt weiterhin wie angegeben Lebensmittel an.', true)"
                  class="px-2.5 py-1 rounded-fs bg-fs-secondary-100 hover:bg-fs-secondary-200 border border-fs-secondary-300 text-fs-secondary-900 font-medium text-[11px] cursor-pointer transition-colors"
                >
                  ✓ Vor Ort bestätigt
                </button>
                <button
                  type="button"
                  @click="applyPreset('Telefon', 'Telefonisch niemanden erreicht – Rückruf zu anderer Tageszeit erforderlich.', false)"
                  class="px-2.5 py-1 rounded-fs bg-fs-primary-100 hover:bg-fs-primary-200 border border-fs-primary-300 text-fs-primary-900 font-medium text-[11px] cursor-pointer transition-colors"
                >
                  Niemand erreicht
                </button>
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block font-semibold text-fs-primary-800 mb-1">Kontaktweg</label>
                <select v-model="verifyForm.channel" class="fs-input">
                  <option value="Telefon">Telefon</option>
                  <option value="Vor Ort">Vor Ort</option>
                  <option value="E-Mail">E-Mail</option>
                  <option value="Messenger">Messenger</option>
                  <option value="Sonstiges">Sonstiges</option>
                </select>
              </div>
              <div>
                <label class="block font-semibold text-fs-primary-800 mb-1">Erreichte Person (optional)</label>
                <input
                  v-model="verifyForm.contact_person"
                  type="text"
                  placeholder="z. B. Frau Müller / Pforte"
                  class="fs-input"
                />
              </div>
            </div>

            <div>
              <label class="block font-semibold text-fs-primary-800 mb-1">Gesprächsnotiz *</label>
              <textarea
                v-model="verifyForm.note"
                rows="3"
                required
                placeholder="Kurze Zusammenfassung des Gesprächs..."
                class="fs-input"
              ></textarea>
            </div>

            <label class="flex items-center gap-2.5 p-3 rounded-fs bg-fs-secondary-100/70 border border-fs-secondary-300 cursor-pointer">
              <input
                v-model="verifyForm.confirmed_current"
                type="checkbox"
                class="w-4 h-4 accent-[#64ae24] rounded cursor-pointer"
              />
              <span class="font-semibold text-fs-secondary-900">
                Angaben als aktuell bestätigt (setzt Verifizierungs-Ampel auf Grün)
              </span>
            </label>

            <div class="flex items-center justify-between gap-2 pt-2 border-t border-fs-primary-200">
              <router-link
                :to="'/stores/' + quickVerifyStore.id"
                class="text-[11px] font-semibold text-fs-secondary-700 hover:underline"
              >
                Stattdessen Daten bearbeiten &rarr;
              </router-link>
              <div class="flex items-center gap-2">
                <button @click="quickVerifyStore = null" type="button" class="fs-btn-secondary">
                  Abbrechen
                </button>
                <button type="submit" :disabled="submittingVerify" class="fs-btn-primary">
                  <Check class="w-3.5 h-3.5" />
                  <span>{{ submittingVerify ? 'Speichere...' : 'Protokoll speichern' }}</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      <!-- Modal 2: Invite Token Generator -->
      <div
        v-if="showInviteModal"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-xs"
        @click.self="showInviteModal = false"
      >
        <div class="fs-container shadow-fs w-full max-w-md overflow-hidden">
          <div class="fs-container-header">
            <div class="flex items-center gap-2 font-bold text-sm text-fs-primary-900">
              <UserPlus class="w-4 h-4 text-fs-secondary-600" />
              <span>Einladungslink generieren</span>
            </div>
            <button
              @click="showInviteModal = false"
              type="button"
              class="text-fs-primary-700 hover:text-fs-danger-600 p-1 rounded-fs cursor-pointer"
            >
              <X class="w-4 h-4" />
            </button>
          </div>

          <div class="p-5 space-y-4 bg-fs-surface text-xs">
            <p class="text-fs-muted leading-relaxed">
              Erzeugt einen kryptografisch signierten Einmal-Link für neue Mitbearbeiter:innen in der gewählten Region.
            </p>

            <div>
              <label class="block font-semibold text-fs-primary-800 mb-1">Zielregion</label>
              <select v-model="selectedInviteRegion" class="fs-input">
                <option v-for="r in inviteAssignableRegions" :key="r.id" :value="r.id">
                  {{ r.name }}
                </option>
              </select>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block font-semibold text-fs-primary-800 mb-1">Rolle</label>
                <select v-model="selectedInviteRole" class="fs-input">
                  <option value="WORKGROUP_GIVING_STORES">AG Abgabestellen</option>
                  <option v-if="authState.user?.isSuperAdmin" value="AMBASSADOR">Botschafter:in</option>
                  <option v-if="authState.user?.isSuperAdmin" value="ORGA">ORGA / Super-Admin</option>
                </select>
              </div>
              <div>
                <label class="block font-semibold text-fs-primary-800 mb-1">Gültigkeit</label>
                <select v-model="selectedInviteDays" class="fs-input">
                  <option :value="7">7 Tage</option>
                  <option :value="14">14 Tage</option>
                  <option :value="30">30 Tage</option>
                </select>
              </div>
            </div>

            <div
              v-if="generatedInviteLink"
              class="bg-fs-secondary-100 border border-fs-secondary-300 p-3 rounded-fs space-y-2"
            >
              <div class="font-bold text-fs-secondary-900">Generierter Einmal-Link:</div>
              <div class="flex items-center gap-1.5">
                <input
                  readonly
                  :value="generatedInviteLink"
                  class="flex-1 text-[11px] bg-fs-surface border border-fs-primary-300 rounded-fs px-2.5 py-1.5 font-mono select-all text-fs-text"
                />
                <button
                  type="button"
                  @click="copyInviteLink"
                  class="fs-btn-secondary !py-1.5 !px-2.5"
                  title="In Zwischenablage kopieren"
                >
                  <Copy class="w-3.5 h-3.5" />
                </button>
              </div>
              <p class="text-[10px] text-fs-muted">
                Kann einmalig eingelöst oder jederzeit unter „Mitbearbeiter & Zugänge“ widerrufen werden.
              </p>
            </div>

            <div class="flex justify-end gap-2 pt-2 border-t border-fs-primary-200">
              <button @click="showInviteModal = false" type="button" class="fs-btn-secondary">
                Schließen
              </button>
              <button @click="createInvite" type="button" class="fs-btn-primary">
                <Link2 class="w-3.5 h-3.5" />
                <span>Link erzeugen</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  ShieldCheck,
  Download,
  UserPlus,
  Inbox,
  Check,
  X,
  Activity,
  Copy,
  Link2,
  Users,
  Search,
  Phone,
  CheckCircle2,
  AlertTriangle,
  Lock,
  LogIn
} from 'lucide-vue-next';
import { UserRoleType } from '@shared/types';
import {
  appState,
  authState,
  fetchApi,
  refreshAuthProfile,
  notifySuccess,
  notifyError
} from '../state';
import FsContainer from '../components/FsContainer.vue';
import TeamManagementPanel from '../components/TeamManagementPanel.vue';
import LoginModal from '../components/LoginModal.vue';

const route = useRoute();
const router = useRouter();

const showLoginModal = ref(false);
const activeTab = ref<'inbox' | 'team'>('inbox');
const teamPanelRef = ref<InstanceType<typeof TeamManagementPanel> | null>(null);

const pendingSuggestions = ref<any[]>([]);
const overdueStores = ref<any[]>([]);
const loadingAmpel = ref(false);
const loadError = ref('');

// Ampel Filters
const ampelFilter = ref<'all' | 'red' | 'yellow' | 'green' | 'paused'>('all');
const districtFilter = ref('');
const searchQuery = ref('');

// Quick Verify Modal
const quickVerifyStore = ref<any | null>(null);
const submittingVerify = ref(false);
const verifyForm = reactive({
  channel: 'Telefon' as 'Telefon' | 'E-Mail' | 'Vor Ort' | 'Messenger' | 'Sonstiges',
  contact_person: '',
  note: '',
  confirmed_current: true
});

// Invite Modal
const showInviteModal = ref(false);
const selectedInviteRegion = ref<number>(1);
const selectedInviteRole = ref<UserRoleType>(UserRoleType.WORKGROUP_GIVING_STORES);
const selectedInviteDays = ref<number>(7);
const generatedInviteLink = ref('');
const downloadingCsv = ref(false);

const canManageTeam = computed(() => {
  return Boolean(authState.canManageTeam || authState.user?.isSuperAdmin);
});

const inviteAssignableRegions = computed(() => {
  if (authState.user?.isSuperAdmin) return appState.regions;
  if (authState.teamAdminRegionIds.length > 0) {
    const allowed = new Set(authState.teamAdminRegionIds);
    return appState.regions.filter(r => allowed.has(r.id));
  }
  return appState.regions;
});

const urgentAndOverdueCount = computed(
  () => overdueStores.value.filter(s => s.need_tier === 1 || s.need_tier === 2).length
);
const yellowCount = computed(() => overdueStores.value.filter(s => s.need_tier === 3).length);
const greenCount = computed(() => overdueStores.value.filter(s => s.need_tier === 4).length);
const pausedCount = computed(() => overdueStores.value.filter(s => s.need_tier === 5).length);

const availableDistricts = computed(() => {
  const set = new Set<string>();
  for (const s of overdueStores.value) {
    if (s.region_name) set.add(s.region_name);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'de'));
});

const filteredStores = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  return overdueStores.value.filter(s => {
    if (ampelFilter.value === 'red' && !(s.need_tier === 1 || s.need_tier === 2)) return false;
    if (ampelFilter.value === 'yellow' && s.need_tier !== 3) return false;
    if (ampelFilter.value === 'green' && s.need_tier !== 4) return false;
    if (ampelFilter.value === 'paused' && s.need_tier !== 5) return false;

    if (districtFilter.value && s.region_name !== districtFilter.value) return false;

    if (!q) return true;
    return (
      (s.name || '').toLowerCase().includes(q) ||
      (s.str || '').toLowerCase().includes(q) ||
      (s.plz || '').toLowerCase().includes(q) ||
      (s.region_name || '').toLowerCase().includes(q) ||
      (s.ansprechpartner || '').toLowerCase().includes(q) ||
      (s.telefon || '').toLowerCase().includes(q)
    );
  });
});

function syncTabFromRoute() {
  if (route.path === '/maintenance/team' || route.query.tab === 'team') {
    activeTab.value = 'team';
  } else {
    activeTab.value = 'inbox';
  }
}

function switchTab(tab: 'inbox' | 'team') {
  activeTab.value = tab;
  if (tab === 'team') {
    router.replace({ path: '/maintenance', query: { tab: 'team' } });
  } else {
    router.replace({ path: '/maintenance', query: {} });
  }
}

function resetFilters() {
  ampelFilter.value = 'all';
  districtFilter.value = '';
  searchQuery.value = '';
}

function getDotClass(store: any): string {
  if (store.need_tier === 5 || store.is_paused) return 'bg-[#5e636e]';
  if (store.need_tier === 1 || store.need_tier === 2) return 'bg-[#cf3a00]';
  if (store.need_tier === 3) return 'bg-[#cc990e]';
  return 'bg-[#64ae24]';
}

function getBadgeClass(store: any): string {
  if (store.need_tier === 5 || store.is_paused) return 'fs-badge-gray !text-[10px]';
  if (store.need_tier === 1 || store.need_tier === 2) return 'fs-badge-red !text-[10px]';
  if (store.need_tier === 3) return 'fs-badge-ochre !text-[10px]';
  return 'fs-badge-green !text-[10px]';
}

function getFallbackReason(store: any): string {
  if (!store.last_contact_at) return 'Nie verifiziert';
  return formatDate(store.last_contact_at);
}

function formatDate(raw: string) {
  try {
    const normalized = raw.includes('T') ? raw : `${raw.replace(' ', 'T')}Z`;
    return new Date(normalized).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch {
    return raw;
  }
}

async function downloadCsvBackup() {
  const regionId =
    appState.currentRegion?.id || authState.managedRegionIds[0] || 1;
  downloadingCsv.value = true;
  try {
    const headers = new Headers();
    if (authState.token) {
      headers.set('Authorization', `Bearer ${authState.token}`);
    }
    const res = await fetch(`/api/regions/${regionId}/export-berlin.csv`, { headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      notifyError(err.message || err.error || 'Fehler beim Herunterladen des Backups');
      return;
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const regionName = (appState.currentRegion?.name || 'berlin')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-');
    a.download = `abgabestellen-${regionName}-backup-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
    notifySuccess('CSV-Backup wurde heruntergeladen.');
  } catch (err: any) {
    notifyError(err.message || 'Fehler beim Herunterladen des Backups');
  } finally {
    downloadingCsv.value = false;
  }
}

async function loadData() {
  if (!authState.user) return;
  loadingAmpel.value = true;
  loadError.value = '';

  const regionParam = appState.currentRegion?.id
    ? `region_id=${appState.currentRegion.id}&auto_scope=1`
    : `auto_scope=1`;

  const [suggestionsRes, overdueRes] = await Promise.allSettled([
    fetchApi<any[]>(`/api/maintenance/suggestions?status=pending&${regionParam}`),
    fetchApi<any[]>(`/api/maintenance/overdue-contacts?${regionParam}`)
  ]);

  if (suggestionsRes.status === 'fulfilled') {
    pendingSuggestions.value = suggestionsRes.value;
    appState.pendingSuggestionsCount = suggestionsRes.value.length;
  } else {
    pendingSuggestions.value = [];
  }

  if (overdueRes.status === 'fulfilled') {
    overdueStores.value = overdueRes.value;
  } else {
    overdueStores.value = [];
    loadError.value =
      overdueRes.reason?.message ||
      'Keine Berechtigung oder Verbindungsfehler beim Laden der Verifizierungs-Ampel.';
  }

  loadingAmpel.value = false;
}

async function review(id: number, decision: 'APPROVED' | 'REJECTED') {
  try {
    await fetchApi(`/api/suggestions/${id}/review`, {
      method: 'POST',
      body: JSON.stringify({ decision })
    });
    notifySuccess(
      decision === 'APPROVED'
        ? 'Vorschlag wurde freigegeben und übernommen.'
        : 'Vorschlag wurde abgelehnt.'
    );
    await loadData();
  } catch (err: any) {
    notifyError(err.message || 'Fehler beim Überprüfen des Vorschlags');
  }
}

function openQuickVerify(store: any) {
  quickVerifyStore.value = store;
  verifyForm.channel = 'Telefon';
  verifyForm.contact_person = store.ansprechpartner || '';
  verifyForm.note = '';
  verifyForm.confirmed_current = true;
}

function applyPreset(
  channel: 'Telefon' | 'E-Mail' | 'Vor Ort' | 'Messenger' | 'Sonstiges',
  note: string,
  confirmedCurrent: boolean
) {
  verifyForm.channel = channel;
  verifyForm.note = note;
  verifyForm.confirmed_current = confirmedCurrent;
}

async function submitQuickVerify() {
  if (!quickVerifyStore.value) return;
  submittingVerify.value = true;
  try {
    await fetchApi(`/api/giving-stores/${quickVerifyStore.value.id}/contact-log`, {
      method: 'POST',
      body: JSON.stringify({
        channel: verifyForm.channel,
        contact_person: verifyForm.contact_person,
        note: verifyForm.note,
        confirmed_current: verifyForm.confirmed_current
      })
    });
    notifySuccess(`Kontakt für „${quickVerifyStore.value.name}“ protokolliert.`);
    quickVerifyStore.value = null;
    await loadData();
  } catch (err: any) {
    notifyError(err.message || 'Fehler beim Speichern des Kontaktprotokolls');
  } finally {
    submittingVerify.value = false;
  }
}

function openInviteModal() {
  generatedInviteLink.value = '';
  selectedInviteRegion.value =
    inviteAssignableRegions.value[0]?.id || appState.currentRegion?.id || 1;
  selectedInviteRole.value = UserRoleType.WORKGROUP_GIVING_STORES;
  selectedInviteDays.value = 7;
  showInviteModal.value = true;
}

async function createInvite() {
  try {
    const res = await fetchApi<{ rawToken: string }>(`/api/invite/create`, {
      method: 'POST',
      body: JSON.stringify({
        region_id: selectedInviteRegion.value,
        target_role: selectedInviteRole.value,
        expiresInDays: selectedInviteDays.value
      })
    });
    generatedInviteLink.value = `${window.location.origin}/invite/${res.rawToken}`;
    notifySuccess('Einladungslink erfolgreich erzeugt.');
    teamPanelRef.value?.reload();
  } catch (err: any) {
    notifyError(err.message || 'Fehler beim Erzeugen des Links');
  }
}

async function copyInviteLink() {
  if (!generatedInviteLink.value) return;
  try {
    await navigator.clipboard.writeText(generatedInviteLink.value);
    notifySuccess('Einladungslink in die Zwischenablage kopiert!');
  } catch {
    notifyError('Kopieren fehlgeschlagen – bitte Link manuell markieren.');
  }
}

function onLoggedIn() {
  showLoginModal.value = false;
  refreshAuthProfile().then(() => loadData());
}

watch(
  () => [route.path, route.query.tab],
  () => syncTabFromRoute(),
  { immediate: true }
);

watch(
  () => appState.currentRegion?.id,
  () => {
    if (authState.user) {
      loadData();
    }
  }
);

onMounted(async () => {
  if (authState.token) {
    await refreshAuthProfile();
  }
  if (authState.user) {
    await loadData();
  }
});
</script>
