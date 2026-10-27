-- ============================================================================
-- Multi-project + user management migration
-- ----------------------------------------------------------------------------
-- Adds:
--   * projects (building projects)
--   * user_profiles (master / user roles)
--   * project_members (which users can access which projects)
--   * user_dataset_permissions (which modules/datasets a user can access)
--   * project_id on every data table
--   * request-header scoped RLS (x-project-id) so the frontend automatically
--     reads/writes only the currently selected project's data.
--   * triggers that auto-populate project_id on insert.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------------------
-- 1. Core tables
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'user', -- 'master' | 'user'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_members (
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member', -- 'owner' | 'member'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (project_id, user_id)
);

CREATE TABLE IF NOT EXISTS user_dataset_permissions (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  dataset TEXT NOT NULL,
  can_access BOOLEAN NOT NULL DEFAULT true,
  PRIMARY KEY (user_id, project_id, dataset)
);

-- ----------------------------------------------------------------------------
-- 2. Add project_id to every data table
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'subcontractors',
    'contract_items',
    'progress_photos',
    'change_orders',
    'rfis',
    'risks',
    'diary_entries',
    'project_progress_grid',
    'global_areas',
    'subcontractor_areas',
    'contacts',
    'user_tasks',
    'user_task_categories',
    'project_progress_plans',
    'work_activities',
    'activity_log',
    'daily_manpower',
    'daily_manpower_positions',
    'decision_logs',
    'engineering_files',
    'engineering_folders'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE CASCADE', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I(project_id)', 'idx_' || t || '_project_id', t);
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 3. Helper functions
-- ----------------------------------------------------------------------------
-- Reads the project selected by the frontend from the x-project-id header.
CREATE OR REPLACE FUNCTION current_project_id()
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT NULLIF(current_setting('request.headers', true)::json->>'x-project-id', '')::uuid;
$$;

-- SECURITY DEFINER so it bypasses RLS (avoids policy recursion).
CREATE OR REPLACE FUNCTION is_master()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'master'
  );
$$;

CREATE OR REPLACE FUNCTION is_project_member(p_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM project_members
    WHERE project_id = p_project_id AND user_id = auth.uid()
  );
$$;

-- ----------------------------------------------------------------------------
-- 4. Auto-populate project_id on insert
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_project_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  hdr text;
  sub_id uuid;
BEGIN
  IF NEW.project_id IS NULL THEN
    hdr := current_setting('request.headers', true)::json->>'x-project-id';
    IF hdr IS NOT NULL AND hdr <> '' THEN
      NEW.project_id := hdr::uuid;
    END IF;
  END IF;

  -- Fall back to the parent subcontractor's project when available.
  IF NEW.project_id IS NULL THEN
    sub_id := NULLIF(to_jsonb(NEW)->>'subcontractor_id', '')::uuid;
    IF sub_id IS NOT NULL THEN
      SELECT project_id INTO NEW.project_id FROM subcontractors WHERE id = sub_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'subcontractors',
    'contract_items',
    'progress_photos',
    'change_orders',
    'rfis',
    'risks',
    'diary_entries',
    'project_progress_grid',
    'global_areas',
    'subcontractor_areas',
    'contacts',
    'user_tasks',
    'user_task_categories',
    'project_progress_plans',
    'work_activities',
    'activity_log',
    'daily_manpower',
    'daily_manpower_positions',
    'decision_logs',
    'engineering_files',
    'engineering_folders'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_project_id_trigger ON %I', t);
    EXECUTE format('CREATE TRIGGER set_project_id_trigger BEFORE INSERT ON %I FOR EACH ROW EXECUTE FUNCTION set_project_id()', t);
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 5. Auto-create profile for new auth users
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO user_profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    'user'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ----------------------------------------------------------------------------
-- 6. Auto-add project creator as a member
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION add_project_creator_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by IS NOT NULL THEN
    INSERT INTO project_members (project_id, user_id, role)
    VALUES (NEW.id, NEW.created_by, 'owner')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_project_created ON projects;
CREATE TRIGGER on_project_created
  AFTER INSERT ON projects
  FOR EACH ROW EXECUTE FUNCTION add_project_creator_member();

-- ----------------------------------------------------------------------------
-- 7. Seed: default project, master user, memberships, permissions
-- ----------------------------------------------------------------------------
-- Create a default project for existing data (only if none exists yet).
INSERT INTO projects (name, description, is_default, created_by)
SELECT
  'Hovedprosjekt',
  'Automatisk opprettet prosjekt som inneholder eksisterende data. Gi prosjektet nytt navn i Brukere & Prosjekter.',
  true,
  u.id
