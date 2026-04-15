-- Safe Database Migration - Add activity tracking to existing daily_manpower table
-- This script adds new columns without dropping any existing data

-- 1. Add new columns to daily_manpower table for activity tracking
ALTER TABLE daily_manpower ADD COLUMN IF NOT EXISTS activity_id UUID;
ALTER TABLE daily_manpower ADD COLUMN IF NOT EXISTS hours_contract NUMERIC(5,2) DEFAULT 0.0;
ALTER TABLE daily_manpower ADD COLUMN IF NOT EXISTS hours_billable NUMERIC(5,2) DEFAULT 0.0;
ALTER TABLE daily_manpower ADD COLUMN IF NOT EXISTS change_order_number TEXT;

-- 2. Create work_activities table for defining activities
CREATE TABLE IF NOT EXISTS work_activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Add foreign key constraint (safely)
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

-- 4. Enable RLS on work_activities
ALTER TABLE work_activities ENABLE ROW LEVEL SECURITY;

-- 5. Create policy for work_activities
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'work_activities' 
        AND policyname = 'Allow authenticated full access to work_activities'
    ) THEN
        CREATE POLICY "Allow authenticated full access to work_activities" 
        ON work_activities FOR ALL TO authenticated 
        USING (true) WITH CHECK (true);
    END IF;
END $$;

-- 6. Insert default activities if table is empty
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

-- 7. Verify migration
SELECT 'Migration completed successfully! Activity tracking columns added to daily_manpower.' as status;