-- ============================================================
-- Migration: Cash Discount & PaybotX Terminal Integration
-- Restaurant POS - Self-Hosted Edition
--
-- Supports: MySQL 5.7+, PostgreSQL 9.5+, Derby 10.x
-- Run this AFTER the base Floreant POS schema is created.
-- ============================================================

-- =============================================
-- 1. Cash Discount Configuration Table
-- =============================================
CREATE TABLE IF NOT EXISTS CASH_DISCOUNT_CONFIG (
    ID INTEGER NOT NULL AUTO_INCREMENT,
    CONFIG_KEY VARCHAR(100) NOT NULL,
    CONFIG_VALUE VARCHAR(500),
    UPDATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (ID),
    UNIQUE (CONFIG_KEY)
);

-- Default cash discount settings
INSERT INTO CASH_DISCOUNT_CONFIG (CONFIG_KEY, CONFIG_VALUE) VALUES
    ('enabled', 'true'),
    ('pricingMode', 'CASH_DISCOUNT'),
    ('rate', '4.0'),
    ('cashDiscountLabel', 'Cash Discount'),
    ('surchargeLabel', 'Non-Cash Adjustment'),
    ('applyBeforeTax', 'true'),
    ('showDualPricing', 'true'),
    ('exemptDebit', 'true'),
    ('minCardAmount', '0');

-- =============================================
-- 2. PaybotX Terminal Configuration Table
-- =============================================
CREATE TABLE IF NOT EXISTS PAYBOTX_TERMINAL (
    ID INTEGER NOT NULL AUTO_INCREMENT,
    TERMINAL_ID VARCHAR(50) NOT NULL,
    MERCHANT_ID VARCHAR(50),
    API_KEY VARCHAR(200),
    IP_ADDRESS VARCHAR(45),
    PORT INTEGER DEFAULT 443,
    SERIAL_NUMBER VARCHAR(100),
    MODEL VARCHAR(50) DEFAULT 'VP8800',
    ACTIVE BOOLEAN DEFAULT TRUE,
    GATEWAY_URL VARCHAR(255) DEFAULT 'https://vt.isoaccess.com',
    CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UPDATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (ID),
    UNIQUE (TERMINAL_ID)
);

-- =============================================
-- 3. PaybotX Batch Settlement Log
-- =============================================
CREATE TABLE IF NOT EXISTS PAYBOTX_BATCH_LOG (
    ID INTEGER NOT NULL AUTO_INCREMENT,
    TERMINAL_ID VARCHAR(50) NOT NULL,
    BATCH_NUMBER VARCHAR(20),
    BATCH_DATE DATE,
    TOTAL_AMOUNT DECIMAL(12,2),
    TRANSACTION_COUNT INTEGER DEFAULT 0,
    STATUS VARCHAR(20) DEFAULT 'PENDING',
    RESPONSE_CODE VARCHAR(10),
    RESPONSE_MESSAGE VARCHAR(255),
    SETTLED_AT TIMESTAMP,
    CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (ID)
);

-- =============================================
-- 4. Offline Payment Queue (Store-and-Forward)
-- =============================================
CREATE TABLE IF NOT EXISTS OFFLINE_PAYMENT_QUEUE (
    ID INTEGER NOT NULL AUTO_INCREMENT,
    TICKET_ID INTEGER NOT NULL,
    PAYMENT_TYPE VARCHAR(20) NOT NULL,
    AMOUNT DECIMAL(12,2) NOT NULL,
    TIP_AMOUNT DECIMAL(12,2) DEFAULT 0,
    CARD_TYPE VARCHAR(20),
    CARD_LAST_FOUR VARCHAR(4),
    AUTH_CODE VARCHAR(20),
    REF_ID VARCHAR(50),
    RETRY_COUNT INTEGER DEFAULT 0,
    MAX_RETRIES INTEGER DEFAULT 10,
    STATUS VARCHAR(20) DEFAULT 'QUEUED',
    ERROR_MESSAGE VARCHAR(500),
    QUEUED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PROCESSED_AT TIMESTAMP,
    PRIMARY KEY (ID)
);

