-- Safe Database Setup Script with Subcontractor-specific Activities
-- This script creates tables and policies safely, handling existing objects

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create work_activities table for subcontractor-specific activities
CREATE TABLE IF NOT EXISTS work_activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subcontractor_id UUID REFERENCES subcontractors(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  change_order_number TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(subcontractor_id, name)
);

-- 3. Create daily_manpower table (if not exists)
CREATE TABLE IF NOT EXISTS daily_manpower (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subcontractor_id UUID REFERENCES subcontractors(id) ON DELETE CASCADE,
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
        ALTER TABLE daily_manpower ADD COLUMN activity_id UUID REFERENCES work_activities(id) ON DELETE SET NULL;
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
END $$;

-- 4b. Add change_order_number to work_activities if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'work_activities' AND column_name = 'change_order_number'
    ) THEN
        ALTER TABLE work_activities ADD COLUMN change_order_number TEXT;
    END IF;
END $$;

-- 5. Enable RLS (safe to run multiple times)
ALTER TABLE work_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_manpower ENABLE ROW LEVEL SECURITY;

-- 6. Create policies safely (drop if exists first)
DROP POLICY IF EXISTS "Allow authenticated full access to work_activities" ON work_activities;
DROP POLICY IF EXISTS "Allow authenticated full access to daily_manpower" ON daily_manpower;

CREATE POLICY "Allow authenticated full access to work_activities" 
ON work_activities FOR ALL TO authenticated 
USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated full access to daily_manpower" 
ON daily_manpower FOR ALL TO authenticated 
USING (true) WITH CHECK (true);

-- 7. Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_work_activities_subcontractor ON work_activities(subcontractor_id);
CREATE INDEX IF NOT EXISTS idx_daily_manpower_subcontractor ON daily_manpower(subcontractor_id);
CREATE INDEX IF NOT EXISTS idx_daily_manpower_activity ON daily_manpower(activity_id);

-- 8. Verify setup
SELECT 'Database setup completed successfully! Activities are now subcontractor-specific.' as status;