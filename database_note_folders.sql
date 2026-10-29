-- ============================================================================
-- User-specific note organization (folders, sections, placements)
-- ----------------------------------------------------------------------------
-- The main "Notater" page can be organized like OneNote: each user has their
-- own folders and sections per project. Notes (diary_entries) stay shared
-- project data; `note_placements` maps a note into a user's section so the
-- organization is personal without duplicating the note itself.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------------------
-- 1. Tables
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS note_folders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS note_sections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  folder_id UUID NOT NULL REFERENCES note_folders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS note_placements (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note_id UUID NOT NULL REFERENCES diary_entries(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES note_sections(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, note_id)
);

CREATE INDEX IF NOT EXISTS idx_note_folders_user_project ON note_folders(user_id, project_id);
CREATE INDEX IF NOT EXISTS idx_note_sections_user_project ON note_sections(user_id, project_id);
CREATE INDEX IF NOT EXISTS idx_note_sections_folder ON note_sections(folder_id);
CREATE INDEX IF NOT EXISTS idx_note_placements_user_project ON note_placements(user_id, project_id);
CREATE INDEX IF NOT EXISTS idx_note_placements_section ON note_placements(section_id);

-- ----------------------------------------------------------------------------
-- 2. Row Level Security — everything is personal to the signed-in user and
--    scoped to the currently selected project.
-- ----------------------------------------------------------------------------
ALTER TABLE note_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE note_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE note_placements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS note_folders_owner ON note_folders;
CREATE POLICY note_folders_owner ON note_folders FOR ALL TO authenticated
  USING (user_id = auth.uid() AND project_id = current_project_id())
  WITH CHECK (user_id = auth.uid() AND project_id = current_project_id());

DROP POLICY IF EXISTS note_sections_owner ON note_sections;
CREATE POLICY note_sections_owner ON note_sections FOR ALL TO authenticated
  USING (user_id = auth.uid() AND project_id = current_project_id())
  WITH CHECK (user_id = auth.uid() AND project_id = current_project_id());

DROP POLICY IF EXISTS note_placements_owner ON note_placements;
CREATE POLICY note_placements_owner ON note_placements FOR ALL TO authenticated
  USING (user_id = auth.uid() AND project_id = current_project_id() AND has_notes_access())
  WITH CHECK (user_id = auth.uid() AND project_id = current_project_id() AND has_notes_access());

-- Verification
SELECT 'Note folders migration completed' AS status,
       (SELECT count(*) FROM note_folders) AS folders,
       (SELECT count(*) FROM note_sections) AS sections;
