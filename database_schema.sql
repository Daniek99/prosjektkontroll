-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Drop existing tables to refresh (optional, but safe for new project)
DROP TABLE IF EXISTS contract_items CASCADE;
DROP TABLE IF EXISTS risks CASCADE;
DROP TABLE IF EXISTS rfis CASCADE;
DROP TABLE IF EXISTS activity_log CASCADE;
DROP TABLE IF EXISTS work_activities CASCADE;
DROP TABLE IF EXISTS change_orders CASCADE;
DROP TABLE IF EXISTS progress_photos CASCADE;
DROP TABLE IF EXISTS subcontractors CASCADE;

-- 3. Create Subcontractors Table (The core tenant)
CREATE TABLE subcontractors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_name TEXT NOT NULL,
  trade TEXT NOT NULL,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  original_contract_value NUMERIC(15,2) DEFAULT 0,
  org_number TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create Contract Items Table (Mengdebeskrivelse)
CREATE TABLE contract_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subcontractor_id UUID REFERENCES subcontractors(id) ON DELETE CASCADE,
  item_number TEXT,
  description TEXT NOT NULL,
  quantity NUMERIC(15,2) DEFAULT 0,
  unit TEXT,
  unit_price NUMERIC(15,2) DEFAULT 0,
  total_price NUMERIC(15,2) DEFAULT 0,
  is_option BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Create Progress Photos Table
CREATE TABLE progress_photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subcontractor_id UUID REFERENCES subcontractors(id) ON DELETE CASCADE,
  area TEXT NOT NULL,
  photo_url TEXT NOT NULL,
  notes TEXT,
  date TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Create Change Orders Table (Endringsmeldinger)
