-- Database Recovery Script
-- This script restores the daily_manpower table if it was accidentally deleted

-- 1. Check if daily_manpower table exists, if not recreate it
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

-- 2. Enable RLS on daily_manpower if not already enabled
ALTER TABLE daily_manpower ENABLE ROW LEVEL SECURITY;

-- 3. Create policy if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'daily_manpower' 
        AND policyname = 'Allow authenticated full access to daily_manpower'
    ) THEN
        CREATE POLICY "Allow authenticated full access to daily_manpower" 
        ON daily_manpower FOR ALL TO authenticated 
        USING (true) WITH CHECK (true);
    END IF;
END $$;

-- 4. Drop the activity_log and work_activities tables if they were created
DROP TABLE IF EXISTS activity_log CASCADE;
DROP TABLE IF EXISTS work_activities CASCADE;

-- 5. Verify recovery
SELECT 'Database recovery completed! daily_manpower table has been restored.' as status;