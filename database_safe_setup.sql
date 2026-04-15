-- Safe Database Setup Script
-- This script creates tables and policies safely, handling existing objects

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create work_activities table for defining activities (if not exists)
CREATE TABLE IF NOT EXISTS work_activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create daily_manpower table (if not exists)
CREATE TABLE IF NOT EXISTS daily_manpower (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subcontractor_id UUID,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  workers_count INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  is_contract_work BOOLEAN DEFAULT true,
  comment TEXT,
  contract_workers INTEGER DEFAULT 0,
  billable_workers INTEGER DEFAULT 0,
  billable_comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Add new columns to daily_manpower if they don't exist
DO $$
BEGIN
    -- Add activity_id column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'daily_manpower' AND column_name = 'activity_id'
    ) THEN
        ALTER TABLE daily_manpower ADD COLUMN activity_id UUID;
    END IF;

    -- Add hours_contract column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'daily_manpower' AND column_name = 'hours_contract'
    ) THEN
        ALTER TABLE daily_manpower ADD COLUMN hours_contract NUMERIC(5,2) DEFAULT 0.0;
    END IF;

    -- Add hours_billable column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'daily_manpower' AND column_name = 'hours_billable'
    ) THEN
        ALTER TABLE daily_manpower ADD COLUMN hours_billable NUMERIC(5,2) DEFAULT 0.0;
    END IF;

    -- Add change_order_number column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'daily_manpower' AND column_name = 'change_order_number'
    ) THEN
        ALTER TABLE daily_manpower ADD COLUMN change_order_number TEXT;
    END IF;
END $$;

-- 5. Add foreign key constraint safely
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'daily_manpower_activity_id_fkey' 
        AND table_name = 'daily_manpower'
    ) THEN
        ALTER TABLE daily_manpower 
        ADD CONSTRAINT daily_manpower_activity_id_fkey 
        FOREIGN KEY (activity_id) REFERENCES work_activities(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 6. Enable RLS (safe to run multiple times)
ALTER TABLE work_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_manpower ENABLE ROW LEVEL SECURITY;

-- 7. Create policies safely (drop if exists first)
DROP POLICY IF EXISTS "Allow authenticated full access to work_activities" ON work_activities;
DROP POLICY IF EXISTS "Allow authenticated full access to daily_manpower" ON daily_manpower;

CREATE POLICY "Allow authenticated full access to work_activities" 
ON work_activities FOR ALL TO authenticated 
USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated full access to daily_manpower" 
ON daily_manpower FOR ALL TO authenticated 
USING (true) WITH CHECK (true);

-- 8. Insert default activities if table is empty
INSERT INTO work_activities (name, description)
SELECT * FROM (
    VALUES
        ('Byggearbeid', 'Generell byggearbeid og konstruksjon'),
        ('Tømming', 'Tømming og avfallshandtering'),
        ('Maling', 'Maling og ytbehandling'),
        ('Elektroarbeid', 'Elektrisk installasjon og vedlikehold'),
        ('Rørleggerarbeid', 'VVS- og sanitærinstallasjoner'),
        ('Gulvlegging', 'Gulvbehandling og -legging'),
        ('Taktekking', 'Takbehandling og -montering'),
        ('Vinduer og dører', 'Montering og justering av vinduer/dører'),
        ('Isolasjon', 'Varme- og lydisolasjon'),
        ('Annet', 'Annet arbeid ikke kategorisert ovenfor')
) AS t(name, description)
WHERE NOT EXISTS (SELECT 1 FROM work_activities LIMIT 1);

-- 9. Verify setup
SELECT 'Database setup completed successfully!' as status;