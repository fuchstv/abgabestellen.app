<template>
  <div class="space-y-6">
    <!-- Section A: Collaborator Accounts & Roles -->
    <FsContainer body-class="p-0">
      <template #icon>
        <Users class="w-4 h-4 text-fs-primary-700" />
      </template>
      <template #title>
        <div class="flex flex-wrap items-center gap-2">
          <h2 class="font-sans text-sm font-bold text-fs-primary-900 m-0">
            Mitbearbeiter:innen & Zugänge
          </h2>
          <span class="bg-fs-primary-600 text-white text-[11px] font-bold px-2 py-0.5 rounded-full leading-none">
            {{ members.length }}
          </span>
        </div>
      </template>
      <template #actions>
        <button
          @click="$emit('openInviteModal')"
          type="button"
          class="fs-btn-primary !py-1 !px-2.5 text-[11px]"
        >
          <UserPlus class="w-3.5 h-3.5" />
          <span>Neue Person einladen</span>
        </button>
      </template>

      <!-- Toolbar: Search & Filter Pills -->
      <div class="p-4 bg-fs-bg border-b border-fs-primary-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div class="relative flex-1 max-w-md">
          <Search class="w-3.5 h-3.5 text-fs-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Name, E-Mail, Bezirk oder Rolle suchen..."
            class="fs-input !pl-8 !py-1.5"
          />
        </div>

        <div class="flex flex-wrap items-center gap-1.5 text-[11px]">
          <button
            type="button"
            @click="statusFilter = 'all'"
            :class="[
              'px-2.5 py-1 rounded-full font-semibold border transition-colors cursor-pointer',
              statusFilter === 'all'
                ? 'bg-fs-primary-600 text-white border-fs-primary-600'
                : 'bg-fs-surface text-fs-primary-800 border-fs-primary-300 hover:bg-fs-primary-100'
            ]"
          >
            Alle ({{ members.length }})
          </button>
          <button
            type="button"
            @click="statusFilter = 'active'"
            :class="[
              'px-2.5 py-1 rounded-full font-semibold border transition-colors cursor-pointer',
              statusFilter === 'active'
                ? 'bg-[#64ae24] text-white border-[#64ae24]'
                : 'bg-fs-surface text-fs-primary-800 border-fs-primary-300 hover:bg-fs-primary-100'
            ]"
          >
            Aktiv ({{ activeCount }})
          </button>
          <button
            v-if="revokedCount > 0 || statusFilter === 'revoked'"
            type="button"
            @click="statusFilter = 'revoked'"
            :class="[
              'px-2.5 py-1 rounded-full font-semibold border transition-colors cursor-pointer',
              statusFilter === 'revoked'
                ? 'bg-[#cf3a00] text-white border-[#cf3a00]'
                : 'bg-fs-surface text-fs-danger-700 border-fs-danger-300 hover:bg-fs-danger-100'
            ]"
          >
            Gesperrt ({{ revokedCount }})
          </button>
        </div>
      </div>

      <!-- Loading / Error / Empty States -->
      <div v-if="loading" class="p-8 text-center text-xs text-fs-muted">
        Lade Mitbearbeiter:innen und Rollenzuweisungen...
      </div>

      <div
        v-else-if="errorMessage"
        class="p-6 text-xs text-fs-danger-900 bg-fs-danger-100 border-b border-fs-danger-300 flex items-center gap-2"
      >
        <AlertTriangle class="w-4 h-4 text-fs-danger-600 shrink-0" />
        <span>{{ errorMessage }}</span>
      </div>

      <div
        v-else-if="filteredMembers.length === 0"
        class="p-8 text-center text-xs text-fs-muted italic bg-fs-surface"
      >
        Keine passenden Mitbearbeiter:innen gefunden.
      </div>

      <!-- Member Rows -->
      <div v-else class="divide-y divide-fs-primary-200 bg-fs-surface">
        <div
          v-for="m in filteredMembers"
          :key="m.id"
          :class="[
            'p-4 sm:px-5 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4',
            !m.is_active ? 'bg-fs-danger-100/35 opacity-85' : 'hover:bg-fs-primary-100/60'
          ]"
        >
          <!-- Left: Identity + Metadata -->
          <div class="space-y-2 min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <span
                :class="[
                  'w-7 h-7 rounded-full text-white flex items-center justify-center text-xs font-bold shrink-0',
                  !m.is_active ? 'bg-[#cf3a00]' : m.is_super_admin ? 'bg-fs-primary-600' : 'bg-[#64ae24]'
                ]"
              >
                {{ (m.name || m.email || '?')[0].toUpperCase() }}
              </span>

              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-1.5">
                  <span class="font-bold text-sm text-fs-primary-900 truncate">
                    {{ m.name || m.email }}
                  </span>
                  <span
                    v-if="m.id === authState.user?.uid"
                    class="fs-badge-green !text-[10px]"
                  >
                    Du
                  </span>
                  <span
                    v-if="m.is_super_admin"
                    class="fs-badge-ochre !text-[10px]"
                  >
                    <ShieldCheck class="w-3 h-3" />
                    ORGA / Super-Admin
                  </span>
                  <span
                    v-if="!m.is_active"
                    class="fs-badge-red !text-[10px]"
                  >
                    <Ban class="w-3 h-3" />
                    Zugang gesperrt
                  </span>
                  <span
                    v-if="!m.has_user_record"
                    class="fs-badge-gray !text-[10px]"
                  >
                    System-/Alt-Rolle
                  </span>
                </div>
                <div class="text-[11px] text-fs-muted flex flex-wrap items-center gap-x-3 gap-y-0.5">
                  <span>{{ m.email }}</span>
                  <span v-if="m.last_login_at">· Letzter Login: {{ formatDate(m.last_login_at) }}</span>
                  <span v-else>· Angelegt: {{ formatDate(m.created_at) }}</span>
                </div>
              </div>
            </div>

            <!-- Assigned Regional Roles -->
            <div class="flex flex-wrap items-center gap-1.5 pt-0.5">
              <span
                v-if="m.roles.length === 0"
                class="text-[11px] italic text-fs-muted bg-fs-bg border border-fs-primary-200 px-2.5 py-0.5 rounded-full"
              >
                Keine aktiven Regions-Rollen (nur Basis-Konto)
              </span>

              <span
                v-for="r in m.roles"
                :key="`${r.region_id}-${r.role}`"
                :class="[
                  'inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border',
                  r.role === 'ORGA'
                    ? 'bg-fs-warning-100 border-fs-warning-300 text-fs-warning-900'
                    : r.role === 'AMBASSADOR'
                      ? 'bg-fs-primary-200 border-fs-primary-400 text-fs-primary-900'
                      : 'bg-fs-secondary-100 border-fs-secondary-300 text-fs-secondary-900'
                ]"
              >
                <span>{{ r.region_name }} · {{ formatRoleShort(r.role) }}</span>
                <button
                  v-if="canModifyRole(m, r)"
                  type="button"
                  @click="revokeRole(m, r.region_id, r.role, r.region_name)"
                  class="hover:text-[#cf3a00] p-0.5 -mr-1 rounded-full transition-colors cursor-pointer"
                  :title="`Rolle ${formatRoleShort(r.role)} in ${r.region_name} entziehen`"
                >
                  <X class="w-3 h-3" />
                </button>
              </span>

              <button
                v-if="canAddRoleToMember(m)"
                type="button"
                @click="openAddRoleModal(m)"
                class="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border border-dashed border-fs-primary-400 text-fs-primary-800 hover:bg-fs-primary-200/70 transition-colors cursor-pointer"
              >
                <Plus class="w-3 h-3" />
                <span>Rolle zuweisen</span>
              </button>
            </div>
          </div>

          <!-- Right: Account-Level Revocation / Unlock / Delete (ORGA only) -->
          <div v-if="isGlobalAdmin" class="flex flex-wrap items-center gap-2 shrink-0">
            <button
              v-if="m.has_user_record && m.id !== authState.user?.uid"
              type="button"
              @click="toggleMemberActive(m)"
              :class="m.is_active ? 'fs-btn-secondary !py-1.5 !text-fs-danger-700 hover:!bg-fs-danger-100' : 'fs-btn-primary !py-1.5'"
            >
              <Ban v-if="m.is_active" class="w-3.5 h-3.5" />
              <CheckCircle2 v-else class="w-3.5 h-3.5" />
              <span>{{ m.is_active ? 'Zugang sperren' : 'Wieder freigeben' }}</span>
            </button>

            <button
              v-if="m.id !== authState.user?.uid"
              type="button"
              @click="confirmDeleteTarget = m"
              class="fs-btn-danger !py-1.5"
              title="Konto und alle Rollen endgültig entfernen"
            >
              <Trash2 class="w-3.5 h-3.5" />
              <span>Entfernen</span>
            </button>
          </div>
        </div>
      </div>
    </FsContainer>

    <!-- Section B: Invite Links History & Revocation -->
    <FsContainer body-class="p-0">
      <template #icon>
        <Link2 class="w-4 h-4 text-fs-secondary-600" />
      </template>
      <template #title>
        <div class="flex items-center gap-2">
          <h2 class="font-sans text-sm font-bold text-fs-primary-900 m-0">
            Einladungslinks (Offen & Verlauf)
          </h2>
          <span
            v-if="openInvitesCount > 0"
            class="bg-[#64ae24] text-white text-[11px] font-bold px-2 py-0.5 rounded-full leading-none"
          >
            {{ openInvitesCount }} offen
          </span>
        </div>
      </template>

      <div
        v-if="invites.length === 0"
        class="p-7 text-center text-xs text-fs-muted italic bg-fs-surface"
      >
        Bisher wurden noch keine Einladungslinks erstellt.
      </div>

      <div v-else class="overflow-x-auto bg-fs-surface">
        <table class="w-full text-left text-xs">
          <thead class="bg-fs-bg border-b border-fs-primary-200 text-fs-muted font-bold uppercase text-[10px] tracking-wider">
            <tr>
              <th class="p-3.5">Status</th>
              <th class="p-3.5">Zielregion</th>
              <th class="p-3.5">Rolle</th>
              <th class="p-3.5">Erstellt / Gültig bis</th>
              <th class="p-3.5">Eingelöst von</th>
              <th class="p-3.5 text-right">Aktion</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-fs-primary-200/80">
            <tr
              v-for="inv in invites"
              :key="inv.id"
              class="hover:bg-fs-primary-100/60 transition-colors"
            >
              <td class="p-3.5">
                <span v-if="inv.status === 'OPEN'" class="fs-badge-green !text-[10px]">
                  Offen
                </span>
                <span v-else-if="inv.status === 'REDEEMED'" class="fs-badge-brown !text-[10px]">
                  Eingelöst
                </span>
                <span v-else-if="inv.status === 'REVOKED'" class="fs-badge-red !text-[10px]">
                  Widerrufen
                </span>
                <span v-else class="fs-badge-gray !text-[10px]">
                  Abgelaufen
                </span>
              </td>
              <td class="p-3.5 font-semibold text-fs-primary-900">{{ inv.region_name }}</td>
              <td class="p-3.5 text-fs-text">{{ formatRoleShort(inv.target_role) }}</td>
              <td class="p-3.5 text-fs-muted text-[11px]">
                <div>Erstellt: {{ formatDate(inv.created_at) }}</div>
                <div>Bis: {{ formatDate(inv.expires_at) }}</div>
              </td>
              <td class="p-3.5 text-fs-text text-[11px]">
                <span v-if="inv.redeemed_by_email" class="font-semibold text-fs-primary-900">
                  {{ inv.redeemed_by_email }}
                </span>
                <span v-else-if="inv.redeemed_by_user_id" class="font-mono text-fs-muted">
                  {{ inv.redeemed_by_user_id }}
                </span>
                <span v-else class="text-fs-muted italic">—</span>
              </td>
              <td class="p-3.5 text-right">
                <button
                  v-if="inv.status === 'OPEN'"
                  type="button"
                  @click="revokeInvite(inv.id)"
                  class="fs-btn-danger !py-1 !px-2.5 !text-[11px]"
                >
                  <X class="w-3 h-3" />
                  <span>Widerrufen</span>
                </button>
                <span v-else class="text-[11px] text-fs-muted">—</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </FsContainer>

    <!-- Modal: Add Role to Existing Collaborator -->
    <div
      v-if="roleTargetMember"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-xs"
      @click.self="roleTargetMember = null"
    >
      <div class="fs-container shadow-fs w-full max-w-md overflow-hidden">
        <div class="fs-container-header">
          <div class="flex items-center gap-2 font-bold text-sm text-fs-primary-900">
            <ShieldCheck class="w-4 h-4 text-fs-secondary-600" />
            <span>Regions-Rolle zuweisen</span>
          </div>
          <button
            @click="roleTargetMember = null"
            type="button"
            class="text-fs-primary-700 hover:text-fs-danger-600 p-1 rounded-fs cursor-pointer"
          >
            <X class="w-4 h-4" />
          </button>
        </div>

        <form @submit.prevent="submitAddRole" class="p-5 space-y-4 bg-fs-surface text-xs">
          <div class="p-3 rounded-fs bg-fs-bg border border-fs-primary-200">
            <div class="font-bold text-fs-primary-900">{{ roleTargetMember.name }}</div>
            <div class="text-[11px] text-fs-muted">{{ roleTargetMember.email }}</div>
          </div>

          <div>
            <label class="block font-semibold text-fs-primary-800 mb-1">Region / Bezirk</label>
            <select v-model="newRoleRegionId" class="fs-input" required>
              <option v-for="r in assignableRegions" :key="r.id" :value="r.id">
                {{ r.name }}
              </option>
            </select>
          </div>

          <div>
            <label class="block font-semibold text-fs-primary-800 mb-1">Rolle</label>
            <select v-model="newRoleType" class="fs-input" required>
              <option value="WORKGROUP_GIVING_STORES">AG Abgabestellen (Koordination & Pflege)</option>
              <option v-if="isGlobalAdmin" value="AMBASSADOR">Botschafter:in (inkl. regionale Team-Verwaltung)</option>
              <option v-if="isGlobalAdmin" value="ORGA">ORGA / Globaler Super-Admin</option>
            </select>
          </div>

          <div class="flex justify-end gap-2 pt-2 border-t border-fs-primary-200">
            <button @click="roleTargetMember = null" type="button" class="fs-btn-secondary">
              Abbrechen
            </button>
            <button type="submit" :disabled="submittingRole" class="fs-btn-primary">
              <Check class="w-3.5 h-3.5" />
              <span>{{ submittingRole ? 'Speichere...' : 'Rolle vergeben' }}</span>
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal: Confirm Permanent Account Deletion -->
    <div
      v-if="confirmDeleteTarget"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-xs"
      @click.self="confirmDeleteTarget = null"
    >
      <div class="fs-container shadow-fs w-full max-w-md overflow-hidden border-fs-danger-400">
        <div class="fs-container-header !bg-fs-danger-100 !border-fs-danger-300">
          <div class="flex items-center gap-2 font-bold text-sm text-fs-danger-900">
            <AlertTriangle class="w-4 h-4 text-fs-danger-600" />
            <span>Zugang & Konto endgültig entfernen?</span>
          </div>
          <button
            @click="confirmDeleteTarget = null"
            type="button"
            class="text-fs-danger-700 hover:text-fs-danger-900 p-1 rounded-fs cursor-pointer"
          >
            <X class="w-4 h-4" />
          </button>
        </div>

        <div class="p-5 space-y-4 bg-fs-surface text-xs">
          <p class="text-fs-text leading-relaxed">
            Möchtest du das Konto <strong class="text-fs-primary-900">{{ confirmDeleteTarget.email }}</strong> inklusive aller Regions-Rollen unwiderruflich entfernen?
          </p>
          <p class="text-[11px] text-fs-muted bg-fs-bg border border-fs-primary-200 rounded-fs p-3">
            Laufende Browser-Sitzungen dieser Person sind sofort ungültig. Bereits erfasste historische Kontaktprotokolle an Abgabestellen bleiben zur Nachvollziehbarkeit erhalten.
          </p>

          <div class="flex justify-end gap-2 pt-2 border-t border-fs-primary-200">
            <button @click="confirmDeleteTarget = null" type="button" class="fs-btn-secondary">
              Abbrechen
            </button>
            <button @click="executeDeleteMember" type="button" class="fs-btn-danger">
              <Trash2 class="w-3.5 h-3.5" />
              <span>Endgültig entfernen</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import {
  Users,
  UserPlus,
  Search,
  ShieldCheck,
  Ban,
  CheckCircle2,
  Trash2,
  X,
  Plus,
  Link2,
  AlertTriangle,
  Check
} from 'lucide-vue-next';
import { TeamMember, TeamInviteItem, UserRoleType } from '@shared/types';
import { appState, authState, fetchApi, notifySuccess, notifyError } from '../state';
import FsContainer from './FsContainer.vue';

