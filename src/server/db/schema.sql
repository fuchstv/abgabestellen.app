-- Canonical SQLite Schema for abgabestellen.app (1:1 with foodsharing-dev/foodsharing)
PRAGMA foreign_keys = ON;

-- 1. REGIONS HIERARCHY (fs_bezirk)
CREATE TABLE IF NOT EXISTS `fs_bezirk` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `parent_id` INTEGER NULL REFERENCES `fs_bezirk`(`id`) ON DELETE SET NULL,
  `name` TEXT NOT NULL,
  `type` INTEGER NOT NULL DEFAULT 1, -- 1=City/Landesbezirk, 2=District, 3=Neighborhood/Kiez
  `lat` REAL NULL,
  `lon` REAL NULL,
  `external_fs_bezirk_id` INTEGER NULL UNIQUE,
  `created_at` TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS `idx_fs_bezirk_parent` ON `fs_bezirk`(`parent_id`);
CREATE INDEX IF NOT EXISTS `idx_fs_bezirk_external` ON `fs_bezirk`(`external_fs_bezirk_id`);

-- 2. REGION CLOSURE TABLE (for fast deep ancestor & descendant lookup)
CREATE TABLE IF NOT EXISTS `fs_bezirk_closure` (
  `ancestor_id` INTEGER NOT NULL REFERENCES `fs_bezirk`(`id`) ON DELETE CASCADE,
  `descendant_id` INTEGER NOT NULL REFERENCES `fs_bezirk`(`id`) ON DELETE CASCADE,
  `depth` INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (`ancestor_id`, `descendant_id`)
);

-- 3. CORE STORE ENTITY (fs_betrieb)
CREATE TABLE IF NOT EXISTS `fs_betrieb` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `bezirk_id` INTEGER NOT NULL REFERENCES `fs_bezirk`(`id`),
  `name` TEXT NOT NULL,
  `str` TEXT NOT NULL DEFAULT '',
  `plz` TEXT NOT NULL DEFAULT '',
  `stadt` TEXT NOT NULL DEFAULT '',
  `lat` REAL NOT NULL DEFAULT 0.0,
  `lon` REAL NOT NULL DEFAULT 0.0,
  `public_info` TEXT NOT NULL DEFAULT '',
  `ansprechpartner` TEXT NOT NULL DEFAULT '', -- STRICTLY INTERNAL CONFIDENTIAL
  `telefon` TEXT NOT NULL DEFAULT '',          -- STRICTLY INTERNAL CONFIDENTIAL
  `betrieb_status_id` INTEGER NOT NULL DEFAULT 5, -- 5=COOPERATION_ESTABLISHED, 6=PERMANENTLY_CLOSED
  `betrieb_kategorie_id` INTEGER NOT NULL DEFAULT 1, -- 1=GIVING
  `external_fs_betrieb_id` INTEGER NULL UNIQUE,
  `created_at` TEXT NOT NULL DEFAULT (datetime('now')),
  `updated_at` TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS `idx_fs_betrieb_bezirk` ON `fs_betrieb`(`bezirk_id`);
CREATE INDEX IF NOT EXISTS `idx_fs_betrieb_geo` ON `fs_betrieb`(`lat`, `lon`);
CREATE INDEX IF NOT EXISTS `idx_fs_betrieb_status` ON `fs_betrieb`(`betrieb_status_id`);

-- 4. 1:1 DROP-OFF EXTENSION TABLE (fs_store_giving_details)
CREATE TABLE IF NOT EXISTS `fs_store_giving_details` (
  `store_id` INTEGER PRIMARY KEY REFERENCES `fs_betrieb`(`id`) ON DELETE CASCADE,
  `public_contact_name` TEXT NOT NULL DEFAULT '',
  `public_phone` TEXT NOT NULL DEFAULT '',
  `website` TEXT NOT NULL DEFAULT '',
  `dropoff_times` TEXT NULL DEFAULT NULL,
  `accepted_items` TEXT NULL DEFAULT NULL,
  `registration_required` INTEGER NOT NULL DEFAULT 0, -- 0=No, 1=Yes
  `recipient_count` TEXT NOT NULL DEFAULT '',
  `giving_status` INTEGER NOT NULL DEFAULT 1, -- 1=CURRENT, 2=IN_REVIEW, 3=PAUSED
  `last_contact_at` TEXT NULL DEFAULT NULL,
  `updated_at` TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS `idx_fs_giving_status` ON `fs_store_giving_details`(`giving_status`);
CREATE INDEX IF NOT EXISTS `idx_fs_giving_reg` ON `fs_store_giving_details`(`registration_required`);
CREATE INDEX IF NOT EXISTS `idx_fs_giving_last_contact` ON `fs_store_giving_details`(`last_contact_at`);

-- 5. SUGGESTIONS & CHANGE REPORTS (fs_store_giving_suggestion)
CREATE TABLE IF NOT EXISTS `fs_store_giving_suggestion` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `region_id` INTEGER NOT NULL REFERENCES `fs_bezirk`(`id`),
  `store_id` INTEGER NULL REFERENCES `fs_betrieb`(`id`) ON DELETE SET NULL,
  `author_user_id` TEXT NOT NULL,
  `author_email` TEXT NOT NULL DEFAULT '',
  `reviewed_by_user_id` TEXT NULL,
  `status` INTEGER NOT NULL DEFAULT 0, -- 0=PENDING, 1=APPROVED, 2=REJECTED
  `payload` TEXT NOT NULL, -- JSON string GivingStoreSuggestionPayload
  `author_note` TEXT NULL,
  `review_note` TEXT NULL,
  `created_at` TEXT NOT NULL DEFAULT (datetime('now')),
  `reviewed_at` TEXT NULL
);
CREATE INDEX IF NOT EXISTS `idx_fs_suggestion_region_status` ON `fs_store_giving_suggestion`(`region_id`, `status`);
CREATE INDEX IF NOT EXISTS `idx_fs_suggestion_store` ON `fs_store_giving_suggestion`(`store_id`);

