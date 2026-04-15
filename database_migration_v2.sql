-- Database Migration for Activity-Based Time Tracking (Safe Version)
-- This script adds new tables without dropping existing data

-- 1. Create work_activities table for defining activities
CREATE TABLE IF NOT EXISTS work_activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create activity_log table for tracking hours per activity
CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subcontractor_id UUID REFERENCES subcontractors(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  activity_id UUID REFERENCES work_activities(id),
  hours_contract NUMERIC(5,2) NOT NULL DEFAULT 0.0,
  hours_billable NUMERIC(5,2) NOT NULL DEFAULT 0.0,
  change_order_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enable RLS on new tables
ALTER TABLE work_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- 4. Create policies for new tables
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

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'activity_log' 
        AND policyname = 'Allow authenticated full access to activity_log'
    ) THEN
        CREATE POLICY "Allow authenticated full access to activity_log" 
        ON activity_log FOR ALL TO authenticated 
        USING (true) WITH CHECK (true);
    END IF;
END $$;

-- 5. Insert default activities if table is empty
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

-- 6. Verify migration
SELECT 'Migration completed successfully! New tables created without affecting existing data.' as status;