FROM auth.users u
WHERE u.email = 'daniel.ekman@veidekke.no'
  AND NOT EXISTS (SELECT 1 FROM projects)
LIMIT 1;

-- Assign all existing rows to the default project.
DO $$
DECLARE
  t text;
  default_project uuid;
  tables text[] := ARRAY[
    'subcontractors',
    'contract_items',
    'progress_photos',
    'change_orders',
    'rfis',
    'risks',
    'diary_entries',
    'project_progress_grid',
    'global_areas',
    'subcontractor_areas',
    'contacts',
    'user_tasks',
    'user_task_categories',
    'project_progress_plans',
    'work_activities',
    'activity_log',
    'daily_manpower',
    'daily_manpower_positions',
    'decision_logs',
    'engineering_files',
    'engineering_folders'
  ];
BEGIN
  SELECT id INTO default_project FROM projects WHERE is_default = true ORDER BY created_at LIMIT 1;
  IF default_project IS NOT NULL THEN
    FOREACH t IN ARRAY tables LOOP
      EXECUTE format('UPDATE %I SET project_id = $1 WHERE project_id IS NULL', t) USING default_project;
    END LOOP;
  END IF;
END $$;

-- Ensure profiles exist and daniel is master.
INSERT INTO user_profiles (id, email, full_name, role)
SELECT
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name'),
  CASE WHEN u.email = 'daniel.ekman@veidekke.no' THEN 'master' ELSE 'user' END
FROM auth.users u
ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      role = CASE WHEN EXCLUDED.email = 'daniel.ekman@veidekke.no' THEN 'master' ELSE user_profiles.role END;

-- Make daniel a member of every project.
INSERT INTO project_members (project_id, user_id, role)
SELECT p.id, u.id, 'owner'
FROM projects p
CROSS JOIN auth.users u
WHERE u.email = 'daniel.ekman@veidekke.no'
ON CONFLICT DO NOTHING;

-- Grant daniel access to every dataset in every project.
INSERT INTO user_dataset_permissions (user_id, project_id, dataset, can_access)
SELECT u.id, p.id, d.dataset, true
FROM auth.users u
CROSS JOIN projects p
CROSS JOIN LATERAL (
  VALUES
    ('dashboard'), ('setup'), ('subcontractors'), ('contracts'),
    ('progress'), ('financials'), ('risks'), ('bemanning'),
    ('areas'), ('diary'), ('decisions'), ('contacts'), ('statistics')
) AS d(dataset)
WHERE u.email = 'daniel.ekman@veidekke.no'
ON CONFLICT (user_id, project_id, dataset) DO UPDATE SET can_access = true;

-- ----------------------------------------------------------------------------
-- 8. Row Level Security
-- ----------------------------------------------------------------------------
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_dataset_permissions ENABLE ROW LEVEL SECURITY;

-- Drop old permissive policies on data tables.
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'subcontractors','contract_items','progress_photos','change_orders','rfis',
    'risks','diary_entries','project_progress_grid','global_areas',
    'subcontractor_areas','contacts','project_progress_plans','work_activities',
    'activity_log','daily_manpower','daily_manpower_positions','decision_logs',
    'engineering_files','engineering_folders'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'Allow authenticated full access to ' || t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'project_scoped_access', t);
  END LOOP;
END $$;

-- Enable RLS on tables that previously had it disabled.
ALTER TABLE project_progress_grid ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_manpower_positions ENABLE ROW LEVEL SECURITY;