-- 6. INTERNAL CONTACT & VERIFICATION AUDIT LOG (fs_store_contact_log)
CREATE TABLE IF NOT EXISTS `fs_store_contact_log` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `store_id` INTEGER NOT NULL REFERENCES `fs_betrieb`(`id`) ON DELETE CASCADE,
  `author_user_id` TEXT NOT NULL,
  `author_name` TEXT NOT NULL DEFAULT '',
  `channel` TEXT NOT NULL DEFAULT 'Telefon',
  `contact_person` TEXT NOT NULL DEFAULT '',
  `note` TEXT NOT NULL,
  `confirmed_current` INTEGER NOT NULL DEFAULT 0,
  `contacted_at` TEXT NOT NULL,
  `created_at` TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS `idx_fs_contact_store` ON `fs_store_contact_log`(`store_id`, `contacted_at`);

-- 7. USER REGION ROLES (fs_user_roles)
CREATE TABLE IF NOT EXISTS `fs_user_roles` (
  `user_id` TEXT NOT NULL,
  `region_id` INTEGER NOT NULL REFERENCES `fs_bezirk`(`id`) ON DELETE CASCADE,
  `role` TEXT NOT NULL, -- ROLE_FOODSAVER, WORKGROUP_GIVING_STORES, AMBASSADOR, ORGA
  `created_at` TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (`user_id`, `region_id`, `role`)
);
CREATE INDEX IF NOT EXISTS `idx_fs_user_roles_user` ON `fs_user_roles`(`user_id`);

-- 8. CRYPTOGRAPHIC INVITE TOKENS (fs_invite_token)
CREATE TABLE IF NOT EXISTS `fs_invite_token` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `token_hash` TEXT NOT NULL UNIQUE,
  `region_id` INTEGER NOT NULL REFERENCES `fs_bezirk`(`id`),
  `target_role` TEXT NOT NULL DEFAULT 'WORKGROUP_GIVING_STORES',
  `created_by_user_id` TEXT NOT NULL,
  `redeemed_by_user_id` TEXT NULL,
  `expires_at` TEXT NOT NULL,
  `redeemed_at` TEXT NULL,
  `created_at` TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 9. REGIONAL UPDATES & SUBSCRIBABLE FEED (GIVING_STORES_UPDATES)
CREATE TABLE IF NOT EXISTS `fs_store_updates_feed` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `region_id` INTEGER NOT NULL REFERENCES `fs_bezirk`(`id`),
  `store_id` INTEGER NOT NULL REFERENCES `fs_betrieb`(`id`) ON DELETE CASCADE,
  `author_user_id` TEXT NOT NULL,
  `title` TEXT NOT NULL,
  `content` TEXT NOT NULL,
  `update_type` TEXT NOT NULL DEFAULT 'CHANGE', -- CREATED, SCHEDULE_CHANGE, PAUSED, VERIFIED
  `created_at` TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS `idx_feed_region` ON `fs_store_updates_feed`(`region_id`, `created_at`);

-- 10. DISTRICT EMAIL SUBSCRIBERS
CREATE TABLE IF NOT EXISTS `fs_district_subscribers` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `region_id` INTEGER NOT NULL REFERENCES `fs_bezirk`(`id`),
  `email` TEXT NOT NULL,
  `verified` INTEGER NOT NULL DEFAULT 0,
  `token` TEXT NOT NULL UNIQUE,
  `created_at` TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (`region_id`, `email`)
);
