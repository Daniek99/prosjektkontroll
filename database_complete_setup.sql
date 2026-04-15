-- Complete Database Setup Script
-- This script creates all necessary tables from scratch

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create work_activities table for defining activities
CREATE TABLE IF NOT EXISTS work_activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create daily_manpower table with all columns
CREATE TABLE daily_manpower (
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
  activity_id UUID REFERENCES work_activities(id) ON DELETE SET NULL,
  hours_contract NUMERIC(5,2) DEFAULT 0.0,
  hours_billable NUMERIC(5,2) DEFAULT 0.0,
  change_order_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Enable RLS
ALTER TABLE work_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_manpower ENABLE ROW LEVEL SECURITY;

-- 5. Create policies
CREATE POLICY "Allow authenticated full access to work_activities" 
ON work_activities FOR ALL TO authenticated 
USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated full access to daily_manpower" 
ON daily_manpower FOR ALL TO authenticated 
USING (true) WITH CHECK (true);

-- 6. Insert default activities
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

-- 7. Verify setup
SELECT 'Database setup completed successfully!' as status;