-- Dataset permissions are checked server-side as well as in the UI.
CREATE OR REPLACE FUNCTION has_any_dataset_access(p_datasets text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT is_master() OR EXISTS (
    SELECT 1
    FROM user_dataset_permissions udp
    WHERE udp.user_id = auth.uid()
      AND udp.project_id = current_project_id()
      AND udp.dataset = ANY (p_datasets)
      AND udp.can_access = true
  );
$$;

REVOKE EXECUTE ON FUNCTION current_project_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION current_project_id() TO authenticated;
REVOKE EXECUTE ON FUNCTION is_master() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION is_master() TO authenticated;
REVOKE EXECUTE ON FUNCTION is_project_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION is_project_member(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION has_any_dataset_access(text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION has_any_dataset_access(text[]) TO authenticated;
REVOKE EXECUTE ON FUNCTION set_project_id() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION add_project_creator_member() FROM PUBLIC, anon, authenticated;

-- Project- and dataset-scoped policies for all project data tables.
DO $$
DECLARE
  t text;
  mappings jsonb := '{
    "subcontractors": ["dashboard","subcontractors","contracts","progress","financials","risks","bemanning","areas","statistics"],
    "contract_items": ["contracts"],
    "progress_photos": ["progress"],
    "change_orders": ["financials","contracts"],
    "rfis": ["statistics","progress"],
    "risks": ["risks"],
    "diary_entries": ["diary"],
    "project_progress_grid": ["progress","financials"],
    "global_areas": ["setup","areas","bemanning","progress","decisions"],
    "subcontractor_areas": ["areas","bemanning","progress"],
    "contacts": ["contacts"],
    "project_progress_plans": ["progress"],
    "work_activities": ["dashboard","progress","bemanning"],
    "activity_log": ["bemanning","statistics"],
    "daily_manpower": ["bemanning","statistics"],
    "daily_manpower_positions": ["bemanning"],
    "decision_logs": ["decisions"],
    "engineering_files": ["decisions"],
    "engineering_folders": ["decisions"]
  }'::jsonb;
  datasets text[];
BEGIN
  FOR t IN SELECT jsonb_object_keys(mappings) LOOP
    SELECT array_agg(value) INTO datasets
    FROM jsonb_array_elements_text(mappings->t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL TO authenticated USING (project_id = current_project_id() AND (is_project_member(project_id) OR is_master()) AND has_any_dataset_access(%L::text[])) WITH CHECK (project_id = current_project_id() AND (is_project_member(project_id) OR is_master()) AND has_any_dataset_access(%L::text[]))',
      'project_scoped_access', t, datasets, datasets
    );
  END LOOP;
END $$;

-- User tasks: scoped to project AND owner.
DROP POLICY IF EXISTS "Users can manage their own tasks" ON user_tasks;
DROP POLICY IF EXISTS "project_user_tasks" ON user_tasks;
CREATE POLICY "project_user_tasks" ON user_tasks FOR ALL TO authenticated
  USING (project_id = current_project_id() AND user_id = auth.uid())
  WITH CHECK (project_id = current_project_id() AND user_id = auth.uid());

DROP POLICY IF EXISTS "Users manage own task categories" ON user_task_categories;
DROP POLICY IF EXISTS "project_user_task_categories" ON user_task_categories;
CREATE POLICY "project_user_task_categories" ON user_task_categories FOR ALL TO authenticated
  USING (project_id = current_project_id() AND user_id = auth.uid())
  WITH CHECK (project_id = current_project_id() AND user_id = auth.uid());

-- projects: members can read, master can manage.
DROP POLICY IF EXISTS "projects_select" ON projects;
DROP POLICY IF EXISTS "projects_master_manage" ON projects;
CREATE POLICY "projects_select" ON projects FOR SELECT TO authenticated
  USING (is_project_member(id) OR created_by = auth.uid() OR is_master());
CREATE POLICY "projects_master_manage" ON projects FOR ALL TO authenticated
  USING (is_master()) WITH CHECK (is_master());

-- project_members: users see their own memberships, master manages all.
DROP POLICY IF EXISTS "project_members_select" ON project_members;
DROP POLICY IF EXISTS "project_members_master_manage" ON project_members;
CREATE POLICY "project_members_select" ON project_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_master());
CREATE POLICY "project_members_master_manage" ON project_members FOR ALL TO authenticated
  USING (is_master()) WITH CHECK (is_master());

-- user_profiles: users may read their own profile; only master may manage roles.
DROP POLICY IF EXISTS "user_profiles_select" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_update_self" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_master_manage" ON user_profiles;
CREATE POLICY "user_profiles_select" ON user_profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR is_master());
CREATE POLICY "user_profiles_master_manage" ON user_profiles FOR ALL TO authenticated
  USING (is_master()) WITH CHECK (is_master());

-- user_dataset_permissions: users see their own, master manages all.
DROP POLICY IF EXISTS "user_dataset_permissions_select" ON user_dataset_permissions;
DROP POLICY IF EXISTS "user_dataset_permissions_master_manage" ON user_dataset_permissions;
CREATE POLICY "user_dataset_permissions_select" ON user_dataset_permissions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_master());
CREATE POLICY "user_dataset_permissions_master_manage" ON user_dataset_permissions FOR ALL TO authenticated
  USING (is_master()) WITH CHECK (is_master());

-- ----------------------------------------------------------------------------
-- 9. Verification
-- ----------------------------------------------------------------------------
SELECT 'Multi-project migration completed' AS status,
       (SELECT count(*) FROM projects) AS projects,
       (SELECT count(*) FROM user_profiles) AS profiles,
       (SELECT count(*) FROM project_members) AS memberships;
