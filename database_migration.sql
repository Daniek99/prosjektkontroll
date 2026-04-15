-- Database Migration for Activity-Based Time Tracking
-- This script updates the schema to support activities and hours-based logging

-- 1. Create work_activities table
CREATE TABLE IF NOT EXISTS work_activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create activity_log table (replaces daily_manpower)
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

-- 3. Insert default activities
INSERT INTO work_activities (name, description) VALUES
('Byggearbeid', 'Generell byggearbeid og konstruksjon'),
('Tømming', 'Tømming og avfallshandtering'),
('Maling', 'Maling og ytbehandling'),
('Elektroarbeid', 'Elektrisk installasjon og vedlikehold'),
('Rørleggerarbeid', 'VVS- og sanitærinstallasjoner'),
('Gulvlegging', 'Gulvbehandling og -legging'),
('Taktekking', 'Takbehandling og -montering'),
('Vinduer og dører', 'Montering og justering av vinduer/dører'),
('Isolasjon', 'Varme- og lydisolasjon'),
('Annet', 'Annet arbeid ikke kategorisert ovenfor');

-- 4. Drop old daily_manpower table
DROP TABLE IF EXISTS daily_manpower;

-- 5. Update RLS policies
ALTER TABLE work_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- 6. Create relaxed policies for Authenticated Users
CREATE POLICY "Allow authenticated full access to work_activities" ON work_activities FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access to activity_log" ON activity_log FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 7. Migration confirmation
SELECT 'Database migration completed successfully!';