defineEmits<{
  (e: 'openInviteModal'): void;
}>();

const loading = ref(false);
const errorMessage = ref('');
const members = ref<TeamMember[]>([]);
const invites = ref<TeamInviteItem[]>([]);
const isGlobalAdmin = ref(false);
const adminRegionIds = ref<number[]>([]);

const searchQuery = ref('');
const statusFilter = ref<'all' | 'active' | 'revoked'>('all');

const roleTargetMember = ref<TeamMember | null>(null);
const newRoleRegionId = ref<number>(1);
const newRoleType = ref<UserRoleType>(UserRoleType.WORKGROUP_GIVING_STORES);
const submittingRole = ref(false);

const confirmDeleteTarget = ref<TeamMember | null>(null);

const activeCount = computed(() => members.value.filter(m => m.is_active).length);
const revokedCount = computed(() => members.value.filter(m => !m.is_active).length);
const openInvitesCount = computed(() => invites.value.filter(i => i.status === 'OPEN').length);

const assignableRegions = computed(() => {
  if (isGlobalAdmin.value) return appState.regions;
  const allowed = new Set(adminRegionIds.value);
  return appState.regions.filter(r => allowed.has(r.id));
});

const filteredMembers = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  return members.value.filter(m => {
    if (statusFilter.value === 'active' && !m.is_active) return false;
    if (statusFilter.value === 'revoked' && m.is_active) return false;
    if (!q) return true;
    const inBasic =
      m.name.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q);
    const inRoles = m.roles.some(
      r =>
        r.region_name.toLowerCase().includes(q) ||
        formatRoleShort(r.role).toLowerCase().includes(q)
    );
    return inBasic || inRoles;
  });
});

