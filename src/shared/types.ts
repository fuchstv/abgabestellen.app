// Shared TypeScript types for abgabestellen.app (1:1 foodsharing-dev/foodsharing compatible)

export enum GivingStatus {
  CURRENT = 1,   // Aktuell (grün)
  IN_REVIEW = 2, // In Aktualisierung (gelb)
  PAUSED = 3     // Außer Betrieb (grau)
}

export enum StoreStatus {
  COOPERATION = 5,       // Aktiv / Kooperation besteht
  PERMANENTLY_CLOSED = 6 // Dauerhaft geschlossen
}

export enum StoreCategoryType {
  GIVING = 1 // Abgabestelle / Soziale Einrichtung
}

export enum SuggestionStatus {
  PENDING = 0,
  APPROVED = 1,
  REJECTED = 2
}

export enum UserRoleType {
  FOODSAVER = 'ROLE_FOODSAVER',
  WORKGROUP_GIVING_STORES = 'WORKGROUP_GIVING_STORES',
  AMBASSADOR = 'AMBASSADOR',
  ORGA = 'ORGA'
}

export interface Region {
  id: number;
  parent_id: number | null;
  name: string;
  type: number; // 1 = City/Landesbezirk, 2 = District/Bezirk, 3 = Neighborhood/Kiez
  lat: number | null;
  lon: number | null;
  external_fs_bezirk_id: number | null;
  created_at: string;
}

export interface RegionTreeItem extends Region {
  children?: RegionTreeItem[];
}

// 1:1 with fs_store_giving_details
export interface GivingStoreDetails {
  store_id: number;
  public_contact_name: string;
  public_phone: string;
  website: string;
  dropoff_times: string | null;
  accepted_items: string | null;
  registration_required: number; // 0 = false, 1 = true
  recipient_count: string;
  giving_status: GivingStatus;
  last_contact_at: string | null;
  updated_at: string;
}

// Public Store (Sanitized - no ansprechpartner, telefon, or internal logs)
export interface PublicStore {
  id: number;
  bezirk_id: number;
  name: string;
  str: string;
  plz: string;
  stadt: string;
  lat: number;
  lon: number;
  public_info: string;
  betrieb_status_id: StoreStatus;
  betrieb_kategorie_id: StoreCategoryType;
  external_fs_betrieb_id: number | null;
  created_at: string;
  updated_at: string;
  giving_details: GivingStoreDetails;
  region_name?: string;
}

// Internal Store (Elevated managers only: includes ansprechpartner, telefon, and contact logs)
export interface InternalStore extends PublicStore {
  ansprechpartner: string; // STRICTLY INTERNAL CONFIDENTIAL
  telefon: string;         // STRICTLY INTERNAL CONFIDENTIAL
  contact_logs?: ContactLogEntry[];
}

export interface ContactLogEntry {
  id: number;
  store_id: number;
  author_user_id: string;
  author_name: string;
  channel: 'Telefon' | 'E-Mail' | 'Vor Ort' | 'Messenger' | 'Sonstiges';
  contact_person: string;
  note: string;
  confirmed_current: number; // 0 or 1
  contacted_at: string;
  created_at: string;
}

export interface GivingStoreSuggestionPayload {
  name?: string | null;
  street?: string | null;
  postalCode?: string | null;
  city?: string | null;
  lat?: number | null;
  lon?: number | null;
  publicInfo?: string | null;
  publicContactName?: string | null;
  publicPhone?: string | null;
  website?: string | null;
  dropoffTimes?: string | null;
  acceptedItems?: string | null;
  registrationRequired?: boolean | null;
  recipientCount?: string | null;
  givingStatus?: GivingStatus | null;
  permanentlyClosed?: boolean | null;
  internalContactName?: string | null;
}

export interface GivingStoreSuggestion {
  id: number;
  region_id: number;
  store_id: number | null;
  author_user_id: string;
  author_email: string;
  reviewed_by_user_id: string | null;
  status: SuggestionStatus;
  payload: GivingStoreSuggestionPayload;
  author_note: string | null;
  review_note: string | null;
  created_at: string;
  reviewed_at: string | null;
  region_name?: string;
  store_name?: string | null;
}

export interface UserRegionRole {
  user_id: string;
  region_id: number;
  role: UserRoleType;
  created_at: string;
}

export interface AuthUser {
  uid: string;
  email: string;
  name?: string;
  isSuperAdmin?: boolean;
}
