-- Add columns to customers table for address and two sets of contact information
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS manager_name TEXT,
ADD COLUMN IF NOT EXISTS manager_phone TEXT,
ADD COLUMN IF NOT EXISTS manager_email TEXT,
ADD COLUMN IF NOT EXISTS manager_name_2 TEXT,
ADD COLUMN IF NOT EXISTS manager_phone_2 TEXT,
ADD COLUMN IF NOT EXISTS manager_email_2 TEXT;