function formatRoleShort(role: string): string {
  if (role === 'ORGA') return 'ORGA';
  if (role === 'AMBASSADOR') return 'Botschafter:in';
  if (role === 'WORKGROUP_GIVING_STORES') return 'AG Abgabestellen';
  if (role === 'ROLE_FOODSAVER') return 'Foodsaver:in';
  return role;
}

function formatDate(raw: string | null): string {
  if (!raw) return '—';
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

function canModifyRole(member: TeamMember, roleEntry: TeamMember['roles'][number]): boolean {
  // Prevent self-removal of own ORGA role
  if (member.id === authState.user?.uid && roleEntry.role === UserRoleType.ORGA) {
    return false;
  }
  if (isGlobalAdmin.value) return true;
  if (member.is_super_admin) return false;
  if (roleEntry.role !== UserRoleType.WORKGROUP_GIVING_STORES) return false;
  return adminRegionIds.value.includes(roleEntry.region_id);
}

function canAddRoleToMember(member: TeamMember): boolean {
  if (isGlobalAdmin.value) return true;
  if (member.is_super_admin) return false;
  return assignableRegions.value.length > 0;
}

function openAddRoleModal(member: TeamMember) {
  roleTargetMember.value = member;
  newRoleRegionId.value = assignableRegions.value[0]?.id || appState.currentRegion?.id || 1;
  newRoleType.value = UserRoleType.WORKGROUP_GIVING_STORES;
}

async function loadTeamData() {
  loading.value = true;
  errorMessage.value = '';
  try {
    const [membersRes, invitesRes] = await Promise.all([
      fetchApi<{ members: TeamMember[]; isGlobalAdmin: boolean; adminRegionIds: number[] }>('/api/team/members'),
      fetchApi<{ invites: TeamInviteItem[] }>('/api/team/invites')
    ]);
    members.value = membersRes.members;
    isGlobalAdmin.value = membersRes.isGlobalAdmin;
    adminRegionIds.value = membersRes.adminRegionIds;
    invites.value = invitesRes.invites;
  } catch (err: any) {
    errorMessage.value = err.message || 'Fehler beim Laden der Mitbearbeiter-Verwaltung.';
  } finally {
    loading.value = false;
  }
}

async function submitAddRole() {
  if (!roleTargetMember.value) return;
  submittingRole.value = true;
  try {
    await fetchApi(`/api/team/members/${encodeURIComponent(roleTargetMember.value.id)}/roles`, {
      method: 'POST',
      body: JSON.stringify({
        region_id: newRoleRegionId.value,
        role: newRoleType.value
      })
    });
    notifySuccess('Rolle erfolgreich zugewiesen.');
    roleTargetMember.value = null;
    await loadTeamData();
  } catch (err: any) {
    notifyError(err.message || 'Fehler beim Zuweisen der Rolle');
  } finally {
    submittingRole.value = false;
  }
}

async function revokeRole(member: TeamMember, regionId: number, role: UserRoleType, regionName: string) {
  try {
    await fetchApi(
      `/api/team/members/${encodeURIComponent(member.id)}/roles?region_id=${regionId}&role=${encodeURIComponent(role)}`,
      { method: 'DELETE' }
    );
    notifySuccess(`Rolle ${formatRoleShort(role)} in ${regionName} wurde entzogen.`);
    await loadTeamData();
  } catch (err: any) {
    notifyError(err.message || 'Fehler beim Entziehen der Rolle');
  }
}

async function toggleMemberActive(member: TeamMember) {
  const nextActive = !member.is_active;
  try {
    await fetchApi(`/api/team/members/${encodeURIComponent(member.id)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active: nextActive })
    });
    notifySuccess(
      nextActive
        ? `Konto ${member.email} wurde wieder freigegeben.`
        : `Zugang für ${member.email} wurde sofort gesperrt.`
    );
    await loadTeamData();
  } catch (err: any) {
    notifyError(err.message || 'Status konnte nicht geändert werden');
  }
}

async function executeDeleteMember() {
  if (!confirmDeleteTarget.value) return;
  const target = confirmDeleteTarget.value;
  try {
    await fetchApi(`/api/team/members/${encodeURIComponent(target.id)}`, {
      method: 'DELETE'
    });
    notifySuccess(`Zugang ${target.email} wurde dauerhaft entfernt.`);
    confirmDeleteTarget.value = null;
    await loadTeamData();
  } catch (err: any) {
    notifyError(err.message || 'Fehler beim Entfernen des Kontos');
  }
}

async function revokeInvite(inviteId: number) {
  try {
    await fetchApi(`/api/team/invites/${inviteId}`, { method: 'DELETE' });
    notifySuccess('Einladungslink wurde widerrufen.');
    await loadTeamData();
  } catch (err: any) {
    notifyError(err.message || 'Einladungslink konnte nicht widerrufen werden');
  }
}

defineExpose({ reload: loadTeamData });

onMounted(() => {
  loadTeamData();
});
</script>
