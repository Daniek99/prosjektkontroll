-- Add "company" column to contacts table for "Firma" field
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS company TEXT;