-- =============================================
-- 5. Add cash discount columns to TICKET table
-- =============================================
-- Note: Floreant already has adjustmentAmount on TICKET.
-- We add explicit cash discount tracking columns.
ALTER TABLE TICKET ADD COLUMN IF NOT EXISTS CASH_DISCOUNT_APPLIED BOOLEAN DEFAULT FALSE;
ALTER TABLE TICKET ADD COLUMN IF NOT EXISTS CASH_DISCOUNT_AMOUNT DECIMAL(12,2) DEFAULT 0;
ALTER TABLE TICKET ADD COLUMN IF NOT EXISTS CASH_DISCOUNT_RATE DECIMAL(5,2) DEFAULT 0;
ALTER TABLE TICKET ADD COLUMN IF NOT EXISTS CASH_DISCOUNT_MODE VARCHAR(20);

-- =============================================
-- 6. Add PaybotX columns to TRANSACTIONS table
-- =============================================
ALTER TABLE TRANSACTIONS ADD COLUMN IF NOT EXISTS PAYBOTX_BATCH_NUM VARCHAR(20);
ALTER TABLE TRANSACTIONS ADD COLUMN IF NOT EXISTS PAYBOTX_TERMINAL_ID VARCHAR(50);
ALTER TABLE TRANSACTIONS ADD COLUMN IF NOT EXISTS PAYBOTX_GATEWAY VARCHAR(50);
ALTER TABLE TRANSACTIONS ADD COLUMN IF NOT EXISTS REQUIRES_SIGNATURE BOOLEAN DEFAULT FALSE;

-- =============================================
-- 7. Tip tracking enhancement
-- =============================================
ALTER TABLE TRANSACTIONS ADD COLUMN IF NOT EXISTS TIP_ADJUSTED BOOLEAN DEFAULT FALSE;
ALTER TABLE TRANSACTIONS ADD COLUMN IF NOT EXISTS TIP_ADJUSTED_AT TIMESTAMP;
ALTER TABLE TRANSACTIONS ADD COLUMN IF NOT EXISTS ORIGINAL_TIP_AMOUNT DECIMAL(12,2);

-- =============================================
-- 8. Kitchen Display System performance index
-- =============================================
CREATE INDEX IF NOT EXISTS IDX_KT_STATUS ON KITCHEN_TICKET (STATUS);
CREATE INDEX IF NOT EXISTS IDX_KT_CREATE_DATE ON KITCHEN_TICKET (CREATE_DATE);
CREATE INDEX IF NOT EXISTS IDX_KT_TICKET_ID ON KITCHEN_TICKET (TICKET_ID);

-- =============================================
-- 9. Cash discount audit log
-- =============================================
CREATE TABLE IF NOT EXISTS CASH_DISCOUNT_AUDIT (
    ID INTEGER NOT NULL AUTO_INCREMENT,
    TICKET_ID INTEGER NOT NULL,
    TRANSACTION_ID INTEGER,
    PRICING_MODE VARCHAR(20) NOT NULL,
    RATE DECIMAL(5,2) NOT NULL,
    ORIGINAL_AMOUNT DECIMAL(12,2) NOT NULL,
    ADJUSTED_AMOUNT DECIMAL(12,2) NOT NULL,
    DISCOUNT_AMOUNT DECIMAL(12,2) NOT NULL,
    PAYMENT_TYPE VARCHAR(20) NOT NULL,
    IS_DEBIT_EXEMPT BOOLEAN DEFAULT FALSE,
    CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (ID)
);

CREATE INDEX IF NOT EXISTS IDX_CDA_TICKET ON CASH_DISCOUNT_AUDIT (TICKET_ID);
CREATE INDEX IF NOT EXISTS IDX_CDA_DATE ON CASH_DISCOUNT_AUDIT (CREATED_AT);

