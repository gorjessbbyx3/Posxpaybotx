-- ==========================================
-- Migration Version Tracking
-- ==========================================
-- This table tracks which migrations have been applied.
-- Run this FIRST before any migration files.
--
-- Usage:
--   1. Create the version table (this file)
--   2. Before running a migration, check if its version exists
--   3. After running a migration, INSERT its version
--
-- Compatible with MySQL 5.7+, PostgreSQL 9.5+, Derby 10.x
-- ==========================================

CREATE TABLE IF NOT EXISTS schema_version (
    version         INT NOT NULL PRIMARY KEY,
    description     VARCHAR(255) NOT NULL,
    script          VARCHAR(255) NOT NULL,
    applied_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    applied_by      VARCHAR(100) DEFAULT 'system',
    execution_time  INT DEFAULT 0,          -- milliseconds
    checksum        VARCHAR(64),            -- SHA-256 of the script file
    success         BOOLEAN DEFAULT TRUE
);

-- Seed with migration history for existing installations
-- If these migrations were already applied manually, insert their records:

-- Migration 001: Cash Discount & PaybotX Integration
INSERT INTO schema_version (version, description, script, applied_by)
SELECT 1, 'Cash discount and PaybotX terminal integration',
       'migration-cashdiscount-paybotx.sql', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM schema_version WHERE version = 1);

-- Migration 002: Refunds, Time Clock, Held Orders
INSERT INTO schema_version (version, description, script, applied_by)
SELECT 2, 'Refunds, time clock, held orders, delivery, promos',
       'migration-002-refunds-timeclock-held.sql', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM schema_version WHERE version = 2);

-- Migration 003: Gift Cards, Tabs, Inventory
INSERT INTO schema_version (version, description, script, applied_by)
SELECT 3, 'Gift cards, customer tabs, inventory tracking, batch settlement',
       'migration-003-giftcards-tabs-inventory.sql', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM schema_version WHERE version = 3);
