-- ============================================================================
-- "Notater" (formerly "Dagbok") is a personal feature
-- ----------------------------------------------------------------------------
-- The Notater section used to be a project-scoped dataset permission stored in
-- `user_dataset_permissions`. It now belongs to the user's profile so that it
-- follows the user across every project they are a member of.
--
-- This migration:
--   1. Adds `user_profiles.notes_access`.
--   2. Migrates existing project-level "diary" permissions to the profile.
--   3. Removes the now-obsolete project-level "diary" permission rows.
--   4. Adds a `has_notes_access()` helper and rewrites the `diary_entries`
--      RLS policy to use it.
-- ============================================================================

-- 1. Personal notes permission on the user profile.
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS notes_access BOOLEAN NOT NULL DEFAULT false;

-- 2. Anyone who previously had project-level diary access keeps it, now at the
--    profile level.
UPDATE user_profiles p
SET notes_access = true
WHERE EXISTS (
  SELECT 1
  FROM user_dataset_permissions udp
  WHERE udp.user_id = p.id
    AND udp.dataset = 'diary'
    AND udp.can_access = true
);

-- 3. Notater is no longer a project-scoped dataset.
DELETE FROM user_dataset_permissions WHERE dataset = 'diary';

-- 4. Helper used by RLS. SECURITY DEFINER avoids policy recursion on
--    user_profiles.
CREATE OR REPLACE FUNCTION has_notes_access()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT is_master() OR EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND notes_access = true
  );
$$;

REVOKE EXECUTE ON FUNCTION has_notes_access() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION has_notes_access() TO authenticated;

-- 5. diary_entries stays project-scoped data, but access is now granted by the
--    personal notes permission instead of a per-project dataset permission.
DROP POLICY IF EXISTS project_scoped_access ON diary_entries;
CREATE POLICY project_scoped_access ON diary_entries FOR ALL TO authenticated
  USING (
    project_id = current_project_id()
    AND (is_project_member(project_id) OR is_master())
    AND has_notes_access()
  )
  WITH CHECK (
    project_id = current_project_id()
    AND (is_project_member(project_id) OR is_master())
    AND has_notes_access()
  );

-- Verification
SELECT 'Notes access migration completed' AS status,
       (SELECT count(*) FROM user_profiles WHERE notes_access = true) AS users_with_notes;
