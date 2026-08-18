-- Add onesignal_id column to customers table if not exists
ALTER TABLE customers ADD COLUMN IF NOT EXISTS onesignal_id TEXT;
