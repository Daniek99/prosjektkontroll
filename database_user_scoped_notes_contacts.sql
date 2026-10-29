-- ============================================================================
-- User-scoped notes and contacts + project-scoped contact groups
-- ----------------------------------------------------------------------------
-- * diary_entries (Notater) become a property of the user AND the project.
-- * contacts become a property of the user AND the project.
-- * contact_groups become a property of the project, so each project can keep
--   its own set of groups.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Notes: add user_id and make the RLS policy user-specific.
-- ----------------------------------------------------------------------------
ALTER TABLE diary_entries
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

UPDATE diary_entries
SET user_id = created_by
WHERE user_id IS NULL AND created_by IS NOT NULL;

UPDATE diary_entries
SET user_id = (
  SELECT id FROM user_profiles WHERE role = 'master' ORDER BY created_at LIMIT 1
)
WHERE user_id IS NULL;

ALTER TABLE diary_entries ALTER COLUMN user_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_diary_entries_user ON diary_entries(user_id);

DROP POLICY IF EXISTS project_scoped_access ON diary_entries;
CREATE POLICY project_scoped_access ON diary_entries FOR ALL TO authenticated
  USING (
    project_id = current_project_id()
    AND user_id = auth.uid()
    AND has_notes_access()
  )
  WITH CHECK (
    project_id = current_project_id()
    AND user_id = auth.uid()
    AND has_notes_access()
  );

-- ----------------------------------------------------------------------------
-- 2. Contacts: add user_id and make the RLS policy user-specific.
-- ----------------------------------------------------------------------------
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

UPDATE contacts
SET user_id = created_by
WHERE user_id IS NULL AND created_by IS NOT NULL;

UPDATE contacts
SET user_id = (
  SELECT id FROM user_profiles WHERE role = 'master' ORDER BY created_at LIMIT 1
)
WHERE user_id IS NULL;

ALTER TABLE contacts ALTER COLUMN user_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_user ON contacts(user_id);

DROP POLICY IF EXISTS project_scoped_access ON contacts;
CREATE POLICY project_scoped_access ON contacts FOR ALL TO authenticated
  USING (project_id = current_project_id() AND user_id = auth.uid())
  WITH CHECK (project_id = current_project_id() AND user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 3. Contact groups: a property of the project.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contact_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (project_id, name)
);

CREATE INDEX IF NOT EXISTS idx_contact_groups_project ON contact_groups(project_id);

ALTER TABLE contact_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS contact_groups_project ON contact_groups;
CREATE POLICY contact_groups_project ON contact_groups FOR ALL TO authenticated
  USING (project_id = current_project_id() AND (is_project_member(project_id) OR is_master()))
  WITH CHECK (project_id = current_project_id() AND (is_project_member(project_id) OR is_master()));

-- Seed groups from the categories already used by contacts.
INSERT INTO contact_groups (project_id, name)
SELECT DISTINCT project_id, category
FROM contacts
WHERE project_id IS NOT NULL AND category IS NOT NULL AND category <> ''
ON CONFLICT (project_id, name) DO NOTHING;

-- Verification
SELECT 'User-scoped notes/contacts migration completed' AS status,
       (SELECT count(*) FROM diary_entries WHERE user_id IS NOT NULL) AS notes_with_user,
       (SELECT count(*) FROM contacts WHERE user_id IS NOT NULL) AS contacts_with_user,
       (SELECT count(*) FROM contact_groups) AS contact_groups;