-- =============================================
-- 10. Daily Sales Summary (pre-aggregated reporting)
-- =============================================
CREATE TABLE IF NOT EXISTS DAILY_SALES_SUMMARY (
    ID INTEGER NOT NULL AUTO_INCREMENT,
    REPORT_DATE DATE NOT NULL,
    TOTAL_SALES DECIMAL(12,2) DEFAULT 0,
    TOTAL_TAX DECIMAL(12,2) DEFAULT 0,
    TOTAL_TIPS DECIMAL(12,2) DEFAULT 0,
    TOTAL_DISCOUNTS DECIMAL(12,2) DEFAULT 0,
    CASH_SALES DECIMAL(12,2) DEFAULT 0,
    CARD_SALES DECIMAL(12,2) DEFAULT 0,
    CASH_TRANSACTION_COUNT INTEGER DEFAULT 0,
    CARD_TRANSACTION_COUNT INTEGER DEFAULT 0,
    TICKET_COUNT INTEGER DEFAULT 0,
    VOID_COUNT INTEGER DEFAULT 0,
    REFUND_AMOUNT DECIMAL(12,2) DEFAULT 0,
    AVG_TICKET DECIMAL(12,2) DEFAULT 0,
    CASH_DISCOUNT_TOTAL DECIMAL(12,2) DEFAULT 0,
    CARD_SURCHARGE_TOTAL DECIMAL(12,2) DEFAULT 0,
    CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (ID),
    UNIQUE (REPORT_DATE)
);

CREATE INDEX IF NOT EXISTS IDX_DSS_DATE ON DAILY_SALES_SUMMARY (REPORT_DATE);

-- =============================================
-- 11. Hourly Sales Breakdown
-- =============================================
CREATE TABLE IF NOT EXISTS HOURLY_SALES (
    ID INTEGER NOT NULL AUTO_INCREMENT,
    REPORT_DATE DATE NOT NULL,
    HOUR_OF_DAY INTEGER NOT NULL,
    SALES_AMOUNT DECIMAL(12,2) DEFAULT 0,
    TICKET_COUNT INTEGER DEFAULT 0,
    PRIMARY KEY (ID),
    UNIQUE (REPORT_DATE, HOUR_OF_DAY)
);

-- =============================================
-- 12. Tip adjustment audit trail
-- =============================================
CREATE TABLE IF NOT EXISTS TIP_ADJUSTMENT_LOG (
    ID INTEGER NOT NULL AUTO_INCREMENT,
    TICKET_ID INTEGER NOT NULL,
    TRANSACTION_ID INTEGER,
    ORIGINAL_TIP DECIMAL(12,2) DEFAULT 0,
    NEW_TIP DECIMAL(12,2) NOT NULL,
    ADJUSTED_BY INTEGER,
    ADJUSTMENT_SOURCE VARCHAR(20) DEFAULT 'POS',
    CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (ID)
);

CREATE INDEX IF NOT EXISTS IDX_TAL_TICKET ON TIP_ADJUSTMENT_LOG (TICKET_ID);

-- =============================================
-- 13. Ticket performance index
-- =============================================
CREATE INDEX IF NOT EXISTS IDX_TICKET_CREATE_DATE ON TICKET (CREATE_DATE);
CREATE INDEX IF NOT EXISTS IDX_TICKET_CLOSED ON TICKET (SETTLED);
CREATE INDEX IF NOT EXISTS IDX_TICKET_PAID ON TICKET (PAID);

-- =============================================
-- PostgreSQL alternative syntax
-- (uncomment if using PostgreSQL instead of MySQL)
-- =============================================
-- For PostgreSQL, replace:
--   AUTO_INCREMENT  ->  SERIAL
--   BOOLEAN         ->  BOOLEAN (same)
--   IF NOT EXISTS on ALTER TABLE is PostgreSQL 9.6+ only
--   Use: ALTER TABLE TICKET ADD COLUMN IF NOT EXISTS ...

-- =============================================
-- Derby alternative syntax
-- (uncomment if using embedded Derby)
-- =============================================
-- For Derby, CREATE TABLE IF NOT EXISTS is not supported.
-- Use a check before each CREATE:
--   CREATE TABLE CASH_DISCOUNT_CONFIG (...)
-- And ALTER TABLE ADD COLUMN syntax is different:
--   ALTER TABLE TICKET ADD COLUMN CASH_DISCOUNT_APPLIED SMALLINT DEFAULT 0