CREATE TABLE change_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subcontractor_id UUID REFERENCES subcontractors(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  amount NUMERIC(15,2) DEFAULT 0,
  status TEXT DEFAULT 'open', -- open, approved, rejected
  date TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Create Work Activities Table
CREATE TABLE work_activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Create Activity Log Table (replaces daily_manpower)
CREATE TABLE activity_log (
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

-- 9. Create RFIs Table (Informasjonsforespørsler)
CREATE TABLE rfis (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subcontractor_id UUID REFERENCES subcontractors(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT,
  status TEXT DEFAULT 'open', -- open, closed
  date_submitted TIMESTAMPTZ DEFAULT NOW(),
  date_resolved TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Create Risks Table
CREATE TABLE risks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subcontractor_id UUID REFERENCES subcontractors(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  probability TEXT NOT NULL, -- Low, Med, High
  impact TEXT NOT NULL, -- Low, Med, High
  mitigation TEXT,
  status TEXT DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Create Diary (Dagbok) Table
CREATE TABLE diary_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subcontractor_id UUID REFERENCES subcontractors(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  content TEXT NOT NULL,
  weather TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Enable Row Level Security (RLS) on all tables
ALTER TABLE subcontractors ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE change_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfis ENABLE ROW LEVEL SECURITY;
ALTER TABLE risks ENABLE ROW LEVEL SECURITY;
ALTER TABLE diary_entries ENABLE ROW LEVEL SECURITY;

-- 13. Create relaxed policies for Authenticated Users (Internal GC Staff)
-- In a real app, you would lock this down tighter, but for the MVP this allows the GC to do everything.
CREATE POLICY "Allow authenticated full access to subcontractors" ON subcontractors FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access to contract_items" ON contract_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access to progress_photos" ON progress_photos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access to change_orders" ON change_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access to work_activities" ON work_activities FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access to activity_log" ON activity_log FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access to rfis" ON rfis FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access to risks" ON risks FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access to diary_entries" ON diary_entries FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 14. Create Storage Bucket for Progress Photos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('photos', 'photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies for Photos Bucket
CREATE POLICY "Allow public viewing of photos" ON storage.objects FOR SELECT TO public USING (bucket_id = 'photos');
CREATE POLICY "Allow authenticated uploads to photos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'photos');
CREATE POLICY "Allow authenticated deletes of photos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'photos');

-- 15. Migration patches (if applying to existing database)
-- ALTER TABLE subcontractors ADD COLUMN IF NOT EXISTS org_number TEXT;
-- ALTER TABLE contract_items ADD COLUMN IF NOT EXISTS is_option BOOLEAN DEFAULT false;
-- CREATE TABLE IF NOT EXISTS diary_entries ( id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), subcontractor_id UUID REFERENCES subcontractors(id) ON DELETE CASCADE, date DATE NOT NULL DEFAULT CURRENT_DATE, content TEXT NOT NULL, weather TEXT, created_by UUID REFERENCES auth.users(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW() );
-- ALTER TABLE diary_entries ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow authenticated full access to diary_entries" ON diary_entries FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Phase 6 Migrations
-- ALTER TABLE progress_photos DROP CONSTRAINT IF EXISTS progress_photos_subcontractor_id_area_key;
-- CREATE TABLE IF NOT EXISTS progress_tasks ( id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), subcontractor_id UUID REFERENCES subcontractors(id) ON DELETE CASCADE, task_name TEXT NOT NULL, start_date DATE, end_date DATE, status TEXT DEFAULT 'planned' );
-- ALTER TABLE progress_tasks ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow authenticated full access to progress_tasks" ON progress_tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Phase 7 Migrations
-- CREATE TABLE IF NOT EXISTS project_areas ( id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), subcontractor_id UUID REFERENCES subcontractors(id) ON DELETE CASCADE, building TEXT NOT NULL, floor TEXT, zone TEXT, description TEXT );
-- ALTER TABLE project_areas ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow authenticated full access to project_areas" ON project_areas FOR ALL TO authenticated USING (true) WITH CHECK (true);
-- CREATE TABLE IF NOT EXISTS floor_plans ( id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), area_id UUID REFERENCES project_areas(id) ON DELETE CASCADE, name TEXT NOT NULL, file_url TEXT NOT NULL );
-- ALTER TABLE floor_plans ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow authenticated full access to floor_plans" ON floor_plans FOR ALL TO authenticated USING (true) WITH CHECK (true);
-- ALTER TABLE progress_photos ADD COLUMN IF NOT EXISTS area_id UUID REFERENCES project_areas(id) ON DELETE SET NULL;
-- ALTER TABLE progress_tasks ADD COLUMN IF NOT EXISTS document_url TEXT;

-- Phase 8 Migrations
-- CREATE TABLE IF NOT EXISTS project_progress_grid ( id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), subcontractor_id UUID REFERENCES subcontractors(id) ON DELETE CASCADE UNIQUE, grid_data JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT NOW() );
-- ALTER TABLE project_progress_grid ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow authenticated full access to project_progress_grid" ON project_progress_grid FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Phase 9 Migrations: Global Project Areas Setup
-- Global Areas table
CREATE TABLE IF NOT EXISTS global_areas ( id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), building TEXT NOT NULL, floor TEXT, zone TEXT, description TEXT, created_at TIMESTAMPTZ DEFAULT NOW() );
ALTER TABLE global_areas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated full access to global_areas" ON global_areas FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Mapping Table to link global areas with subcontractors
CREATE TABLE IF NOT EXISTS subcontractor_areas ( subcontractor_id UUID REFERENCES subcontractors(id) ON DELETE CASCADE, global_area_id UUID REFERENCES global_areas(id) ON DELETE CASCADE, PRIMARY KEY (subcontractor_id, global_area_id) );
ALTER TABLE subcontractor_areas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated full access to subcontractor_areas" ON subcontractor_areas FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Phase 10 Migrations: User Tasks and Contacts
-- ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS contract_workers INTEGER DEFAULT 0;
-- ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS billable_workers INTEGER DEFAULT 0;
-- ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS billable_comment TEXT;

-- CREATE TABLE IF NOT EXISTS user_tasks ( id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, subcontractor_id UUID REFERENCES subcontractors(id) ON DELETE CASCADE, title TEXT NOT NULL, description TEXT, is_completed BOOLEAN DEFAULT false, is_starred BOOLEAN DEFAULT false, due_date DATE, order_index INTEGER DEFAULT 0, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW() );
-- ALTER TABLE user_tasks ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Users can manage their own tasks" ON user_tasks FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- CREATE TABLE IF NOT EXISTS contacts ( id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), name TEXT NOT NULL, role TEXT, email TEXT NOT NULL, phone TEXT, subcontractor_id UUID REFERENCES subcontractors(id) ON DELETE SET NULL, created_by UUID REFERENCES auth.users(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW() );
-- CREATE POLICY "Allow authenticated full access to contacts" ON contacts FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Phase 11 Migrations: Decision Logs
-- CREATE TABLE IF NOT EXISTS decision_logs ( id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), subcontractor_id UUID REFERENCES subcontractors(id) ON DELETE SET NULL, area_id UUID REFERENCES global_areas(id) ON DELETE SET NULL, subject TEXT NOT NULL, content TEXT, date DATE NOT NULL DEFAULT CURRENT_DATE, created_by UUID REFERENCES auth.users(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW() );
-- ALTER TABLE decision_logs ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow authenticated full access to decision_logs" ON decision_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);